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


class MonthlyOutputAnalyticsSummaryByUnit(BaseModel):
    unit: str
    planned_qty_total: float
    actual_qty_total: float
    remaining_qty_total: float


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
    summary_by_unit: list[MonthlyOutputAnalyticsSummaryByUnit]
    top_problem_items: list[MonthlyOutputAnalyticsProblemItem]
    items: list[MonthlyOutputAnalyticsItem]


class EquipmentMonthlyAnalyticsSummary(BaseModel):
    equipment_in_plan_count: int
    average_load_percent: float
    overloaded_equipment_count: int
    high_load_equipment_count: int
    total_downtime_hours: float
    planned_maintenance_hours: float
    unplanned_downtime_hours: float
    unplanned_share_percent: float


class EquipmentMonthlyLoadItem(BaseModel):
    equipment_id: int
    equipment_code: str
    equipment_name: str
    available_hours: float
    planned_load_hours: float | None = None
    planned_maintenance_hours: float = 0.0
    remaining_hours: float
    load_percent: float | None = None
    status: str
    status_label: str
    warning: str | None = None


class EquipmentMonthlyDowntimeItem(BaseModel):
    equipment_id: int
    equipment_code: str
    equipment_name: str
    reason_id: int
    reason_code: str | None = None
    reason_name: str
    reason_category: str
    downtime_count: int
    downtime_hours: float


class EquipmentMonthlyDowntimeCategoryItem(BaseModel):
    category: str
    downtime_count: int
    downtime_hours: float
    share_percent: float


class EquipmentMonthlyAnalyticsResponse(BaseModel):
    month: str
    date_from: date
    date_to: date
    summary: EquipmentMonthlyAnalyticsSummary
    equipment_load: list[EquipmentMonthlyLoadItem]
    downtime_by_category: list[EquipmentMonthlyDowntimeCategoryItem]
    downtimes: list[EquipmentMonthlyDowntimeItem]
