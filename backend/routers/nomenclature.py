from typing import List
from io import BytesIO
import re

import psycopg2
from fastapi import APIRouter, File, Form, HTTPException, Path, UploadFile, status
from fastapi.responses import StreamingResponse
from openpyxl import Workbook, load_workbook
from psycopg2.errors import CheckViolation, UniqueViolation
from psycopg2.extras import RealDictCursor

from db import get_connection
from schemas.nomenclature import (
    ImportMode,
    NomenclatureCreate,
    NomenclatureImportCommitResponse,
    NomenclatureImportCommitRow,
    NomenclatureImportPreviewResponse,
    NomenclatureImportPreviewRow,
    NomenclatureRead,
    NomenclatureUpdate,
)


router = APIRouter(prefix="/nomenclature", tags=["nomenclature"])

SELECT_COLUMNS = """
    nomenclature_id,
    nomenclature_code,
    nomenclature_name,
    unit_of_measure,
    is_active
"""

IMPORT_MODE_ADD_ONLY: ImportMode = "add_only"
IMPORT_MODE_UPSERT: ImportMode = "upsert"
SUPPORTED_IMPORT_MODES: set[ImportMode] = {IMPORT_MODE_ADD_ONLY, IMPORT_MODE_UPSERT}

HEADER_FIELD_CODE = "nomenclature_code"
HEADER_FIELD_NAME = "nomenclature_name"
HEADER_FIELD_UNIT = "unit_of_measure"
HEADER_FIELD_ACTIVE = "is_active"

REQUIRED_IMPORT_HEADERS = {
    HEADER_FIELD_CODE,
    HEADER_FIELD_NAME,
    HEADER_FIELD_UNIT,
}

HEADER_ALIASES: dict[str, set[str]] = {
    HEADER_FIELD_CODE: {"код", "nomenclaturecode"},
    HEADER_FIELD_NAME: {"наименование", "nomenclaturename"},
    HEADER_FIELD_UNIT: {"единицаизмерения", "unitofmeasure"},
    HEADER_FIELD_ACTIVE: {"активность", "isactive"},
}

TRUE_ACTIVE_VALUES = {
    "да",
    "true",
    "1",
    "активна",
    "активный",
    "активно",
    "yes",
    "y",
    "on",
}

FALSE_ACTIVE_VALUES = {
    "нет",
    "false",
    "0",
    "неактивна",
    "неактивный",
    "неактивно",
    "no",
    "n",
    "off",
}


def normalize_header_name(value: object) -> str:
    if value is None:
        return ""

    normalized_value = str(value).strip().lower().replace("ё", "е")
    return re.sub(r"[\s_\-./\\]+", "", normalized_value)


def resolve_import_header(value: object) -> str | None:
    normalized_value = normalize_header_name(value)

    if not normalized_value:
        return None

    for field_name, aliases in HEADER_ALIASES.items():
        if normalized_value in aliases:
            return field_name

    return None


def normalize_import_mode(import_mode: str | None) -> ImportMode:
    normalized_mode = (import_mode or IMPORT_MODE_UPSERT).strip().lower()

    if normalized_mode not in SUPPORTED_IMPORT_MODES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недопустимый режим импорта. Используйте add_only или upsert.",
        )

    return normalized_mode  # type: ignore[return-value]


def normalize_bool_value(value: object) -> tuple[bool | None, str | None]:
    if value is None:
        return True, None

    if isinstance(value, bool):
        return value, None

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if value == 1:
            return True, None
        if value == 0:
            return False, None

    normalized_value = str(value).strip().lower()

    if not normalized_value:
        return True, None

    if normalized_value in TRUE_ACTIVE_VALUES:
        return True, None

    if normalized_value in FALSE_ACTIVE_VALUES:
        return False, None

    return None, "Недопустимое значение активности"


