from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DemandCalculateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    plan_date: date
    balance_date: date | None = None
    nomenclature_ids: list[int] | None = None

    @field_validator("nomenclature_ids")
    @classmethod
    def validate_nomenclature_ids(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return None

        unique_ids = []
        seen_ids: set[int] = set()
        for nomenclature_id in value:
            if nomenclature_id <= 0:
                raise ValueError("ID номенклатуры должен быть больше 0.")

            if nomenclature_id not in seen_ids:
                unique_ids.append(nomenclature_id)
                seen_ids.add(nomenclature_id)

        if not unique_ids:
            return None

        return unique_ids


class TopLevelDemandItem(BaseModel):
    nomenclature_id: int
    nomenclature_code: str
    nomenclature_name: str
    sales_plan_qty: Decimal
    safety_stock_qty: Decimal
    available_qty: Decimal
    gross_demand_qty: Decimal
    net_production_demand_qty: Decimal


class NomenclatureDemandItem(BaseModel):
    nomenclature_id: int
    nomenclature_code: str
    nomenclature_name: str
    required_qty: Decimal


class ExternalDemandItem(BaseModel):
    nomenclature_id: int | None = None
    nomenclature_code: str | None = None
    nomenclature_name: str | None = None
    external_input_name: str | None = None
    required_qty: Decimal


class DemandProblemItem(BaseModel):
    problem_code: str
    message: str
    nomenclature_id: int | None = None
    nomenclature_code: str | None = None
    route_id: int | None = None
    details: str | None = None


class DemandCalculateResponse(BaseModel):
    plan_date: date
    balance_date: date
    top_level_demand: list[TopLevelDemandItem]
    internal_production_demand: list[NomenclatureDemandItem]
    external_demand: list[ExternalDemandItem]
    problems: list[DemandProblemItem]
