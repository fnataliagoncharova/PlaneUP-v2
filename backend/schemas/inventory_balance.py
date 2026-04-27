from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


InventoryBalanceImportMode = Literal["upsert"]
InventoryBalanceImportPreviewRowStatus = Literal["new", "update", "error"]
InventoryBalanceImportCommitRowStatus = Literal["created", "updated", "skipped", "error"]


class InventoryBalanceRead(BaseModel):
    balance_id: int
    as_of_date: date
    nomenclature_id: int
    nomenclature_code: str
    nomenclature_name: str
    available_qty: Decimal
    unit_of_measure: str


class InventoryBalanceImportPreviewRow(BaseModel):
    row_no: int
    as_of_date: date | None = None
    nomenclature_code: str | None = None
    nomenclature_name: str | None = None
    available_qty: Decimal | None = None
    unit_of_measure: str | None = None
    status: InventoryBalanceImportPreviewRowStatus
    can_import: bool
    messages: list[str] = Field(default_factory=list)
    unit_normalized_from: str | None = None


class InventoryBalanceImportPreviewResponse(BaseModel):
    import_mode: InventoryBalanceImportMode
    total_rows: int
    valid_rows: int
    new_rows: int
    update_rows: int
    error_rows: int
    rows: list[InventoryBalanceImportPreviewRow]


class InventoryBalanceImportCommitRow(BaseModel):
    row_no: int
    as_of_date: date | None = None
    nomenclature_code: str | None = None
    status: InventoryBalanceImportCommitRowStatus
    message: str | None = None


class InventoryBalanceImportCommitResponse(BaseModel):
    import_mode: InventoryBalanceImportMode
    total_rows: int
    created_count: int
    updated_count: int
    skipped_count: int
    error_count: int
    rows: list[InventoryBalanceImportCommitRow]
