from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class InventoryBalanceDegassingCreate(BaseModel):
    as_of_date: date
    nomenclature_id: int
    qty: Decimal
    available_at: datetime
    comment: str | None = None


class InventoryBalanceDegassingUpdate(BaseModel):
    qty: Decimal
    available_at: datetime
    comment: str | None = None


class InventoryBalanceDegassingRead(BaseModel):
    balance_degassing_id: int
    as_of_date: date
    nomenclature_id: int
    nomenclature_code: str
    nomenclature_name: str
    unit_of_measure: str
    qty: Decimal
    available_at: datetime
    comment: str | None = None
    created_at: datetime
    updated_at: datetime


class InventoryBalanceDegassingDeleteResponse(BaseModel):
    balance_degassing_id: int
    message: str


class InventoryBalanceDegassingImportResponse(BaseModel):
    imported_count: int
    affected_dates: list[date]
    message: str


class InventoryBalanceDegassingSuggestionSourceBatch(BaseModel):
    actual_date: date
    shift_type: str
    actual_qty: Decimal


class InventoryBalanceDegassingSuggestionItem(BaseModel):
    nomenclature_id: int
    nomenclature_code: str
    nomenclature_name: str
    unit_of_measure: str
    actual_date: date | None = None
    shift_type: str | None = None
    actual_qty: Decimal
    shift_finish_at: datetime | None = None
    degassing_hours: Decimal
    available_at: datetime
    status: str
    has_inventory_balance: bool
    inventory_balance_qty: Decimal | None = None
    source_summary: str
    source_batches: list[InventoryBalanceDegassingSuggestionSourceBatch]


class InventoryBalanceDegassingSuggestionReportResponse(BaseModel):
    as_of_date: date
    check_at: datetime
    lookback_days: int
    items: list[InventoryBalanceDegassingSuggestionItem]
