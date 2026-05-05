from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class ProductionWeekLineRead(BaseModel):
    production_week_line_id: int
    production_plan_week_id: int
    production_plan_line_id: int
    route_step_equipment_id: int | None = None
    machine_id: int | None = None
    machine_code: str | None = None
    machine_name: str | None = None
    nomenclature_id: int
    nomenclature_code: str
    nomenclature_name: str
    unit_of_measure: str
    monthly_planned_qty: Decimal
    already_planned_qty: Decimal
    remaining_qty: Decimal
    planned_qty: Decimal
    batch_count: int
    batch_qty: Decimal
    min_batch_qty: Decimal | None = None
    nominal_rate: Decimal | None = None
    rate_uom: str | None = None
    sequence_no: int
    comment: str | None = None
    warnings: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ProductionWeekRead(BaseModel):
    production_plan_week_id: int
    production_plan_id: int
    week_no: int
    week_start_date: date
    week_end_date: date
    status: str
    comment: str | None = None
    created_at: datetime
    updated_at: datetime
    lines: list[ProductionWeekLineRead] = Field(default_factory=list)


class ProductionWeekSummary(BaseModel):
    production_plan_week_id: int
    production_plan_id: int
    week_no: int
    week_start_date: date
    week_end_date: date
    status: str
    comment: str | None = None
    line_count: int
    created_at: datetime
    updated_at: datetime


class ProductionWeekCreate(BaseModel):
    week_no: int = Field(gt=0)
    week_start_date: date
    week_end_date: date
    comment: str | None = None


class ProductionWeekUpdate(BaseModel):
    week_start_date: date | None = None
    week_end_date: date | None = None
    comment: str | None = None


class ProductionWeekLineCreate(BaseModel):
    production_plan_line_id: int = Field(gt=0)
    route_step_equipment_id: int | None = None
    planned_qty: Decimal = Field(gt=0)
    batch_count: int = Field(default=1, gt=0)
    sequence_no: int = Field(default=1, gt=0)
    comment: str | None = None

    @field_validator("planned_qty")
    @classmethod
    def validate_planned_qty_is_integer(cls, value: Decimal) -> Decimal:
        if value != value.to_integral_value():
            raise ValueError("План недели должен быть целым числом.")
        return value


class ProductionWeekLineUpdate(BaseModel):
    route_step_equipment_id: int | None = None
    planned_qty: Decimal = Field(gt=0)
    batch_count: int = Field(gt=0)
    sequence_no: int = Field(gt=0)
    comment: str | None = None

    @field_validator("planned_qty")
    @classmethod
    def validate_planned_qty_is_integer(cls, value: Decimal) -> Decimal:
        if value != value.to_integral_value():
            raise ValueError("План недели должен быть целым числом.")
        return value


class ProductionWeekDeleteResponse(BaseModel):
    production_plan_week_id: int
    message: str


class ProductionWeekLineDeleteResponse(BaseModel):
    production_week_line_id: int
    message: str
