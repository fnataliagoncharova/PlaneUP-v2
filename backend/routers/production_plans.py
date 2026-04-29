from datetime import date
from typing import Any

import psycopg2
from fastapi import APIRouter, HTTPException, Path, status
from psycopg2.errors import CheckViolation, ForeignKeyViolation, UniqueViolation
from psycopg2.extras import RealDictCursor

from db import get_connection
from schemas.production_plan import (
    ProductionPlanCreate,
    ProductionPlanDeleteResponse,
    ProductionPlanFromDemandCreate,
    ProductionPlanLineCreate,
    ProductionPlanLineDeleteResponse,
    ProductionPlanLineUpdate,
    ProductionPlanRead,
    ProductionPlanRefreshFromDemandRequest,
    ProductionPlanSummary,
    ProductionPlanUpdate,
)


router = APIRouter(prefix="/production-plans", tags=["production_plans"])

PLAN_COLUMNS = """
    pp.production_plan_id,
    pp.plan_month,
    pp.source_balance_date,
    pp.source_calculated_at,
    pp.plan_name,
    pp.status,
    pp.comment,
    pp.created_at,
    pp.updated_at
"""

LINE_COLUMNS = """
    ppl.production_plan_line_id,
    ppl.production_plan_id,
    ppl.nomenclature_id,
    n.nomenclature_code,
    n.nomenclature_name,
    ppl.planned_qty,
    ppl.unit_of_measure,
    ppl.is_priority,
    ppl.priority_note,
    ppl.line_comment,
    ppl.created_at,
    ppl.updated_at
"""


def normalize_month_date(value: date) -> date:
    return value.replace(day=1)


def build_default_plan_name(plan_month: date) -> str:
    return f"План выпуска на {plan_month.strftime('%Y-%m')}"


def ensure_manufactured_nomenclature(cursor: RealDictCursor, nomenclature_id: int) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT nomenclature_id, item_type, unit_of_measure
        FROM nomenclature
        WHERE nomenclature_id = %s;
        """,
        (nomenclature_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Номенклатура не найдена.")
    if row["item_type"] != "manufactured":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="В план выпуска можно добавить только производимую номенклатуру.",
        )
    return row


def get_production_plan_by_id(connection, production_plan_id: int) -> dict[str, Any] | None:
    with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            f"""
            SELECT {PLAN_COLUMNS}
            FROM production_plans AS pp
            WHERE pp.production_plan_id = %s;
            """,
            (production_plan_id,),
        )
        plan_row = cursor.fetchone()
        if plan_row is None:
            return None

        cursor.execute(
            f"""
            SELECT {LINE_COLUMNS}
            FROM production_plan_lines AS ppl
            INNER JOIN nomenclature AS n ON n.nomenclature_id = ppl.nomenclature_id
            WHERE ppl.production_plan_id = %s
            ORDER BY ppl.is_priority DESC, n.nomenclature_code ASC;
            """,
            (production_plan_id,),
        )
        plan_row["lines"] = cursor.fetchall()
        return plan_row


def require_production_plan_exists(connection, production_plan_id: int) -> dict[str, Any]:
    plan = get_production_plan_by_id(connection, production_plan_id)
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="План выпуска не найден.")
    return plan


def get_production_plan_for_update(cursor: RealDictCursor, production_plan_id: int) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT production_plan_id, status, plan_name, comment
        FROM production_plans
        WHERE production_plan_id = %s
        FOR UPDATE;
        """,
        (production_plan_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="План выпуска не найден.")
    return row


def ensure_plan_is_draft(
    cursor: RealDictCursor,
    production_plan_id: int,
    error_detail: str = "Утверждённый план выпуска нельзя изменять. Верните его в черновик.",
) -> dict[str, Any]:
    plan_row = get_production_plan_for_update(cursor, production_plan_id)
    if plan_row["status"] != "draft":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_detail)
    return plan_row


