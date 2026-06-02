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
