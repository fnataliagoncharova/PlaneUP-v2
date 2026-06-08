from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EquipmentDowntimeCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    machine_id: int = Field(gt=0)
    downtime_reason_id: int = Field(gt=0)
    started_at: datetime
    ended_at: datetime | None = None
    comment: str | None = None

    @field_validator("comment")
    @classmethod
    def normalize_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized_value = value.strip()
        return normalized_value or None


class EquipmentDowntimeUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    machine_id: int | None = Field(default=None, gt=0)
    downtime_reason_id: int | None = Field(default=None, gt=0)
    started_at: datetime | None = None
    ended_at: datetime | None = None
    comment: str | None = None

    @field_validator("comment")
    @classmethod
    def normalize_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized_value = value.strip()
        return normalized_value or None


class EquipmentDowntimeClose(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    ended_at: datetime
    comment: str | None = None

    @field_validator("comment")
    @classmethod
    def normalize_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized_value = value.strip()
        return normalized_value or None


class EquipmentDowntimeRead(BaseModel):
    downtime_id: int
    machine_id: int
    machine_code: str
    machine_name: str
    downtime_reason_id: int
    reason_code: str
    reason_name: str
    reason_category: str
    started_at: datetime
    ended_at: datetime | None = None
    status: str
    duration_minutes: int | None = None
    duration_hours: float | None = None
    current_duration_minutes: int
    current_duration_hours: float
    comment: str | None = None
    created_at: datetime
    updated_at: datetime
