from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class EquipmentMaintenanceBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    machine_id: int
    started_at: datetime
    ended_at: datetime
    comment: str | None = None

    @field_validator("comment")
    @classmethod
    def normalize_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized_value = value.strip()
        return normalized_value or None


class EquipmentMaintenanceCreate(EquipmentMaintenanceBase):
    pass


class EquipmentMaintenanceUpdate(EquipmentMaintenanceBase):
    pass


class EquipmentMaintenanceRead(BaseModel):
    maintenance_id: int
    machine_id: int
    machine_code: str
    machine_name: str
    started_at: datetime
    ended_at: datetime
    duration_minutes: int
    duration_hours: float
    comment: str | None = None
    created_at: datetime
    updated_at: datetime
