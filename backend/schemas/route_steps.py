from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RouteStepBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    step_no: int = Field(gt=0)
    process_id: int = Field(gt=0)
    output_nomenclature_id: int = Field(gt=0)
    output_qty: Decimal = Field(gt=0)
    notes: str | None = None

    @field_validator("notes")
    @classmethod
    def normalize_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized_value = value.strip()
        return normalized_value or None


class RouteStepCreate(RouteStepBase):
    pass


class RouteStepUpdate(RouteStepBase):
    pass


class RouteStepRead(RouteStepBase):
    route_step_id: int
    route_id: int
