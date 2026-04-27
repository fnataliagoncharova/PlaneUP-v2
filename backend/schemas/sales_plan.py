from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


SalesPlanImportMode = Literal["upsert"]
SalesPlanImportPreviewRowStatus = Literal["new", "update", "error"]
SalesPlanImportCommitRowStatus = Literal["created", "updated", "skipped", "error"]


class SalesPlanRead(BaseModel):
    sales_plan_id: int
    plan_date: date
    nomenclature_id: int
    nomenclature_code: str
    nomenclature_name: str
    plan_qty: Decimal
    unit_of_measure: str


class SalesPlanImportPreviewRow(BaseModel):
    row_no: int
    plan_date: date | None = None
    nomenclature_code: str | None = None
    nomenclature_name: str | None = None
    plan_qty: Decimal | None = None
    unit_of_measure: str | None = None
    status: SalesPlanImportPreviewRowStatus
    can_import: bool
    messages: list[str] = Field(default_factory=list)
    unit_normalized_from: str | None = None


class SalesPlanImportPreviewResponse(BaseModel):
    import_mode: SalesPlanImportMode
    total_rows: int
    valid_rows: int
    new_rows: int
    update_rows: int
    error_rows: int
    rows: list[SalesPlanImportPreviewRow]


class SalesPlanImportCommitRow(BaseModel):
    row_no: int
    plan_date: date | None = None
    nomenclature_code: str | None = None
    status: SalesPlanImportCommitRowStatus
    message: str | None = None


class SalesPlanImportCommitResponse(BaseModel):
    import_mode: SalesPlanImportMode
    total_rows: int
    created_count: int
    updated_count: int
    skipped_count: int
    error_count: int
    rows: list[SalesPlanImportCommitRow]