def normalize_unit_of_measure(value: object) -> tuple[str | None, str | None]:
    if value is None:
        return None, "Недопустимая единица измерения"

    raw_value = str(value).strip()
    if not raw_value:
        return None, "Недопустимая единица измерения"

    lowered_value = raw_value.lower()
    cyrillic_value = lowered_value.translate(str.maketrans({"m": "м", "p": "п"}))
    compact_value = re.sub(r"\s+", "", cyrillic_value)
    compact_without_dots = compact_value.replace(".", "")

    if compact_value in {"м²", "м2", "м^2"}:
        return "м²", None

    if compact_without_dots in {"мп", "мпог", "мпогм", "мпогон", "мпогонный"}:
        return "м.п.", None

    if "пог" in compact_without_dots and compact_without_dots.startswith("м"):
        return "м.п.", None

    return None, "Недопустимая единица измерения"


def normalize_code(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def normalize_name(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def validate_import_file(file: UploadFile, file_bytes: bytes) -> None:
    file_name = file.filename or ""
    if not file_name.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Поддерживается только формат .xlsx.",
        )

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл пустой.",
        )


def read_import_rows(file_bytes: bytes) -> list[dict]:
    try:
        workbook = load_workbook(filename=BytesIO(file_bytes), data_only=True)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не удалось прочитать Excel-файл. Проверьте формат .xlsx.",
        ) from exc

    try:
        sheet = workbook.active
        max_column = sheet.max_column or 0
        max_row = sheet.max_row or 0

        if max_column == 0 or max_row == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Файл пустой.",
            )

        header_indexes: dict[str, int] = {}
        for column_index in range(1, max_column + 1):
            header_name = resolve_import_header(sheet.cell(row=1, column=column_index).value)
            if header_name and header_name not in header_indexes:
                header_indexes[header_name] = column_index

        missing_headers = [
            field_name
            for field_name in REQUIRED_IMPORT_HEADERS
            if field_name not in header_indexes
        ]
        if missing_headers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Не найдены обязательные колонки шаблона: Код, Наименование, Единица измерения."
                ),
            )

        rows: list[dict] = []
        has_active_column = HEADER_FIELD_ACTIVE in header_indexes

        for row_index in range(2, max_row + 1):
            raw_code = sheet.cell(row=row_index, column=header_indexes[HEADER_FIELD_CODE]).value
            raw_name = sheet.cell(row=row_index, column=header_indexes[HEADER_FIELD_NAME]).value
            raw_unit = sheet.cell(row=row_index, column=header_indexes[HEADER_FIELD_UNIT]).value
            raw_active = (
                sheet.cell(row=row_index, column=header_indexes[HEADER_FIELD_ACTIVE]).value
                if has_active_column
                else None
            )

            is_empty_row = (
                normalize_code(raw_code) == ""
                and normalize_name(raw_name) == ""
                and normalize_code(raw_unit) == ""
                and (raw_active is None or str(raw_active).strip() == "")
            )
            if is_empty_row:
                continue

            normalized_code = normalize_code(raw_code)
            normalized_name = normalize_name(raw_name)
            normalized_unit, unit_error = normalize_unit_of_measure(raw_unit)
            normalized_active, active_error = normalize_bool_value(raw_active)

            row_errors: list[str] = []

            if not normalized_code:
                row_errors.append("Пустой код")

            if not normalized_name:
                row_errors.append("Пустое наименование")

            if unit_error:
                row_errors.append(unit_error)

            if active_error:
                row_errors.append(active_error)

            code_key = normalized_code.upper() if normalized_code else None

            rows.append(
                {
                    "row_no": row_index,
                    "nomenclature_code": normalized_code or None,
                    "nomenclature_name": normalized_name or None,
                    "unit_of_measure": normalized_unit,
                    "is_active": normalized_active,
                    "errors": row_errors,
                    "code_key": code_key,
                    "unit_normalized_from": (
                        str(raw_unit).strip()
                        if raw_unit is not None and normalized_unit is not None and str(raw_unit).strip() != normalized_unit
                        else None
                    ),
                }
            )

        if not rows:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Файл пустой.",
            )

        duplicate_counts: dict[str, int] = {}
        for row in rows:
            code_key = row["code_key"]
            if code_key:
                duplicate_counts[code_key] = duplicate_counts.get(code_key, 0) + 1

        for row in rows:
            code_key = row["code_key"]
            if code_key and duplicate_counts.get(code_key, 0) > 1:
                row["errors"].append("Дубликат кода в файле")

        return rows
    finally:
        workbook.close()


