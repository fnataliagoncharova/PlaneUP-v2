import re
from datetime import date
from decimal import Decimal
from typing import Any

import psycopg2
from fastapi import APIRouter, HTTPException, Query, status
from psycopg2.extras import RealDictCursor

from db import get_connection
from schemas.production_analytics import (
    MonthlyOutputAnalyticsItem,
    MonthlyOutputAnalyticsProblemItem,
    MonthlyOutputAnalyticsResponse,
    MonthlyOutputAnalyticsSummary,
)


router = APIRouter(prefix="/production-analytics", tags=["production_analytics"])

DECIMAL_ZERO = Decimal("0")
MONTH_PATTERN = re.compile(r"^\d{4}-\d{2}$")

STATUS_NO_ACTUAL = "no_actual"
STATUS_IN_PROGRESS = "in_progress"
STATUS_COMPLETED = "completed"
STATUS_OVERPRODUCED = "overproduced"
STATUS_NO_PLAN = "no_plan"

STATUS_LABELS = {
    STATUS_NO_ACTUAL: "Нет факта",
    STATUS_IN_PROGRESS: "В работе",
    STATUS_COMPLETED: "Выполнено",
    STATUS_OVERPRODUCED: "Перевыпуск",
    STATUS_NO_PLAN: "Нет плана",
}


def parse_month_value(value: str) -> date:
    normalized_value = str(value or "").strip()
    if not MONTH_PATTERN.fullmatch(normalized_value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Параметр month должен быть в формате YYYY-MM.",
        )

    try:
        year, month = normalized_value.split("-")
        return date(int(year), int(month), 1)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Параметр month должен быть в формате YYYY-MM.",
        ) from exc


def get_next_month(month_start: date) -> date:
    if month_start.month == 12:
        return date(month_start.year + 1, 1, 1)
    return date(month_start.year, month_start.month + 1, 1)


def to_decimal(value: Any) -> Decimal:
    if value is None:
        return DECIMAL_ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def to_qty_float(value: Decimal) -> float:
    return round(float(value), 3)


