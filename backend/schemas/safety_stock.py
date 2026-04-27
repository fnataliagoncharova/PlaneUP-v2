from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


SafetyStockImportMode = Literal["upsert"]
SafetyStockImportPreviewRowStatus = Literal["new", "update", "error"]
SafetyStockImportCommitRowStatus = Literal["created", "updated", "skipped", "error"]


class SafetyStockRead(BaseModel):
    safety_stock_id: int
    nomenclature_id: int
    nomenclature_code: str
    nomenclature_name: str
    stock_qty: Decimal
    unit_of_measure: str


class SafetyStockImportPreviewRow(BaseModel):
    row_no: int
    nomenclature_code: str | None = None
    nomenclature_name: str | None = None
    stock_qty: Decimal | None = None
    unit_of_measure: str | None = None
    status: SafetyStockImportPreviewRowStatus
    can_import: bool
    messages: list[str] = Field(default_factory=list)
    unit_normalized_from: str | None = None


class SafetyStockImportPreviewResponse(BaseModel):
    import_mode: SafetyStockImportMode
    total_rows: int
    valid_rows: int
    new_rows: int
    update_rows: int
    error_rows: int
    rows: list[SafetyStockImportPreviewRow]


class SafetyStockImportCommitRow(BaseModel):
    row_no: int
    nomenclature_code: str | None = None
    status: SafetyStockImportCommitRowStatus
    message: str | None = None


class SafetyStockImportCommitResponse(BaseModel):
    import_mode: SafetyStockImportMode
    total_rows: int
    created_count: int
    updated_count: int
    skipped_count: int
    error_count: int
    rows: list[SafetyStockImportCommitRow]