def fetch_existing_nomenclature_codes(cursor: RealDictCursor) -> dict[str, int]:
    cursor.execute(
        """
        SELECT nomenclature_id, nomenclature_code
        FROM nomenclature;
        """
    )
    rows = cursor.fetchall()
    return {
        str(row["nomenclature_code"]).strip().upper(): int(row["nomenclature_id"])
        for row in rows
    }


def build_import_preview(
    import_mode: ImportMode,
    parsed_rows: list[dict],
    existing_codes_map: dict[str, int],
) -> NomenclatureImportPreviewResponse:
    preview_rows: list[NomenclatureImportPreviewRow] = []
    new_rows = 0
    update_rows = 0
    conflict_rows = 0
    error_rows = 0
    valid_rows = 0

    for row in parsed_rows:
        row_errors: list[str] = list(row["errors"])
        code_key = row["code_key"]
        code_exists = bool(code_key and code_key in existing_codes_map)

        status_value: str
        can_import = False

        if row_errors:
            status_value = "error"
        elif code_exists and import_mode == IMPORT_MODE_ADD_ONLY:
            status_value = "conflict"
            row_errors.append("Код уже существует")
        elif code_exists:
            status_value = "update"
            can_import = True
        else:
            status_value = "new"
            can_import = True

        if status_value == "new":
            new_rows += 1
        elif status_value == "update":
            update_rows += 1
        elif status_value == "conflict":
            conflict_rows += 1
        else:
            error_rows += 1

        if can_import:
            valid_rows += 1

        preview_rows.append(
            NomenclatureImportPreviewRow(
                row_no=row["row_no"],
                nomenclature_code=row["nomenclature_code"],
                nomenclature_name=row["nomenclature_name"],
                unit_of_measure=row["unit_of_measure"],
                is_active=row["is_active"],
                status=status_value,  # type: ignore[arg-type]
                can_import=can_import,
                messages=row_errors,
                unit_normalized_from=row["unit_normalized_from"],
            )
        )

    return NomenclatureImportPreviewResponse(
        import_mode=import_mode,
        total_rows=len(parsed_rows),
        valid_rows=valid_rows,
        new_rows=new_rows,
        update_rows=update_rows,
        conflict_rows=conflict_rows,
        error_rows=error_rows,
        rows=preview_rows,
    )


def create_template_workbook() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Номенклатура"
    sheet.append(["Код", "Наименование", "Единица измерения", "Активность"])
    sheet.append(["NM-001", "Полотно ламинированное белое", "м²", "Да"])

    output = BytesIO()
    workbook.save(output)
    workbook.close()
    output.seek(0)
    return output.read()


def upsert_nomenclature_row(cursor: RealDictCursor, row: NomenclatureImportPreviewRow) -> bool:
    cursor.execute(
        """
        INSERT INTO nomenclature (
            nomenclature_code,
            nomenclature_name,
            unit_of_measure,
            is_active
        )
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (nomenclature_code)
        DO UPDATE SET
            nomenclature_name = EXCLUDED.nomenclature_name,
            unit_of_measure = EXCLUDED.unit_of_measure,
            is_active = EXCLUDED.is_active,
            updated_at = NOW()
        RETURNING (xmax = 0) AS inserted;
        """,
        (
            row.nomenclature_code,
            row.nomenclature_name,
            row.unit_of_measure,
            row.is_active,
        ),
    )
    result = cursor.fetchone()
    return bool(result and result["inserted"])


