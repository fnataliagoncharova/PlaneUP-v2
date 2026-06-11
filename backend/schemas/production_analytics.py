from datetime import date

from pydantic import BaseModel


class MonthlyOutputAnalyticsSummary(BaseModel):
    planned_qty_total: float
    actual_qty_total: float
    remaining_qty_total: float
    completion_percent: float
    underproduced_items_count: int
    overproduced_items_count: int
    no_actual_items_count: int
    no_plan_items_count: int


class MonthlyOutputAnalyticsProblemItem(BaseModel):
    nomenclature_id: int
    item_code: str
    item_name: str
    planned_qty: float
    actual_qty: float
    remaining_qty: float
    completion_percent: float | None = None
    status: str
    status_label: str


class MonthlyOutputAnalyticsItem(BaseModel):
    nomenclature_id: int
    item_code: str
    item_name: str
    planned_qty: float
    actual_qty: float
    remaining_qty: float
    deviation_qty: float
    completion_percent: float | None = None
    status: str
    status_label: str


class MonthlyOutputAnalyticsResponse(BaseModel):
    month: str
    date_from: date
    date_to: date
    summary: MonthlyOutputAnalyticsSummary
    top_problem_items: list[MonthlyOutputAnalyticsProblemItem]
    items: list[MonthlyOutputAnalyticsItem]
