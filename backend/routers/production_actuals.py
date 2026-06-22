from datetime import date
from decimal import Decimal
from typing import Any

import psycopg2
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from psycopg2.extras import RealDictCursor

from auth.rbac import require_roles
from db import get_connection
from schemas.production_actual import (
    ProductionActualCreate,
    ProductionActualDeleteResponse,
    ProductionActualRead,
    ProductionActualUpdate,
)


router = APIRouter(prefix="/production-actuals", tags=["production_actuals"])

MASTER_WORKSPACE_READ_ROLES = ("master", "planner", "viewer")
MASTER_WORKSPACE_WRITE_ROLES = ("master",)

DECIMAL_ZERO = Decimal("0")
SHIFT_TYPES = {"day", "night"}

SELECT_COLUMNS = """
    pa.production_actual_id,
    pa.production_week_line_id,
    pw.production_plan_week_id,
    pw.week_no,
    pa.actual_date,
    pa.shift_type,
    pa.shift_team_no,
    pa.nomenclature_id,
    n.nomenclature_code,
    n.nomenclature_name,
    pa.actual_qty,
    pa.unit_of_measure,
    pa.machine_id,
    m.machine_code,
    m.machine_name,
    pa.comment,
    pa.created_at,
    pa.updated_at
"""


def normalize_shift_type(value: str | None) -> str:
    normalized_value = (value or "").strip().lower()
    if normalized_value not in SHIFT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Тип смены должен быть day или night.",
        )
    return normalized_value


def validate_shift_team_no(value: int | None) -> int:
    if value is None or value < 1 or value > 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Смена / бригада должна быть от 1 до 4.",
        )
    return value


def validate_actual_qty(value: Decimal | None) -> Decimal:
    if value is None or Decimal(str(value)) <= DECIMAL_ZERO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Количество факта должно быть больше нуля.",
        )
    return value


def ensure_machine_exists(cursor: RealDictCursor, machine_id: int) -> None:
    cursor.execute(
        """
        SELECT machine_id
        FROM machines
        WHERE machine_id = %s;
        """,
        (machine_id,),
    )
    if cursor.fetchone() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Оборудование не найдено.",
        )