@router.get("", response_model=List[NomenclatureRead])
def list_nomenclature():
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM nomenclature
                ORDER BY nomenclature_code;
                """
            )
            rows = cursor.fetchall()

        return rows
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить список номенклатуры.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.get("/import/template")
def download_nomenclature_import_template():
    template_content = create_template_workbook()
    return StreamingResponse(
        BytesIO(template_content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="nomenclature_import_template.xlsx"'
        },
    )


@router.post("/import/preview", response_model=NomenclatureImportPreviewResponse)
async def preview_nomenclature_import(
    file: UploadFile = File(...),
    import_mode: str = Form(IMPORT_MODE_UPSERT),
):
    normalized_mode = normalize_import_mode(import_mode)
    file_bytes = await file.read()
    validate_import_file(file, file_bytes)
    parsed_rows = read_import_rows(file_bytes)

    connection = None
    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            existing_codes_map = fetch_existing_nomenclature_codes(cursor)

        return build_import_preview(
            import_mode=normalized_mode,
            parsed_rows=parsed_rows,
            existing_codes_map=existing_codes_map,
        )
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось подготовить предпросмотр импорта.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.post("/import/commit", response_model=NomenclatureImportCommitResponse)
async def commit_nomenclature_import(
    file: UploadFile = File(...),
    import_mode: str = Form(IMPORT_MODE_UPSERT),
):
    normalized_mode = normalize_import_mode(import_mode)
    file_bytes = await file.read()
    validate_import_file(file, file_bytes)
    parsed_rows = read_import_rows(file_bytes)

    connection = None
    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            existing_codes_map = fetch_existing_nomenclature_codes(cursor)
            preview_result = build_import_preview(
                import_mode=normalized_mode,
                parsed_rows=parsed_rows,
                existing_codes_map=existing_codes_map,
            )

            created_count = 0
            updated_count = 0
            skipped_count = preview_result.conflict_rows + preview_result.error_rows
            error_count = preview_result.error_rows
            conflict_count = preview_result.conflict_rows
            commit_rows: list[NomenclatureImportCommitRow] = []

            for preview_row in preview_result.rows:
                if preview_row.status == "error":
                    commit_rows.append(
                        NomenclatureImportCommitRow(
                            row_no=preview_row.row_no,
                            nomenclature_code=preview_row.nomenclature_code,
                            status="error",
                            message=preview_row.messages[0] if preview_row.messages else "Ошибка валидации",
                        )
                    )
                    continue

                if preview_row.status == "conflict":
                    commit_rows.append(
                        NomenclatureImportCommitRow(
                            row_no=preview_row.row_no,
                            nomenclature_code=preview_row.nomenclature_code,
                            status="skipped",
                            message=preview_row.messages[0] if preview_row.messages else "Код уже существует",
                        )
                    )
                    continue

                if normalized_mode == IMPORT_MODE_ADD_ONLY:
                    cursor.execute(
                        """
                        INSERT INTO nomenclature (
                            nomenclature_code,
                            nomenclature_name,
                            unit_of_measure,
                            is_active
                        )
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (nomenclature_code)
                        DO NOTHING
                        RETURNING nomenclature_id;
                        """,
                        (
                            preview_row.nomenclature_code,
                            preview_row.nomenclature_name,
                            preview_row.unit_of_measure,
                            preview_row.is_active,
                        ),
                    )
                    inserted_row = cursor.fetchone()
                    if inserted_row is None:
                        skipped_count += 1
                        conflict_count += 1
                        commit_rows.append(
                            NomenclatureImportCommitRow(
                                row_no=preview_row.row_no,
                                nomenclature_code=preview_row.nomenclature_code,
                                status="skipped",
                                message="Код уже существует",
                            )
                        )
                    else:
                        created_count += 1
                        commit_rows.append(
                            NomenclatureImportCommitRow(
                                row_no=preview_row.row_no,
                                nomenclature_code=preview_row.nomenclature_code,
                                status="created",
                                message="Создано",
                            )
                        )
                    continue

                inserted = upsert_nomenclature_row(cursor, preview_row)
                if inserted:
                    created_count += 1
                    commit_rows.append(
                        NomenclatureImportCommitRow(
                            row_no=preview_row.row_no,
                            nomenclature_code=preview_row.nomenclature_code,
                            status="created",
                            message="Создано",
                        )
                    )
                else:
                    updated_count += 1
                    commit_rows.append(
                        NomenclatureImportCommitRow(
                            row_no=preview_row.row_no,
                            nomenclature_code=preview_row.nomenclature_code,
                            status="updated",
                            message="Обновлено",
                        )
                    )

        connection.commit()
        return NomenclatureImportCommitResponse(
            import_mode=normalized_mode,
            total_rows=preview_result.total_rows,
            created_count=created_count,
            updated_count=updated_count,
            skipped_count=skipped_count,
            error_count=error_count,
            conflict_count=conflict_count,
            rows=commit_rows,
        )
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось выполнить импорт номенклатуры.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.get("/{nomenclature_id}", response_model=NomenclatureRead)
def get_nomenclature(nomenclature_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM nomenclature
                WHERE nomenclature_id = %s;
                """,
                (nomenclature_id,),
            )
            row = cursor.fetchone()

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Позиция номенклатуры не найдена.",
            )

        return row
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить позицию номенклатуры.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.post("", response_model=NomenclatureRead, status_code=status.HTTP_201_CREATED)
def create_nomenclature(payload: NomenclatureCreate):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                INSERT INTO nomenclature (
                    nomenclature_code,
                    nomenclature_name,
                    unit_of_measure,
                    is_active
                )
                VALUES (%s, %s, %s, %s)
                RETURNING {SELECT_COLUMNS};
                """,
                (
                    payload.nomenclature_code,
                    payload.nomenclature_name,
                    payload.unit_of_measure,
                    payload.is_active,
                ),
            )
            created_row = cursor.fetchone()

        connection.commit()
        return created_row
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Позиция с таким кодом уже существует.",
        ) from exc
    except CheckViolation as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Единица измерения может быть только 'м²' или 'м.п.'.",
        ) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать позицию номенклатуры.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.put("/{nomenclature_id}", response_model=NomenclatureRead)
def update_nomenclature(
    payload: NomenclatureUpdate,
    nomenclature_id: int = Path(..., gt=0),
):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                UPDATE nomenclature
                SET
                    nomenclature_code = %s,
                    nomenclature_name = %s,
                    unit_of_measure = %s,
                    is_active = %s,
                    updated_at = NOW()
                WHERE nomenclature_id = %s
                RETURNING {SELECT_COLUMNS};
                """,
                (
                    payload.nomenclature_code,
                    payload.nomenclature_name,
                    payload.unit_of_measure,
                    payload.is_active,
                    nomenclature_id,
                ),
            )
            updated_row = cursor.fetchone()

        if updated_row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Позиция номенклатуры не найдена.",
            )

        connection.commit()
        return updated_row
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Позиция с таким кодом уже существует.",
        ) from exc
    except CheckViolation as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Единица измерения может быть только 'м²' или 'м.п.'.",
        ) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось изменить позицию номенклатуры.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.delete("/{nomenclature_id}", response_model=NomenclatureRead)
def deactivate_nomenclature(nomenclature_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                UPDATE nomenclature
                SET
                    is_active = FALSE,
                    updated_at = NOW()
                WHERE nomenclature_id = %s
                RETURNING {SELECT_COLUMNS};
                """,
                (nomenclature_id,),
            )
            deactivated_row = cursor.fetchone()

        if deactivated_row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Позиция номенклатуры не найдена.",
            )

        connection.commit()
        return deactivated_row
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось деактивировать позицию номенклатуры.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()
