from datetime import date, datetime
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

DECIMAL_ZERO = Decimal("0")
QTY_SCALE = Decimal("0.001")


def to_decimal(value: Any) -> Decimal:
    if value is None:
        return DECIMAL_ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def format_warning_qty(value: Decimal) -> str:
    normalized = value.quantize(QTY_SCALE)
    text = format(normalized, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    if not text:
        return "0"

    sign = ""
    if text.startswith("-"):
        sign = "-"
        text = text[1:]

    integer_part, _, fractional_part = text.partition(".")
    reversed_digits = integer_part[::-1]
    grouped_reversed = " ".join(reversed_digits[index : index + 3] for index in range(0, len(reversed_digits), 3))
    grouped_integer = grouped_reversed[::-1] or "0"

    if fractional_part:
        return f"{sign}{grouped_integer}.{fractional_part}"
    return f"{sign}{grouped_integer}"


def format_warning_qty_with_uom(value: Decimal, unit_of_measure: str) -> str:
    qty_text = format_warning_qty(value)
    unit_label = str(unit_of_measure or "").strip()
    return f"{qty_text} {unit_label}".strip()


def format_warning_datetime(value: datetime) -> str:
    return value.strftime("%d.%m.%Y %H:%M")


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


def get_route_manufactured_component_requirements(
    cursor: RealDictCursor,
    nomenclature_id: int,
) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT route_id
        FROM routes
        WHERE result_nomenclature_id = %s
          AND is_active = TRUE
        ORDER BY route_id
        LIMIT 1;
        """,
        (nomenclature_id,),
    )
    route_row = cursor.fetchone()
    if route_row is None:
        return {"output_qty": None, "components": []}

    cursor.execute(
        """
        SELECT
            route_step_id,
            output_qty
        FROM route_steps
        WHERE route_id = %s
          AND output_nomenclature_id = %s
        ORDER BY step_no DESC, route_step_id DESC
        LIMIT 1;
        """,
        (route_row["route_id"], nomenclature_id),
    )
    step_row = cursor.fetchone()
    if step_row is None:
        return {"output_qty": None, "components": []}

    cursor.execute(
        """
        SELECT
            n.nomenclature_id,
            n.nomenclature_code,
            n.nomenclature_name,
            n.unit_of_measure,
            SUM(rsi.input_qty) AS input_qty
        FROM route_step_inputs AS rsi
        INNER JOIN nomenclature AS n ON n.nomenclature_id = rsi.input_nomenclature_id
        WHERE rsi.route_step_id = %s
          AND n.item_type = 'manufactured'
        GROUP BY
            n.nomenclature_id,
            n.nomenclature_code,
            n.nomenclature_name,
            n.unit_of_measure
        ORDER BY n.nomenclature_code ASC, n.nomenclature_id ASC;
        """,
        (step_row["route_step_id"],),
    )
    return {
        "output_qty": step_row["output_qty"],
        "components": cursor.fetchall(),
    }


def get_initial_component_balances(
    cursor: RealDictCursor,
    production_plan_id: int,
    component_ids: set[int],
) -> dict[int, Decimal]:
    if not component_ids:
        return {}

    balances = {component_id: DECIMAL_ZERO for component_id in component_ids}

    cursor.execute(
        """
        SELECT source_balance_date
        FROM production_plans
        WHERE production_plan_id = %s;
        """,
        (production_plan_id,),
    )
    plan_row = cursor.fetchone()
    source_balance_date = plan_row["source_balance_date"] if plan_row else None
    if source_balance_date is None:
        return balances

    cursor.execute(
        """
        SELECT
            nomenclature_id,
            COALESCE(available_qty, 0) AS available_qty
        FROM inventory_balance
        WHERE as_of_date = %s
          AND nomenclature_id = ANY(%s);
        """,
        (source_balance_date, list(component_ids)),
    )
    for row in cursor.fetchall():
        balances[int(row["nomenclature_id"])] = to_decimal(row["available_qty"])
    return balances


def get_component_actual_batches_with_availability(
    cursor: RealDictCursor,
    component_ids: set[int],
) -> tuple[datetime, dict[int, list[tuple[datetime, Decimal]]]]:
    cursor.execute("SELECT NOW()::timestamp AS check_at;")
    check_at_row = cursor.fetchone() or {}
    check_at = check_at_row.get("check_at")
    if not isinstance(check_at, datetime):
        check_at = datetime.now()

    if not component_ids:
        return check_at, {}

    cursor.execute(
        """
        WITH wait_hours_by_nomenclature AS (
            SELECT DISTINCT ON (r.result_nomenclature_id)
                r.result_nomenclature_id AS nomenclature_id,
                COALESCE(step_row.post_process_wait_hours, 0) AS post_process_wait_hours
            FROM routes AS r
            INNER JOIN LATERAL (
                SELECT rs.post_process_wait_hours
                FROM route_steps AS rs
                WHERE rs.route_id = r.route_id
                  AND rs.output_nomenclature_id = r.result_nomenclature_id
                ORDER BY rs.step_no DESC, rs.route_step_id DESC
                LIMIT 1
            ) AS step_row ON TRUE
            WHERE r.is_active = TRUE
            ORDER BY
                r.result_nomenclature_id ASC,
                r.route_id ASC
        )
        SELECT
            pa.nomenclature_id,
            COALESCE(pa.actual_qty, 0) AS actual_qty,
            (
                CASE
                    WHEN pa.shift_type = 'day'
                        THEN pa.actual_date::timestamp + INTERVAL '19 hour'
                    ELSE pa.actual_date::timestamp + INTERVAL '1 day' + INTERVAL '7 hour'
                END
                + (COALESCE(rs.post_process_wait_hours, wait_hours.post_process_wait_hours, 0) * INTERVAL '1 hour')
            ) AS available_at
        FROM production_actuals AS pa
        LEFT JOIN production_week_lines AS pwl
            ON pwl.production_week_line_id = pa.production_week_line_id
        LEFT JOIN route_step_equipment AS rse
            ON rse.step_equipment_id = pwl.route_step_equipment_id
        LEFT JOIN route_steps AS rs
            ON rs.route_step_id = rse.route_step_id
        LEFT JOIN wait_hours_by_nomenclature AS wait_hours
            ON wait_hours.nomenclature_id = pa.nomenclature_id
        WHERE pa.nomenclature_id = ANY(%s)
        ORDER BY
            pa.nomenclature_id ASC,
            available_at ASC,
            pa.production_actual_id ASC;
        """,
        (list(component_ids),),
    )

    batches_by_component: dict[int, list[tuple[datetime, Decimal]]] = {}
    for row in cursor.fetchall():
        component_id = int(row["nomenclature_id"])
        actual_qty = to_decimal(row["actual_qty"])
        available_at = row["available_at"]
        if actual_qty <= DECIMAL_ZERO or not isinstance(available_at, datetime):
            continue
        batches_by_component.setdefault(component_id, []).append((available_at, actual_qty))

    return check_at, batches_by_component


def split_available_and_degassing_batches(
    check_at: datetime,
    batches: list[tuple[datetime, Decimal]],
) -> tuple[Decimal, list[tuple[datetime, Decimal]]]:
    available_now_qty = DECIMAL_ZERO
    degassing_batches: list[tuple[datetime, Decimal]] = []

    for available_at, qty in batches:
        if available_at <= check_at:
            available_now_qty += qty
        else:
            degassing_batches.append((available_at, qty))

    return available_now_qty, degassing_batches


def group_degassing_batches(
    batches: list[tuple[datetime, Decimal]],
) -> list[tuple[datetime, Decimal]]:
    if not batches:
        return []

    grouped: list[tuple[datetime, Decimal]] = []
    for available_at, qty in batches:
        if grouped and grouped[-1][0] == available_at:
            prev_available_at, prev_qty = grouped[-1]
            grouped[-1] = (prev_available_at, prev_qty + qty)
        else:
            grouped.append((available_at, qty))
    return grouped


def build_component_availability_warning(
    component_row: dict[str, Any],
    required_qty: Decimal,
    available_now_qty: Decimal,
    shortage_qty: Decimal,
    degassing_batches: list[tuple[datetime, Decimal]],
) -> str:
    code = str(component_row.get("nomenclature_code") or "-")
    name = str(component_row.get("nomenclature_name") or "").strip()
    component_label = f"{code} — {name}" if name else code
    unit_of_measure = str(component_row.get("unit_of_measure") or "").strip()
    required_label = format_warning_qty_with_uom(required_qty, unit_of_measure)
    available_now_label = format_warning_qty_with_uom(available_now_qty, unit_of_measure)
    shortage_label = format_warning_qty_with_uom(shortage_qty, unit_of_measure)

    warning_lines = [
        f"Компонент {component_label}",
        "",
        f"Требуется: {required_label}",
        f"Доступно на текущую дату: {available_now_label}",
        f"Дефицит компонента: {shortage_label}",
    ]

    if degassing_batches:
        warning_lines.extend(["", "В дегазации:"])
        for available_at, qty in degassing_batches:
            qty_label = format_warning_qty_with_uom(qty, unit_of_measure)
            warning_lines.append(f"{qty_label} — доступно с {format_warning_datetime(available_at)}")

    return "\n".join(warning_lines)


def build_component_availability_warnings(
    cursor: RealDictCursor,
    production_plan_id: int,
    production_plan_week_id: int,
    current_week_no: int,
) -> dict[int, list[str]]:
    _ = current_week_no
    cursor.execute(
        """
        SELECT
            pwl.production_week_line_id,
            pwl.planned_qty,
            ppl.nomenclature_id
        FROM production_week_lines AS pwl
        INNER JOIN production_plan_lines AS ppl ON ppl.production_plan_line_id = pwl.production_plan_line_id
        WHERE pwl.production_plan_week_id = %s
        ORDER BY
            pwl.sequence_no ASC,
            pwl.production_week_line_id ASC;
        """,
        (production_plan_week_id,),
    )
    week_lines = cursor.fetchall()
    if not week_lines:
        return {}

    requirements_cache: dict[int, dict[str, Any]] = {}
    component_ids: set[int] = set()
    for row in week_lines:
        line_nomenclature_id = int(row["nomenclature_id"])
        if line_nomenclature_id not in requirements_cache:
            requirements_cache[line_nomenclature_id] = get_route_manufactured_component_requirements(
                cursor,
                line_nomenclature_id,
            )
        route_requirements = requirements_cache[line_nomenclature_id]
        for component in route_requirements["components"]:
            component_ids.add(int(component["nomenclature_id"]))

    initial_balances = get_initial_component_balances(
        cursor=cursor,
        production_plan_id=production_plan_id,
        component_ids=component_ids,
    )
    check_at, actual_batches_by_component = get_component_actual_batches_with_availability(
        cursor=cursor,
        component_ids=component_ids,
    )

    available_now_by_component: dict[int, Decimal] = {}
    degassing_by_component: dict[int, list[tuple[datetime, Decimal]]] = {}
    for component_id in component_ids:
        inventory_qty = initial_balances.get(component_id, DECIMAL_ZERO)
        actual_available_qty, actual_degassing_batches = split_available_and_degassing_batches(
            check_at=check_at,
            batches=actual_batches_by_component.get(component_id, []),
        )
        available_now_by_component[component_id] = inventory_qty + actual_available_qty
        degassing_by_component[component_id] = group_degassing_batches(actual_degassing_batches)

    warnings_by_line: dict[int, list[str]] = {}

    for row in week_lines:
        line_id = int(row["production_week_line_id"])
        line_nomenclature_id = int(row["nomenclature_id"])
        line_planned_qty = to_decimal(row["planned_qty"])

        route_requirements = requirements_cache.get(line_nomenclature_id, {"output_qty": None, "components": []})
        output_qty = to_decimal(route_requirements.get("output_qty"))
        if output_qty <= DECIMAL_ZERO:
            continue

        runs_qty = line_planned_qty / output_qty
        for component in route_requirements["components"]:
            component_id = int(component["nomenclature_id"])
            required_qty = runs_qty * to_decimal(component["input_qty"])
            if required_qty <= DECIMAL_ZERO:
                continue

            available_now_qty = available_now_by_component.get(component_id, DECIMAL_ZERO)
            shortage_qty = required_qty - available_now_qty
            if shortage_qty <= DECIMAL_ZERO:
                continue

            warnings_by_line.setdefault(line_id, []).append(
                build_component_availability_warning(
                    component_row=component,
                    required_qty=required_qty,
                    available_now_qty=available_now_qty,
                    shortage_qty=shortage_qty,
                    degassing_batches=degassing_by_component.get(component_id, []),
                )
            )

    return warnings_by_line


def apply_component_availability_warnings_to_week(
    lines: list[dict[str, Any]],
    component_warnings_by_line: dict[int, list[str]],
) -> None:
    if not component_warnings_by_line:
        return

    for line in lines:
        line_id = int(line["production_week_line_id"])
        extra_warnings = component_warnings_by_line.get(line_id, [])
        if not extra_warnings:
            continue

        existing = set(line.get("warnings", []))
        for warning in extra_warnings:
            if warning in existing:
                continue
            line["warnings"].append(warning)
            existing.add(warning)


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
                ppl.is_priority,
                COALESCE(pa.actual_qty, 0) AS actual_qty,
                COALESCE(monthly_actuals.monthly_actual_qty, 0) AS monthly_actual_qty
            FROM production_week_lines AS pwl
            INNER JOIN production_plan_lines AS ppl ON ppl.production_plan_line_id = pwl.production_plan_line_id
            INNER JOIN nomenclature AS n ON n.nomenclature_id = ppl.nomenclature_id
            LEFT JOIN route_step_equipment AS rse ON rse.step_equipment_id = pwl.route_step_equipment_id
            LEFT JOIN machines AS m ON m.machine_id = rse.machine_id
            LEFT JOIN (
                SELECT
                    production_week_line_id,
                    COALESCE(SUM(actual_qty), 0) AS actual_qty
                FROM production_actuals
                GROUP BY production_week_line_id
            ) AS pa ON pa.production_week_line_id = pwl.production_week_line_id
            LEFT JOIN (
                SELECT
                    pwl.production_plan_line_id,
                    COALESCE(SUM(pa.actual_qty), 0) AS monthly_actual_qty
                FROM production_week_lines AS pwl
                INNER JOIN production_actuals AS pa ON pa.production_week_line_id = pwl.production_week_line_id
                GROUP BY pwl.production_plan_line_id
            ) AS monthly_actuals ON monthly_actuals.production_plan_line_id = ppl.production_plan_line_id
            WHERE pwl.production_plan_week_id = %s
            ORDER BY pwl.sequence_no ASC, ppl.is_priority DESC, n.nomenclature_code ASC;
            """,
            (production_plan_week_id,),
        )
        lines = cursor.fetchall()

        prepared_lines: list[dict[str, Any]] = []
        for row in lines:
            line_total = totals_map.get(int(row["production_plan_line_id"]), DECIMAL_ZERO)
            monthly_planned_qty = to_decimal(row["monthly_planned_qty"])
            remaining_qty = monthly_planned_qty - line_total
            planned_qty = to_decimal(row["planned_qty"])
            actual_qty_raw = to_decimal(row["actual_qty"])
            monthly_actual_qty_raw = to_decimal(row["monthly_actual_qty"])
            remaining_to_produce_qty_raw = planned_qty - actual_qty_raw if actual_qty_raw < planned_qty else DECIMAL_ZERO
            overproduction_qty_raw = actual_qty_raw - planned_qty if actual_qty_raw > planned_qty else DECIMAL_ZERO
            monthly_remaining_to_produce_qty_raw = (
                monthly_planned_qty - monthly_actual_qty_raw if monthly_actual_qty_raw < monthly_planned_qty else DECIMAL_ZERO
            )
            monthly_overproduction_qty_raw = (
                monthly_actual_qty_raw - monthly_planned_qty if monthly_actual_qty_raw > monthly_planned_qty else DECIMAL_ZERO
            )
            completion_percent = DECIMAL_ZERO
            if planned_qty > DECIMAL_ZERO:
                completion_percent = (actual_qty_raw / planned_qty) * Decimal("100")

            actual_qty = actual_qty_raw.quantize(QTY_SCALE)
            monthly_actual_qty = monthly_actual_qty_raw.quantize(QTY_SCALE)
            monthly_remaining_to_produce_qty = monthly_remaining_to_produce_qty_raw.quantize(QTY_SCALE)
            monthly_overproduction_qty = monthly_overproduction_qty_raw.quantize(QTY_SCALE)
            remaining_to_produce_qty = remaining_to_produce_qty_raw.quantize(QTY_SCALE)
            overproduction_qty = overproduction_qty_raw.quantize(QTY_SCALE)
            completion_percent = completion_percent.quantize(QTY_SCALE)
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
                "actual_qty": actual_qty,
                "monthly_actual_qty": monthly_actual_qty,
                "monthly_remaining_to_produce_qty": monthly_remaining_to_produce_qty,
                "monthly_overproduction_qty": monthly_overproduction_qty,
                "remaining_to_produce_qty": remaining_to_produce_qty,
                "completion_percent": completion_percent,
                "overproduction_qty": overproduction_qty,
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

        component_warnings_by_line = build_component_availability_warnings(
            cursor=cursor,
            production_plan_id=int(week_row["production_plan_id"]),
            production_plan_week_id=production_plan_week_id,
            current_week_no=int(week_row["week_no"]),
        )
        apply_component_availability_warnings_to_week(prepared_lines, component_warnings_by_line)

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
                SELECT
                    COUNT(*) AS actual_count
                FROM production_actuals AS pa
                JOIN production_week_lines AS pwl
                    ON pwl.production_week_line_id = pa.production_week_line_id
                WHERE pwl.production_plan_week_id = %s;
                """,
                (production_plan_week_id,),
            )
            actuals_row = cursor.fetchone()
            if int(actuals_row["actual_count"] or 0) > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Нельзя удалить недельный план: по его строкам уже внесён факт производства. "
                        "Сначала удалите записи факта в Журнале выполнения."
                    ),
                )
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
                SELECT
                    COUNT(*) AS actual_count,
                    COALESCE(SUM(actual_qty), 0) AS actual_qty
                FROM production_actuals
                WHERE production_week_line_id = %s;
                """,
                (production_week_line_id,),
            )
            actuals_row = cursor.fetchone()
            if int(actuals_row["actual_count"] or 0) > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Нельзя удалить строку недельного плана: по ней уже внесён факт производства. "
                        "Сначала удалите записи факта в Журнале выполнения."
                    ),
                )
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