def require_week_line(cursor: RealDictCursor, production_week_line_id: int) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT
            pwl.production_week_line_id,
            pwl.production_plan_week_id,
            pw.week_no,
            ppl.nomenclature_id,
            n.nomenclature_code,
            n.nomenclature_name,
            ppl.unit_of_measure
        FROM production_week_lines AS pwl
        INNER JOIN production_plan_weeks AS pw ON pw.production_plan_week_id = pwl.production_plan_week_id
        INNER JOIN production_plan_lines AS ppl ON ppl.production_plan_line_id = pwl.production_plan_line_id
        INNER JOIN nomenclature AS n ON n.nomenclature_id = ppl.nomenclature_id
        WHERE pwl.production_week_line_id = %s;
        """,
        (production_week_line_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Строка недельного плана не найдена.",
        )
    return row


def require_production_actual(cursor: RealDictCursor, production_actual_id: int, lock: bool = False) -> dict[str, Any]:
    lock_clause = "FOR UPDATE" if lock else ""
    cursor.execute(
        f"""
        SELECT
            production_actual_id,
            production_week_line_id,
            actual_date,
            shift_type,
            shift_team_no,
            actual_qty,
            machine_id,
            comment
        FROM production_actuals
        WHERE production_actual_id = %s
        {lock_clause};
        """,
        (production_actual_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Факт производства не найден.",
        )
    return row


def get_production_actual_by_id(connection, production_actual_id: int) -> dict[str, Any] | None:
    with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            f"""
            SELECT {SELECT_COLUMNS}
            FROM production_actuals AS pa
            INNER JOIN production_week_lines AS pwl ON pwl.production_week_line_id = pa.production_week_line_id
            INNER JOIN production_plan_weeks AS pw ON pw.production_plan_week_id = pwl.production_plan_week_id
            INNER JOIN nomenclature AS n ON n.nomenclature_id = pa.nomenclature_id
            LEFT JOIN machines AS m ON m.machine_id = pa.machine_id
            WHERE pa.production_actual_id = %s;
            """,
            (production_actual_id,),
        )
        return cursor.fetchone()


def require_production_actual_exists(connection, production_actual_id: int) -> dict[str, Any]:
    row = get_production_actual_by_id(connection, production_actual_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Факт производства не найден.",
        )
    return row


@router.get(
    "",
    response_model=list[ProductionActualRead],
    dependencies=[Depends(require_roles(*MASTER_WORKSPACE_READ_ROLES))],
)
def list_production_actuals(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    production_plan_week_id: int | None = Query(default=None),
    production_week_line_id: int | None = Query(default=None),
    nomenclature_id: int | None = Query(default=None),
    machine_id: int | None = Query(default=None),
    shift_type: str | None = Query(default=None),
    shift_team_no: int | None = Query(default=None),
):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            where_clauses: list[str] = []
            params: list[Any] = []

            if date_from is not None:
                where_clauses.append("pa.actual_date >= %s")
                params.append(date_from)

            if date_to is not None:
                where_clauses.append("pa.actual_date <= %s")
                params.append(date_to)

            if production_plan_week_id is not None:
                where_clauses.append("pw.production_plan_week_id = %s")
                params.append(production_plan_week_id)

            if production_week_line_id is not None:
                where_clauses.append("pa.production_week_line_id = %s")
                params.append(production_week_line_id)

            if nomenclature_id is not None:
                where_clauses.append("pa.nomenclature_id = %s")
                params.append(nomenclature_id)

            if machine_id is not None:
                where_clauses.append("pa.machine_id = %s")
                params.append(machine_id)

            if shift_type is not None:
                where_clauses.append("pa.shift_type = %s")
                params.append(normalize_shift_type(shift_type))

            if shift_team_no is not None:
                where_clauses.append("pa.shift_team_no = %s")
                params.append(validate_shift_team_no(shift_team_no))

            where_sql = ""
            if where_clauses:
                where_sql = "WHERE " + " AND ".join(where_clauses)

            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM production_actuals AS pa
                INNER JOIN production_week_lines AS pwl ON pwl.production_week_line_id = pa.production_week_line_id
                INNER JOIN production_plan_weeks AS pw ON pw.production_plan_week_id = pwl.production_plan_week_id
                INNER JOIN nomenclature AS n ON n.nomenclature_id = pa.nomenclature_id
                LEFT JOIN machines AS m ON m.machine_id = pa.machine_id
                {where_sql}
                ORDER BY pa.actual_date DESC, pa.production_actual_id DESC;
                """,
                tuple(params),
            )
            return cursor.fetchall()
    except HTTPException:
        raise
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить факты производства.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.get(
    "/{production_actual_id}",
    response_model=ProductionActualRead,
    dependencies=[Depends(require_roles(*MASTER_WORKSPACE_READ_ROLES))],
)
def get_production_actual(production_actual_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        return require_production_actual_exists(connection, production_actual_id)
    except HTTPException:
        raise
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить факт производства.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.post(
    "",
    response_model=ProductionActualRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*MASTER_WORKSPACE_WRITE_ROLES))],
)
def create_production_actual(payload: ProductionActualCreate):
    connection = None

    try:
        normalized_shift_type = normalize_shift_type(payload.shift_type)
        validate_shift_team_no(payload.shift_team_no)
        validate_actual_qty(payload.actual_qty)

        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            week_line_row = require_week_line(cursor, payload.production_week_line_id)

            if payload.machine_id is not None:
                ensure_machine_exists(cursor, payload.machine_id)

            cursor.execute(
                """
                INSERT INTO production_actuals (
                    production_week_line_id,
                    actual_date,
                    shift_type,
                    shift_team_no,
                    nomenclature_id,
                    actual_qty,
                    unit_of_measure,
                    machine_id,
                    comment
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING production_actual_id;
                """,
                (
                    payload.production_week_line_id,
                    payload.actual_date,
                    normalized_shift_type,
                    payload.shift_team_no,
                    week_line_row["nomenclature_id"],
                    payload.actual_qty,
                    week_line_row["unit_of_measure"],
                    payload.machine_id,
                    payload.comment,
                ),
            )
            created_row = cursor.fetchone()

        connection.commit()
        return require_production_actual_exists(connection, int(created_row["production_actual_id"]))
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать факт производства.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.put(
    "/{production_actual_id}",
    response_model=ProductionActualRead,
    dependencies=[Depends(require_roles(*MASTER_WORKSPACE_WRITE_ROLES))],
)
def update_production_actual(
    payload: ProductionActualUpdate,
    production_actual_id: int = Path(..., gt=0),
):
    connection = None

    try:
        payload_data = payload.model_dump(exclude_unset=True)
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            current_row = require_production_actual(cursor, production_actual_id, lock=True)

            next_actual_date = payload_data.get("actual_date", current_row["actual_date"])
            next_shift_type = current_row["shift_type"]
            next_shift_team_no = current_row["shift_team_no"]
            next_actual_qty = current_row["actual_qty"]
            next_machine_id = payload_data.get("machine_id", current_row["machine_id"])
            next_comment = payload_data.get("comment", current_row["comment"])

            if "shift_type" in payload_data:
                next_shift_type = normalize_shift_type(payload_data.get("shift_type"))

            if "shift_team_no" in payload_data:
                next_shift_team_no = validate_shift_team_no(payload_data.get("shift_team_no"))

            if "actual_qty" in payload_data:
                next_actual_qty = validate_actual_qty(payload_data.get("actual_qty"))

            if "machine_id" in payload_data and next_machine_id is not None:
                ensure_machine_exists(cursor, next_machine_id)

            cursor.execute(
                """
                UPDATE production_actuals
                SET
                    actual_date = %s,
                    shift_type = %s,
                    shift_team_no = %s,
                    actual_qty = %s,
                    machine_id = %s,
                    comment = %s,
                    updated_at = NOW()
                WHERE production_actual_id = %s;
                """,
                (
                    next_actual_date,
                    next_shift_type,
                    next_shift_team_no,
                    next_actual_qty,
                    next_machine_id,
                    next_comment,
                    production_actual_id,
                ),
            )

        connection.commit()
        return require_production_actual_exists(connection, production_actual_id)
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось обновить факт производства.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.delete(
    "/{production_actual_id}",
    response_model=ProductionActualDeleteResponse,
    dependencies=[Depends(require_roles(*MASTER_WORKSPACE_WRITE_ROLES))],
)
def delete_production_actual(production_actual_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            require_production_actual(cursor, production_actual_id, lock=True)
            cursor.execute(
                """
                DELETE FROM production_actuals
                WHERE production_actual_id = %s
                RETURNING production_actual_id;
                """,
                (production_actual_id,),
            )
            deleted_row = cursor.fetchone()

        connection.commit()
        return {
            "production_actual_id": int(deleted_row["production_actual_id"]),
            "message": "Факт производства удален.",
        }
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось удалить факт производства.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()
