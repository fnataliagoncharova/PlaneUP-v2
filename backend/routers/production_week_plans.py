from datetime import date
from decimal import Decimal
from typing import Any

import psycopg2
from fastapi import APIRouter, HTTPException, Path, status
from psycopg2.errors import CheckViolation, ForeignKeyViolation, UniqueViolation
from psycopg2.extras import RealDictCursor

from db import get_connection
from schemas.production_week_plan import (
    ProductionWeekCreate,
    ProductionWeekDeleteResponse,
    ProductionWeekLineCreate,
    ProductionWeekLineDeleteResponse,
    ProductionWeekLineUpdate,
    ProductionWeekRead,
    ProductionWeekSummary,
    ProductionWeekUpdate,
)


router = APIRouter(tags=["production_week_plans"])
plans_router = APIRouter(prefix="/production-plans", tags=["production_week_plans"])
weeks_router = APIRouter(prefix="/production-week-plans", tags=["production_week_plans"])


WEEK_COLUMNS = """
    pw.production_plan_week_id,
    pw.production_plan_id,
    pw.week_no,
    pw.week_start_date,
    pw.week_end_date,
    pw.status,
    pw.comment,
    pw.created_at,
    pw.updated_at
"""


def get_system_week_bounds(plan_month: date, week_no: int) -> tuple[date, date] | None:
    year = plan_month.year
    month = plan_month.month
    if week_no == 1:
        return date(year, month, 1), date(year, month, 7)
    if week_no == 2:
        return date(year, month, 8), date(year, month, 14)
    if week_no == 3:
        return date(year, month, 15), date(year, month, 21)
    if week_no == 4:
        if month == 12:
            next_month = date(year + 1, 1, 1)
        else:
            next_month = date(year, month + 1, 1)
        last_date = date.fromordinal(next_month.toordinal() - 1)
        return date(year, month, 22), last_date
    return None


def ensure_week_matches_plan_month(
    cursor: RealDictCursor,
    production_plan_id: int,
    week_no: int,
    week_start_date: date,
    week_end_date: date,
) -> None:
    cursor.execute(
        """
        SELECT plan_month
        FROM production_plans
        WHERE production_plan_id = %s;
        """,
        (production_plan_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="План выпуска не найден.")

    expected = get_system_week_bounds(row["plan_month"], week_no)
    if expected is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неделя должна соответствовать периоду месяца планирования.",
        )

    expected_start, expected_end = expected
    if week_start_date != expected_start or week_end_date != expected_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неделя должна соответствовать периоду месяца планирования.",
        )