def to_percent_float(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return round(float(value), 1)


def build_empty_summary() -> MonthlyOutputAnalyticsSummary:
    return MonthlyOutputAnalyticsSummary(
        planned_qty_total=0.0,
        actual_qty_total=0.0,
        remaining_qty_total=0.0,
        completion_percent=0.0,
        underproduced_items_count=0,
        overproduced_items_count=0,
        no_actual_items_count=0,
        no_plan_items_count=0,
    )


def build_item_status(planned_qty: Decimal, actual_qty: Decimal) -> tuple[str, str]:
    if planned_qty <= DECIMAL_ZERO and actual_qty > DECIMAL_ZERO:
        return STATUS_NO_PLAN, STATUS_LABELS[STATUS_NO_PLAN]
    if planned_qty > DECIMAL_ZERO and actual_qty <= DECIMAL_ZERO:
        return STATUS_NO_ACTUAL, STATUS_LABELS[STATUS_NO_ACTUAL]
    if planned_qty > DECIMAL_ZERO and actual_qty < planned_qty:
        return STATUS_IN_PROGRESS, STATUS_LABELS[STATUS_IN_PROGRESS]
    if planned_qty > DECIMAL_ZERO and actual_qty == planned_qty:
        return STATUS_COMPLETED, STATUS_LABELS[STATUS_COMPLETED]
    if planned_qty > DECIMAL_ZERO and actual_qty > planned_qty:
        return STATUS_OVERPRODUCED, STATUS_LABELS[STATUS_OVERPRODUCED]
    return STATUS_COMPLETED, STATUS_LABELS[STATUS_COMPLETED]


@router.get("/monthly-output", response_model=MonthlyOutputAnalyticsResponse)
def get_monthly_output_analytics(
    month: str = Query(...),
    only_with_deviations: bool = Query(default=False),
):
    month_start = parse_month_value(month)
    month_end = get_next_month(month_start)
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                WITH selected_plan AS (
                    SELECT production_plan_id
                    FROM production_plans
                    WHERE plan_month = %s
                    LIMIT 1
                ),
                plan_items AS (
                    SELECT
                        ppl.nomenclature_id,
                        n.nomenclature_code AS item_code,
                        n.nomenclature_name AS item_name,
                        COALESCE(SUM(ppl.planned_qty), 0) AS planned_qty
                    FROM production_plan_lines AS ppl
                    INNER JOIN selected_plan AS sp ON sp.production_plan_id = ppl.production_plan_id
                    INNER JOIN nomenclature AS n ON n.nomenclature_id = ppl.nomenclature_id
                    GROUP BY
                        ppl.nomenclature_id,
                        n.nomenclature_code,
                        n.nomenclature_name
                ),
                actual_items AS (
                    SELECT
                        pa.nomenclature_id,
                        n.nomenclature_code AS item_code,
                        n.nomenclature_name AS item_name,
                        COALESCE(SUM(pa.actual_qty), 0) AS actual_qty
                    FROM production_actuals AS pa
                    INNER JOIN nomenclature AS n ON n.nomenclature_id = pa.nomenclature_id
                    WHERE pa.actual_date >= %s
                      AND pa.actual_date < %s
                    GROUP BY
                        pa.nomenclature_id,
                        n.nomenclature_code,
                        n.nomenclature_name
                )
                SELECT
                    COALESCE(plan_items.nomenclature_id, actual_items.nomenclature_id) AS nomenclature_id,
                    COALESCE(plan_items.item_code, actual_items.item_code) AS item_code,
                    COALESCE(plan_items.item_name, actual_items.item_name) AS item_name,
                    COALESCE(plan_items.planned_qty, 0) AS planned_qty,
                    COALESCE(actual_items.actual_qty, 0) AS actual_qty
                FROM plan_items
                FULL OUTER JOIN actual_items
                    ON actual_items.nomenclature_id = plan_items.nomenclature_id
                ORDER BY
                    COALESCE(plan_items.item_code, actual_items.item_code) ASC,
                    COALESCE(plan_items.item_name, actual_items.item_name) ASC;
                """,
                (month_start, month_start, month_end),
            )
            rows = cursor.fetchall()

        items: list[MonthlyOutputAnalyticsItem] = []
        planned_qty_total = DECIMAL_ZERO
        actual_qty_total = DECIMAL_ZERO
        remaining_qty_total = DECIMAL_ZERO
        underproduced_items_count = 0
        overproduced_items_count = 0
        no_actual_items_count = 0
        no_plan_items_count = 0

        for row in rows:
            nomenclature_id = int(row["nomenclature_id"])
            item_code = str(row["item_code"] or "").strip()
            item_name = str(row["item_name"] or "").strip()
            planned_qty = to_decimal(row["planned_qty"])
            actual_qty = to_decimal(row["actual_qty"])
            remaining_qty = planned_qty - actual_qty if actual_qty < planned_qty else DECIMAL_ZERO
            deviation_qty = actual_qty - planned_qty

            completion_percent: Decimal | None = None
            if planned_qty > DECIMAL_ZERO:
                completion_percent = (actual_qty / planned_qty) * Decimal("100")

            status, status_label = build_item_status(planned_qty, actual_qty)

            planned_qty_total += planned_qty
            actual_qty_total += actual_qty
            remaining_qty_total += remaining_qty

            if status == STATUS_IN_PROGRESS:
                underproduced_items_count += 1
            elif status == STATUS_OVERPRODUCED:
                overproduced_items_count += 1
            elif status == STATUS_NO_ACTUAL:
                no_actual_items_count += 1
                underproduced_items_count += 1
            elif status == STATUS_NO_PLAN:
                no_plan_items_count += 1

            item = MonthlyOutputAnalyticsItem(
                nomenclature_id=nomenclature_id,
                item_code=item_code,
                item_name=item_name,
                planned_qty=to_qty_float(planned_qty),
                actual_qty=to_qty_float(actual_qty),
                remaining_qty=to_qty_float(remaining_qty),
                deviation_qty=to_qty_float(deviation_qty),
                completion_percent=to_percent_float(completion_percent),
                status=status,
                status_label=status_label,
            )
            items.append(item)

        filtered_items = items
        if only_with_deviations:
            filtered_items = [item for item in items if item.status != STATUS_COMPLETED]

        top_problem_items = sorted(
            (
                MonthlyOutputAnalyticsProblemItem(
                    nomenclature_id=item.nomenclature_id,
                    item_code=item.item_code,
                    item_name=item.item_name,
                    planned_qty=item.planned_qty,
                    actual_qty=item.actual_qty,
                    remaining_qty=item.remaining_qty,
                    completion_percent=item.completion_percent,
                    status=item.status,
                    status_label=item.status_label,
                )
                for item in items
                if item.status in {STATUS_NO_ACTUAL, STATUS_IN_PROGRESS}
            ),
            key=lambda item: (-item.remaining_qty, -item.planned_qty, item.item_code),
        )[:5]

        completion_percent_total = (
            (actual_qty_total / planned_qty_total) * Decimal("100")
            if planned_qty_total > DECIMAL_ZERO
            else DECIMAL_ZERO
        )

        summary = build_empty_summary()
        if items:
            summary = MonthlyOutputAnalyticsSummary(
                planned_qty_total=to_qty_float(planned_qty_total),
                actual_qty_total=to_qty_float(actual_qty_total),
                remaining_qty_total=to_qty_float(remaining_qty_total),
                completion_percent=to_percent_float(completion_percent_total) or 0.0,
                underproduced_items_count=underproduced_items_count,
                overproduced_items_count=overproduced_items_count,
                no_actual_items_count=no_actual_items_count,
                no_plan_items_count=no_plan_items_count,
            )

        return MonthlyOutputAnalyticsResponse(
            month=month_start.strftime("%Y-%m"),
            date_from=month_start,
            date_to=month_end,
            summary=summary,
            top_problem_items=top_problem_items,
            items=filtered_items,
        )
    except HTTPException:
        raise
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить аналитику выпуска за месяц.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()
