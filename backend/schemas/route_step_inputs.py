from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic_core import PydanticCustomError


class RouteStepInputBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    input_nomenclature_id: int | None = Field(default=None, gt=0)
    external_input_name: str | None = None
    input_qty: Decimal = Field(gt=0)

    @field_validator("external_input_name")
    @classmethod
    def normalize_external_input_name(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized_value = value.strip()
        return normalized_value or None

    @model_validator(mode="after")
    def validate_input_source(self):
        if self.input_nomenclature_id is None and self.external_input_name is None:
            raise PydanticCustomError(
                "route_step_input_source_required",
                "Заполните номенклатуру или внешний вход.",
            )

        return self


class RouteStepInputCreate(RouteStepInputBase):
    pass


class RouteStepInputUpdate(RouteStepInputBase):
    pass


class RouteStepInputRead(RouteStepInputBase):
    step_input_id: int
    route_step_id: int