def get_plan_id_by_line_id(cursor: RealDictCursor, production_plan_line_id: int, lock: bool = False) -> int:
    lock_clause = "FOR UPDATE" if lock else ""
    cursor.execute(
        f"""
        SELECT production_plan_id
        FROM production_plan_lines
        WHERE production_plan_line_id = %s
        {lock_clause};
        """,
        (production_plan_line_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Строка плана выпуска не найдена.")
    return int(row["production_plan_id"])


@router.get("", response_model=list[ProductionPlanSummary])
def list_production_plans():
    connection = None
    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT
                    {PLAN_COLUMNS},
                    COUNT(ppl.production_plan_line_id)::int AS line_count,
                    COALESCE(SUM(CASE WHEN ppl.is_priority THEN 1 ELSE 0 END), 0)::int AS priority_count
                FROM production_plans AS pp
                LEFT JOIN production_plan_lines AS ppl ON ppl.production_plan_id = pp.production_plan_id
                GROUP BY
                    pp.production_plan_id,
                    pp.plan_month,
                    pp.source_balance_date,
                    pp.source_calculated_at,
                    pp.plan_name,
                    pp.status,
                    pp.comment,
                    pp.created_at,
                    pp.updated_at
                ORDER BY pp.plan_month DESC, pp.created_at DESC;
                """
            )
            return cursor.fetchall()
    except psycopg2.Error as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось получить планы выпуска.") from exc
    finally:
        if connection is not None:
            connection.close()


@router.get("/{production_plan_id}", response_model=ProductionPlanRead)
def get_production_plan(production_plan_id: int = Path(..., gt=0)):
    connection = None
    try:
        connection = get_connection()
        return require_production_plan_exists(connection, production_plan_id)
    except HTTPException:
        raise
    except psycopg2.Error as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось получить план выпуска.") from exc
    finally:
        if connection is not None:
            connection.close()


@router.post("", response_model=ProductionPlanRead, status_code=status.HTTP_201_CREATED)
def create_production_plan(payload: ProductionPlanCreate):
    connection = None
    try:
        normalized_month = normalize_month_date(payload.plan_month)
        plan_name = (payload.plan_name or "").strip() or build_default_plan_name(normalized_month)
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                INSERT INTO production_plans (
                    plan_month, source_balance_date, source_calculated_at, plan_name, status, comment
                )
                VALUES (%s, %s, %s, %s, 'draft', %s)
                RETURNING production_plan_id;
                """,
                (
                    normalized_month,
                    payload.source_balance_date,
                    payload.source_calculated_at,
                    plan_name,
                    payload.comment,
                ),
            )
            created = cursor.fetchone()
        connection.commit()
        return require_production_plan_exists(connection, int(created["production_plan_id"]))
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="План выпуска за выбранный месяц уже существует.") from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось создать план выпуска.") from exc
    finally:
        if connection is not None:
            connection.close()