def require_monthly_plan(cursor: RealDictCursor, production_plan_id: int, lock: bool = False) -> dict[str, Any]:
    lock_clause = "FOR UPDATE" if lock else ""
    cursor.execute(
        f"""
        SELECT production_plan_id, status
        FROM production_plans
        WHERE production_plan_id = %s
        {lock_clause};
        """,
        (production_plan_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="План выпуска не найден.")
    return row


def require_week(cursor: RealDictCursor, production_plan_week_id: int, lock: bool = False) -> dict[str, Any]:
    lock_clause = "FOR UPDATE" if lock else ""
    cursor.execute(
        f"""
        SELECT {WEEK_COLUMNS}
        FROM production_plan_weeks AS pw
        WHERE pw.production_plan_week_id = %s
        {lock_clause};
        """,
        (production_plan_week_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Недельный план не найден.")
    return row


def require_week_line(cursor: RealDictCursor, production_week_line_id: int, lock: bool = False) -> dict[str, Any]:
    lock_clause = "FOR UPDATE" if lock else ""
    cursor.execute(
        f"""
        SELECT
            pwl.production_week_line_id,
            pwl.production_plan_week_id,
            pwl.production_plan_line_id,
            pw.production_plan_id
        FROM production_week_lines AS pwl
        INNER JOIN production_plan_weeks AS pw ON pw.production_plan_week_id = pwl.production_plan_week_id
        WHERE pwl.production_week_line_id = %s
        {lock_clause};
        """,
        (production_week_line_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Строка недельного плана не найдена.")
    return row


def ensure_approved_monthly_plan(cursor: RealDictCursor, production_plan_id: int, lock: bool = False) -> dict[str, Any]:
    row = require_monthly_plan(cursor, production_plan_id, lock=lock)
    if row["status"] != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недельный план можно создать только на основе утверждённого месячного плана.",
        )
    return row


def ensure_route_step_equipment_exists(cursor: RealDictCursor, route_step_equipment_id: int) -> None:
    cursor.execute(
        """
        SELECT step_equipment_id
        FROM route_step_equipment
        WHERE step_equipment_id = %s;
        """,
        (route_step_equipment_id,),
    )
    if cursor.fetchone() is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Оборудование шага не найдено.")


def ensure_plan_line_belongs_to_monthly_plan(
    cursor: RealDictCursor,
    production_plan_line_id: int,
    production_plan_id: int,
) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT
            production_plan_line_id,
            production_plan_id,
            planned_qty,
            nomenclature_id,
            unit_of_measure,
            is_priority
        FROM production_plan_lines
        WHERE production_plan_line_id = %s;
        """,
        (production_plan_line_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Строка плана выпуска не найдена.")
    if int(row["production_plan_id"]) != int(production_plan_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Позиция не относится к выбранному месячному плану.")
    return row


def validate_weekly_qty_limit(
    cursor: RealDictCursor,
    production_plan_line_id: int,
    new_qty: Decimal,
    exclude_week_line_id: int | None = None,
) -> None:
    cursor.execute(
        """
        SELECT planned_qty
        FROM production_plan_lines
        WHERE production_plan_line_id = %s;
        """,
        (production_plan_line_id,),
    )
    line_row = cursor.fetchone()
    if line_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Строка плана выпуска не найдена.")

    if exclude_week_line_id is None:
        cursor.execute(
            """
            SELECT COALESCE(SUM(planned_qty), 0) AS qty_sum
            FROM production_week_lines
            WHERE production_plan_line_id = %s;
            """,
            (production_plan_line_id,),
        )
    else:
        cursor.execute(
            """
            SELECT COALESCE(SUM(planned_qty), 0) AS qty_sum
            FROM production_week_lines
            WHERE production_plan_line_id = %s
              AND production_week_line_id <> %s;
            """,
            (production_plan_line_id, exclude_week_line_id),
        )

    current_sum = cursor.fetchone()["qty_sum"]
    if Decimal(current_sum) + Decimal(new_qty) > Decimal(line_row["planned_qty"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сумма недельных планов превышает месячный план выпуска.",
        )


def build_line_warnings(line_row: dict[str, Any]) -> list[str]:
    warnings: list[str] = []
    if line_row.get("route_step_equipment_id") is None:
        warnings.append("Оборудование не выбрано.")
    min_batch_qty = line_row.get("min_batch_qty")
    batch_qty = line_row.get("batch_qty")
    if min_batch_qty is not None and batch_qty is not None and Decimal(batch_qty) < Decimal(min_batch_qty):
        warnings.append("Размер партии меньше минимальной партии для выбранного оборудования.")
    return warnings


def get_production_week_by_id(connection, production_plan_week_id: int) -> dict[str, Any] | None:
    with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            f"""
            SELECT {WEEK_COLUMNS}
            FROM production_plan_weeks AS pw
            WHERE pw.production_plan_week_id = %s;
            """,
            (production_plan_week_id,),
        )
        week_row = cursor.fetchone()
        if week_row is None:
            return None

        cursor.execute(
            """
            SELECT
                ppl.production_plan_line_id,
                COALESCE(SUM(pwl.planned_qty), 0) AS total_planned_qty
            FROM production_plan_lines AS ppl
            LEFT JOIN production_week_lines AS pwl ON pwl.production_plan_line_id = ppl.production_plan_line_id
            WHERE ppl.production_plan_id = %s
            GROUP BY ppl.production_plan_line_id;
            """,
            (week_row["production_plan_id"],),
        )
        totals_map = {
            int(row["production_plan_line_id"]): Decimal(row["total_planned_qty"])
            for row in cursor.fetchall()
        }

        cursor.execute(
            """
            SELECT
                pwl.production_week_line_id,
                pwl.production_plan_week_id,
                pwl.production_plan_line_id,
                pwl.route_step_equipment_id,
                rse.machine_id,
                m.machine_code,
                m.machine_name,
                ppl.nomenclature_id,
                n.nomenclature_code,
                n.nomenclature_name,
                ppl.unit_of_measure,
                ppl.planned_qty AS monthly_planned_qty,
                pwl.planned_qty,
                pwl.batch_count,
                (pwl.planned_qty / pwl.batch_count::numeric) AS batch_qty,
                rse.min_batch_qty,
                rse.nominal_rate,
                rse.rate_uom,
                pwl.sequence_no,
                pwl.comment,
                pwl.created_at,
                pwl.updated_at,
                ppl.is_priority
            FROM production_week_lines AS pwl
            INNER JOIN production_plan_lines AS ppl ON ppl.production_plan_line_id = pwl.production_plan_line_id
            INNER JOIN nomenclature AS n ON n.nomenclature_id = ppl.nomenclature_id
            LEFT JOIN route_step_equipment AS rse ON rse.step_equipment_id = pwl.route_step_equipment_id
            LEFT JOIN machines AS m ON m.machine_id = rse.machine_id
            WHERE pwl.production_plan_week_id = %s
            ORDER BY pwl.sequence_no ASC, ppl.is_priority DESC, n.nomenclature_code ASC;
            """,
            (production_plan_week_id,),
        )
        lines = cursor.fetchall()

        prepared_lines: list[dict[str, Any]] = []
        for row in lines:
            line_total = totals_map.get(int(row["production_plan_line_id"]), Decimal(0))
            remaining_qty = Decimal(row["monthly_planned_qty"]) - line_total
            line_payload = {
                "production_week_line_id": row["production_week_line_id"],
                "production_plan_week_id": row["production_plan_week_id"],
                "production_plan_line_id": row["production_plan_line_id"],
                "route_step_equipment_id": row["route_step_equipment_id"],
                "machine_id": row["machine_id"],
                "machine_code": row["machine_code"],
                "machine_name": row["machine_name"],
                "nomenclature_id": row["nomenclature_id"],
                "nomenclature_code": row["nomenclature_code"],
                "nomenclature_name": row["nomenclature_name"],
                "unit_of_measure": row["unit_of_measure"],
                "monthly_planned_qty": row["monthly_planned_qty"],
                "already_planned_qty": line_total,
                "remaining_qty": remaining_qty,
                "planned_qty": row["planned_qty"],
                "batch_count": row["batch_count"],
                "batch_qty": row["batch_qty"],
                "min_batch_qty": row["min_batch_qty"],
                "nominal_rate": row["nominal_rate"],
                "rate_uom": row["rate_uom"],
                "sequence_no": row["sequence_no"],
                "comment": row["comment"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
            line_payload["warnings"] = build_line_warnings(line_payload)
            prepared_lines.append(line_payload)

        week_row["lines"] = prepared_lines
        return week_row


def require_week_exists(connection, production_plan_week_id: int) -> dict[str, Any]:
    week = get_production_week_by_id(connection, production_plan_week_id)
    if week is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Недельный план не найден.")
    return week


@plans_router.get("/{production_plan_id}/weeks", response_model=list[ProductionWeekSummary])
def list_production_plan_weeks(production_plan_id: int = Path(..., gt=0)):
    connection = None
    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            require_monthly_plan(cursor, production_plan_id)
            cursor.execute(
                f"""
                SELECT
                    {WEEK_COLUMNS},
                    COUNT(pwl.production_week_line_id)::int AS line_count
                FROM production_plan_weeks AS pw
                LEFT JOIN production_week_lines AS pwl ON pwl.production_plan_week_id = pw.production_plan_week_id
                WHERE pw.production_plan_id = %s
                GROUP BY
                    pw.production_plan_week_id,
                    pw.production_plan_id,
                    pw.week_no,
                    pw.week_start_date,
                    pw.week_end_date,
                    pw.status,
                    pw.comment,
                    pw.created_at,
                    pw.updated_at
                ORDER BY pw.week_no ASC;
                """,
                (production_plan_id,),
            )
            return cursor.fetchall()
    except HTTPException:
        raise
    except psycopg2.Error as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось получить недельные планы.") from exc
    finally:
        if connection is not None:
            connection.close()


@plans_router.post("/{production_plan_id}/weeks", response_model=ProductionWeekRead, status_code=status.HTTP_201_CREATED)
def create_production_plan_week(
    payload: ProductionWeekCreate,
    production_plan_id: int = Path(..., gt=0),
):
    connection = None
    try:
        if payload.week_end_date < payload.week_start_date:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Дата окончания недели не может быть раньше даты начала недели.")

        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            ensure_approved_monthly_plan(cursor, production_plan_id, lock=True)
            ensure_week_matches_plan_month(
                cursor=cursor,
                production_plan_id=production_plan_id,
                week_no=payload.week_no,
                week_start_date=payload.week_start_date,
                week_end_date=payload.week_end_date,
            )
            cursor.execute(
                f"""
                INSERT INTO production_plan_weeks (
                    production_plan_id,
                    week_no,
                    week_start_date,
                    week_end_date,
                    status,
                    comment
                )
                VALUES (%s, %s, %s, %s, 'draft', %s)
                RETURNING production_plan_week_id;
                """,
                (
                    production_plan_id,
                    payload.week_no,
                    payload.week_start_date,
                    payload.week_end_date,
                    payload.comment,
                ),
            )
            created = cursor.fetchone()

        connection.commit()
        return require_week_exists(connection, int(created["production_plan_week_id"]))
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Недельный план с таким номером уже существует.") from exc
    except CheckViolation as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Проверьте номер недели и диапазон дат недели.") from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось создать недельный план.") from exc
    finally:
        if connection is not None:
            connection.close()


@weeks_router.get("/{production_plan_week_id}", response_model=ProductionWeekRead)
def get_production_plan_week(production_plan_week_id: int = Path(..., gt=0)):
    connection = None
    try:
        connection = get_connection()
        return require_week_exists(connection, production_plan_week_id)
    except HTTPException:
        raise
    except psycopg2.Error as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось получить недельный план.") from exc
    finally:
        if connection is not None:
            connection.close()


@weeks_router.put("/{production_plan_week_id}", response_model=ProductionWeekRead)
def update_production_plan_week(
    payload: ProductionWeekUpdate,
    production_plan_week_id: int = Path(..., gt=0),
):
    connection = None
    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            week_row = require_week(cursor, production_plan_week_id, lock=True)
            next_start = payload.week_start_date or week_row["week_start_date"]
            next_end = payload.week_end_date or week_row["week_end_date"]
            if next_end < next_start:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Дата окончания недели не может быть раньше даты начала недели.")

            next_comment = payload.comment if payload.comment is not None else week_row["comment"]
            cursor.execute(
                """
                UPDATE production_plan_weeks
                SET
                    week_start_date = %s,
                    week_end_date = %s,
                    comment = %s,
                    updated_at = NOW()
                WHERE production_plan_week_id = %s;
                """,
                (next_start, next_end, next_comment, production_plan_week_id),
            )

        connection.commit()
        return require_week_exists(connection, production_plan_week_id)
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except CheckViolation as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Проверьте диапазон дат недели.") from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось обновить недельный план.") from exc
    finally:
        if connection is not None:
            connection.close()


@weeks_router.delete("/{production_plan_week_id}", response_model=ProductionWeekDeleteResponse)
def delete_production_plan_week(production_plan_week_id: int = Path(..., gt=0)):
    connection = None
    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            require_week(cursor, production_plan_week_id, lock=True)
            cursor.execute(
                """
                DELETE FROM production_plan_weeks
                WHERE production_plan_week_id = %s
                RETURNING production_plan_week_id;
                """,
                (production_plan_week_id,),
            )
            deleted = cursor.fetchone()

        connection.commit()
        return {
            "production_plan_week_id": int(deleted["production_plan_week_id"]),
            "message": "Недельный план удалён.",
        }
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось удалить недельный план.") from exc
    finally:
        if connection is not None:
            connection.close()


@weeks_router.post("/{production_plan_week_id}/lines", response_model=ProductionWeekRead, status_code=status.HTTP_201_CREATED)
def create_production_week_line(
    payload: ProductionWeekLineCreate,
    production_plan_week_id: int = Path(..., gt=0),
):
    connection = None
    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            week_row = require_week(cursor, production_plan_week_id, lock=True)
            ensure_plan_line_belongs_to_monthly_plan(
                cursor,
                payload.production_plan_line_id,
                week_row["production_plan_id"],
            )

            if payload.route_step_equipment_id is not None:
                ensure_route_step_equipment_exists(cursor, payload.route_step_equipment_id)

            validate_weekly_qty_limit(cursor, payload.production_plan_line_id, payload.planned_qty)

            cursor.execute(
                """
                INSERT INTO production_week_lines (
                    production_plan_week_id,
                    production_plan_line_id,
                    route_step_equipment_id,
                    planned_qty,
                    batch_count,
                    sequence_no,
                    comment
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING production_week_line_id;
                """,
                (
                    production_plan_week_id,
                    payload.production_plan_line_id,
                    payload.route_step_equipment_id,
                    payload.planned_qty,
                    payload.batch_count,
                    payload.sequence_no,
                    payload.comment,
                ),
            )

        connection.commit()
        return require_week_exists(connection, production_plan_week_id)
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()
        constraint_name = getattr(getattr(exc, "diag", None), "constraint_name", None)
        if constraint_name == "production_week_lines_unique_plan_line_per_week":
            detail = "Позиция уже есть в недельном плане."
        else:
            detail = "Не удалось добавить строку недельного плана."
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc
    except (ForeignKeyViolation, CheckViolation) as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Проверьте данные строки недельного плана.") from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось добавить строку недельного плана.") from exc
    finally:
        if connection is not None:
            connection.close()


@weeks_router.put("/lines/{production_week_line_id}", response_model=ProductionWeekRead)
def update_production_week_line(
    payload: ProductionWeekLineUpdate,
    production_week_line_id: int = Path(..., gt=0),
):
    connection = None
    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            line_row = require_week_line(cursor, production_week_line_id, lock=True)

            if payload.route_step_equipment_id is not None:
                ensure_route_step_equipment_exists(cursor, payload.route_step_equipment_id)

            validate_weekly_qty_limit(
                cursor,
                line_row["production_plan_line_id"],
                payload.planned_qty,
                exclude_week_line_id=production_week_line_id,
            )

            cursor.execute(
                """
                UPDATE production_week_lines
                SET
                    route_step_equipment_id = %s,
                    planned_qty = %s,
                    batch_count = %s,
                    sequence_no = %s,
                    comment = %s,
                    updated_at = NOW()
                WHERE production_week_line_id = %s;
                """,
                (
                    payload.route_step_equipment_id,
                    payload.planned_qty,
                    payload.batch_count,
                    payload.sequence_no,
                    payload.comment,
                    production_week_line_id,
                ),
            )

        connection.commit()
        return require_week_exists(connection, int(line_row["production_plan_week_id"]))
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except (ForeignKeyViolation, CheckViolation) as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Проверьте данные строки недельного плана.") from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось обновить строку недельного плана.") from exc
    finally:
        if connection is not None:
            connection.close()


@weeks_router.delete("/lines/{production_week_line_id}", response_model=ProductionWeekLineDeleteResponse)
def delete_production_week_line(production_week_line_id: int = Path(..., gt=0)):
    connection = None
    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            line_row = require_week_line(cursor, production_week_line_id, lock=True)
            cursor.execute(
                """
                DELETE FROM production_week_lines
                WHERE production_week_line_id = %s
                RETURNING production_week_line_id;
                """,
                (production_week_line_id,),
            )
            deleted = cursor.fetchone()

        connection.commit()
        return {
            "production_week_line_id": int(deleted["production_week_line_id"]),
            "message": "Строка недельного плана удалена.",
        }
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось удалить строку недельного плана.") from exc
    finally:
        if connection is not None:
            connection.close()


router.include_router(plans_router)
router.include_router(weeks_router)
