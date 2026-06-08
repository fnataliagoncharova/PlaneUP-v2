from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator


class DowntimeReasonBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    reason_code: str
    reason_name: str
    reason_category: str
    comment: str | None = None

    @field_validator("comment")
    @classmethod
    def normalize_comment(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized_value = value.strip()
        return normalized_value or None


class DowntimeReasonCreate(DowntimeReasonBase):
    pass


class DowntimeReasonUpdate(DowntimeReasonBase):
    pass


class DowntimeReasonRead(BaseModel):
    downtime_reason_id: int
    reason_code: str
    reason_name: str
    reason_category: str
    comment: str | None = None
    created_at: datetime
    updated_at: datetime


class DowntimeReasonDeleteResponse(BaseModel):
    downtime_reason_id: int
    message: str