@router.post("/from-demand", response_model=ProductionPlanRead, status_code=status.HTTP_201_CREATED)
def create_production_plan_from_demand(payload: ProductionPlanFromDemandCreate):
    connection = None
    try:
        if not payload.lines:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нет строк потребности к выпуску для формирования плана.")
        normalized_month = normalize_month_date(payload.plan_month)
        plan_name = (payload.plan_name or "").strip() or build_default_plan_name(normalized_month)

        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                INSERT INTO production_plans (
                    plan_month, source_balance_date, source_calculated_at, plan_name, status, comment
                )
                VALUES (%s, %s, %s, %s, 'draft', %s)
                RETURNING production_plan_id;
                """,
                (
                    normalized_month,
                    payload.source_balance_date,
                    payload.source_calculated_at,
                    plan_name,
                    payload.comment,
                ),
            )
            created_plan = cursor.fetchone()
            production_plan_id = int(created_plan["production_plan_id"])

            seen: set[int] = set()
            for line in payload.lines:
                if line.nomenclature_id in seen:
                    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Позиция уже есть в плане выпуска.")
                seen.add(line.nomenclature_id)
                nomenclature = ensure_manufactured_nomenclature(cursor, line.nomenclature_id)
                cursor.execute(
                    """
                    INSERT INTO production_plan_lines (
                        production_plan_id, nomenclature_id, planned_qty, unit_of_measure,
                        is_priority, priority_note, line_comment
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s);
                    """,
                    (
                        production_plan_id,
                        line.nomenclature_id,
                        line.required_qty,
                        nomenclature["unit_of_measure"],
                        line.is_priority,
                        line.priority_note,
                        line.line_comment,
                    ),
                )
        connection.commit()
        return require_production_plan_exists(connection, production_plan_id)
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()
        constraint_name = getattr(getattr(exc, "diag", None), "constraint_name", None)
        if constraint_name == "production_plan_lines_unique_nomenclature_per_plan":
            detail = "Позиция уже есть в плане выпуска."
        else:
            detail = "План выпуска за выбранный месяц уже существует."
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc
    except (ForeignKeyViolation, CheckViolation) as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="В план выпуска можно добавить только производимую номенклатуру.") from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось создать план выпуска из потребности.") from exc
    finally:
        if connection is not None:
            connection.close()


@router.post("/{production_plan_id}/refresh-from-demand", response_model=ProductionPlanRead)
def refresh_production_plan_from_demand(
    payload: ProductionPlanRefreshFromDemandRequest,
    production_plan_id: int = Path(..., gt=0),
):
    connection = None
    try:
        if not payload.lines:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нет строк потребности к выпуску для обновления плана.")

        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            plan_row = ensure_plan_is_draft(
                cursor,
                production_plan_id,
                error_detail="Утверждённый план выпуска нельзя обновить из расчёта.",
            )

            incoming_by_nomenclature_id: dict[int, Any] = {}
            for line in payload.lines:
                if line.nomenclature_id in incoming_by_nomenclature_id:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="В строках обновления есть дубли номенклатуры.")
                ensure_manufactured_nomenclature(cursor, line.nomenclature_id)
                incoming_by_nomenclature_id[line.nomenclature_id] = line

            cursor.execute(
                """
                SELECT production_plan_line_id, nomenclature_id
                FROM production_plan_lines
                WHERE production_plan_id = %s;
                """,
                (production_plan_id,),
            )
            existing = cursor.fetchall()
            existing_by_nomenclature_id = {int(row["nomenclature_id"]): row for row in existing}

            for nomenclature_id, incoming_line in incoming_by_nomenclature_id.items():
                existing_line = existing_by_nomenclature_id.get(nomenclature_id)
                if existing_line:
                    cursor.execute(
                        """
                        UPDATE production_plan_lines
                        SET planned_qty = %s, updated_at = NOW()
                        WHERE production_plan_line_id = %s;
                        """,
                        (incoming_line.required_qty, existing_line["production_plan_line_id"]),
                    )
                else:
                    nomenclature = ensure_manufactured_nomenclature(cursor, nomenclature_id)
                    cursor.execute(
                        """
                        INSERT INTO production_plan_lines (
                            production_plan_id, nomenclature_id, planned_qty, unit_of_measure,
                            is_priority, priority_note, line_comment
                        )
                        VALUES (%s, %s, %s, %s, FALSE, NULL, NULL);
                        """,
                        (
                            production_plan_id,
                            nomenclature_id,
                            incoming_line.required_qty,
                            nomenclature["unit_of_measure"],
                        ),
                    )

            line_ids_to_delete = [
                row["production_plan_line_id"]
                for nomenclature_id, row in existing_by_nomenclature_id.items()
                if nomenclature_id not in incoming_by_nomenclature_id
            ]
            if line_ids_to_delete:
                cursor.execute(
                    """
                    DELETE FROM production_plan_lines
                    WHERE production_plan_line_id = ANY(%s);
                    """,
                    (line_ids_to_delete,),
                )

            next_comment = plan_row["comment"] if payload.comment is None else payload.comment
            cursor.execute(
                """
                UPDATE production_plans
                SET
                    source_balance_date = %s,
                    source_calculated_at = %s,
                    comment = %s,
                    updated_at = NOW()
                WHERE production_plan_id = %s;
                """,
                (
                    payload.source_balance_date,
                    payload.source_calculated_at,
                    next_comment,
                    production_plan_id,
                ),
            )

        connection.commit()
        return require_production_plan_exists(connection, production_plan_id)
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except (ForeignKeyViolation, CheckViolation) as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="В план выпуска можно добавить только производимую номенклатуру.") from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось обновить план выпуска из расчёта.") from exc
    finally:
        if connection is not None:
            connection.close()


@router.post("/{production_plan_id}/approve", response_model=ProductionPlanRead)
def approve_production_plan(production_plan_id: int = Path(..., gt=0)):
    connection = None
    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            plan_row = get_production_plan_for_update(cursor, production_plan_id)
            if plan_row["status"] == "approved":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="План выпуска уже утверждён.")
            cursor.execute(
                """
                UPDATE production_plans
                SET status = 'approved', updated_at = NOW()
                WHERE production_plan_id = %s;
                """,
                (production_plan_id,),
            )
        connection.commit()
        return require_production_plan_exists(connection, production_plan_id)
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось утвердить план выпуска.") from exc
    finally:
        if connection is not None:
            connection.close()


@router.post("/{production_plan_id}/return-to-draft", response_model=ProductionPlanRead)
def return_production_plan_to_draft(production_plan_id: int = Path(..., gt=0)):
    connection = None
    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            plan_row = get_production_plan_for_update(cursor, production_plan_id)
            if plan_row["status"] == "draft":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="План выпуска уже находится в черновике.")
            cursor.execute(
                """
                UPDATE production_plans
                SET status = 'draft', updated_at = NOW()
                WHERE production_plan_id = %s;
                """,
                (production_plan_id,),
            )
        connection.commit()
        return require_production_plan_exists(connection, production_plan_id)
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось вернуть план в черновик.") from exc
    finally:
        if connection is not None:
            connection.close()


@router.put("/{production_plan_id}", response_model=ProductionPlanRead)
def update_production_plan(payload: ProductionPlanUpdate, production_plan_id: int = Path(..., gt=0)):
    connection = None
    try:
        payload_data = payload.model_dump(exclude_unset=True)
        if "status" in payload_data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Статус плана изменяется отдельным действием.")

        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            plan_row = ensure_plan_is_draft(cursor, production_plan_id)
            next_plan_name = payload_data["plan_name"] if "plan_name" in payload_data else plan_row["plan_name"]
            next_comment = payload_data["comment"] if "comment" in payload_data else plan_row["comment"]

            cursor.execute(
                """
                UPDATE production_plans
                SET plan_name = %s, comment = %s, updated_at = NOW()
                WHERE production_plan_id = %s;
                """,
                (next_plan_name, next_comment, production_plan_id),
            )
        connection.commit()
        return require_production_plan_exists(connection, production_plan_id)
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось обновить план выпуска.") from exc
    finally:
        if connection is not None:
            connection.close()


@router.delete("/{production_plan_id}", response_model=ProductionPlanDeleteResponse)
def delete_production_plan(production_plan_id: int = Path(..., gt=0)):
    connection = None
    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            ensure_plan_is_draft(cursor, production_plan_id)
            cursor.execute(
                """
                DELETE FROM production_plans
                WHERE production_plan_id = %s
                RETURNING production_plan_id;
                """,
                (production_plan_id,),
            )
            deleted = cursor.fetchone()
            if deleted is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="План выпуска не найден.")
        connection.commit()
        return {"production_plan_id": int(deleted["production_plan_id"]), "message": "План выпуска удалён."}
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось удалить план выпуска.") from exc
    finally:
        if connection is not None:
            connection.close()


@router.post("/{production_plan_id}/lines", response_model=ProductionPlanRead, status_code=status.HTTP_201_CREATED)
def create_production_plan_line(payload: ProductionPlanLineCreate, production_plan_id: int = Path(..., gt=0)):
    connection = None
    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            ensure_plan_is_draft(cursor, production_plan_id)
            nomenclature = ensure_manufactured_nomenclature(cursor, payload.nomenclature_id)
            cursor.execute(
                """
                INSERT INTO production_plan_lines (
                    production_plan_id, nomenclature_id, planned_qty, unit_of_measure,
                    is_priority, priority_note, line_comment
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s);
                """,
                (
                    production_plan_id,
                    payload.nomenclature_id,
                    payload.planned_qty,
                    nomenclature["unit_of_measure"],
                    payload.is_priority,
                    payload.priority_note,
                    payload.line_comment,
                ),
            )
        connection.commit()
        return require_production_plan_exists(connection, production_plan_id)
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Позиция уже есть в плане выпуска.") from exc
    except (ForeignKeyViolation, CheckViolation) as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="В план выпуска можно добавить только производимую номенклатуру.") from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось добавить строку плана выпуска.") from exc
    finally:
        if connection is not None:
            connection.close()


@router.put("/lines/{production_plan_line_id}", response_model=ProductionPlanRead)
def update_production_plan_line(payload: ProductionPlanLineUpdate, production_plan_line_id: int = Path(..., gt=0)):
    connection = None
    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            production_plan_id = get_plan_id_by_line_id(cursor, production_plan_line_id, lock=True)
            ensure_plan_is_draft(cursor, production_plan_id)
            cursor.execute(
                """
                UPDATE production_plan_lines
                SET planned_qty = %s, is_priority = %s, priority_note = %s, line_comment = %s, updated_at = NOW()
                WHERE production_plan_line_id = %s;
                """,
                (
                    payload.planned_qty,
                    payload.is_priority,
                    payload.priority_note,
                    payload.line_comment,
                    production_plan_line_id,
                ),
            )
        connection.commit()
        return require_production_plan_exists(connection, production_plan_id)
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось обновить строку плана выпуска.") from exc
    finally:
        if connection is not None:
            connection.close()


@router.delete("/lines/{production_plan_line_id}", response_model=ProductionPlanLineDeleteResponse)
def delete_production_plan_line(production_plan_line_id: int = Path(..., gt=0)):
    connection = None
    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            production_plan_id = get_plan_id_by_line_id(cursor, production_plan_line_id, lock=True)
            ensure_plan_is_draft(cursor, production_plan_id)
            cursor.execute(
                """
                DELETE FROM production_plan_lines
                WHERE production_plan_line_id = %s
                RETURNING production_plan_line_id;
                """,
                (production_plan_line_id,),
            )
            deleted = cursor.fetchone()
            if deleted is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Строка плана выпуска не найдена.")
        connection.commit()
        return {"production_plan_line_id": int(deleted["production_plan_line_id"]), "message": "Строка плана выпуска удалена."}
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось удалить строку плана выпуска.") from exc
    finally:
        if connection is not None:
            connection.close()
