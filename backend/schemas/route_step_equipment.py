from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


ALLOWED_EQUIPMENT_ROLES = {"primary", "alternative"}
ALLOWED_RATE_UOMS = {"м²/мин", "м.п./мин"}


class RouteStepEquipmentBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    machine_id: int = Field(gt=0)
    equipment_role: str = Field(min_length=1)
    priority: int = Field(gt=0)
    nominal_rate: Decimal = Field(gt=0)
    min_batch_qty: Decimal | None = Field(default=None, gt=0)
    rate_uom: str = Field(min_length=1)
    is_active: bool = True

    @field_validator("equipment_role")
    @classmethod
    def validate_equipment_role(cls, value: str) -> str:
        normalized_value = value.strip().lower()

        if normalized_value not in ALLOWED_EQUIPMENT_ROLES:
            raise ValueError("Роль оборудования должна быть primary или alternative.")

        return normalized_value

    @field_validator("rate_uom")
    @classmethod
    def validate_rate_uom(cls, value: str) -> str:
        normalized_value = value.strip()

        if normalized_value not in ALLOWED_RATE_UOMS:
            raise ValueError("Единица производительности должна быть м²/мин или м.п./мин.")

        return normalized_value


class RouteStepEquipmentCreate(RouteStepEquipmentBase):
    pass


class RouteStepEquipmentUpdate(RouteStepEquipmentBase):
    pass


class RouteStepEquipmentRead(RouteStepEquipmentBase):
    step_equipment_id: int
    route_step_id: int
