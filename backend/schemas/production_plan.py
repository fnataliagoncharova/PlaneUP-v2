from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


class ProductionPlanLineRead(BaseModel):
    production_plan_line_id: int
    production_plan_id: int
    nomenclature_id: int
    nomenclature_code: str
    nomenclature_name: str
    planned_qty: Decimal
    unit_of_measure: str
    is_priority: bool
    priority_note: str | None = None
    line_comment: str | None = None
    created_at: datetime
    updated_at: datetime


class ProductionPlanRead(BaseModel):
    production_plan_id: int
    plan_month: date
    source_balance_date: date | None = None
    source_calculated_at: datetime | None = None
    plan_name: str
    status: Literal["draft", "approved"]
    comment: str | None = None
    created_at: datetime
    updated_at: datetime
    lines: list[ProductionPlanLineRead] = Field(default_factory=list)


class ProductionPlanSummary(BaseModel):
    production_plan_id: int
    plan_month: date
    source_balance_date: date | None = None
    source_calculated_at: datetime | None = None
    plan_name: str
    status: Literal["draft", "approved"]
    comment: str | None = None
    line_count: int
    priority_count: int
    created_at: datetime
    updated_at: datetime


class ProductionPlanCreate(BaseModel):
    plan_month: date
    source_balance_date: date | None = None
    source_calculated_at: datetime | None = None
    plan_name: str | None = None
    comment: str | None = None


class ProductionPlanUpdate(BaseModel):
    plan_name: str | None = None
    status: Literal["draft", "approved"] | None = None
    comment: str | None = None


class ProductionPlanLineCreate(BaseModel):
    nomenclature_id: int = Field(gt=0)
    planned_qty: Decimal = Field(gt=0)
    is_priority: bool = False
    priority_note: str | None = None
    line_comment: str | None = None


class ProductionPlanLineUpdate(BaseModel):
    planned_qty: Decimal = Field(gt=0)
    is_priority: bool
    priority_note: str | None = None
    line_comment: str | None = None


class ProductionPlanDeleteResponse(BaseModel):
    production_plan_id: int
    message: str


class ProductionPlanLineDeleteResponse(BaseModel):
    production_plan_line_id: int
    message: str


class ProductionPlanFromDemandLine(BaseModel):
    nomenclature_id: int = Field(gt=0)
    required_qty: Decimal = Field(gt=0)
    is_priority: bool = False
    priority_note: str | None = None
    line_comment: str | None = None


class ProductionPlanFromDemandCreate(BaseModel):
    plan_month: date
    source_balance_date: date | None = None
    source_calculated_at: datetime | None = None
    plan_name: str | None = None
    comment: str | None = None
    lines: list[ProductionPlanFromDemandLine] = Field(default_factory=list)


class ProductionPlanRefreshFromDemandLine(BaseModel):
    nomenclature_id: int = Field(gt=0)
    required_qty: Decimal = Field(gt=0)


class ProductionPlanRefreshFromDemandRequest(BaseModel):
    source_balance_date: date | None = None
    source_calculated_at: datetime | None = None
    comment: str | None = None
    lines: list[ProductionPlanRefreshFromDemandLine] = Field(default_factory=list)
