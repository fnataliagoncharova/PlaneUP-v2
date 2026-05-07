from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


class ProductionActualCreate(BaseModel):
    production_week_line_id: int
    actual_date: date
    shift_type: str
    shift_team_no: int
    actual_qty: Decimal
    machine_id: int | None = None
    comment: str | None = None


class ProductionActualUpdate(BaseModel):
    actual_date: date | None = None
    shift_type: str | None = None
    shift_team_no: int | None = None
    actual_qty: Decimal | None = None
    machine_id: int | None = None
    comment: str | None = None


class ProductionActualRead(BaseModel):
    production_actual_id: int
    production_week_line_id: int
    production_plan_week_id: int
    week_no: int
    actual_date: date
    shift_type: str
    shift_team_no: int
    nomenclature_id: int
    nomenclature_code: str
    nomenclature_name: str
    actual_qty: Decimal
    unit_of_measure: str
    machine_id: int | None = None
    machine_code: str | None = None
    machine_name: str | None = None
    comment: str | None = None
    created_at: datetime
    updated_at: datetime


class ProductionActualDeleteResponse(BaseModel):
    production_actual_id: int
    message: str
