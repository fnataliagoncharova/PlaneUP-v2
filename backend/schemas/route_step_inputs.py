from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class RouteStepInputBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    input_nomenclature_id: int = Field(gt=0)
    input_qty: Decimal = Field(gt=0)


class RouteStepInputCreate(RouteStepInputBase):
    pass


class RouteStepInputUpdate(RouteStepInputBase):
    pass


class RouteStepInputRead(RouteStepInputBase):
    step_input_id: int
    route_step_id: int
    input_nomenclature_code: str | None = None
    input_nomenclature_name: str | None = None
    input_nomenclature_uom: str | None = None
    input_nomenclature_item_type: str | None = None
