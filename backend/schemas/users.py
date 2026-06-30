from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from schemas.auth import UserRole


class UserAdminRead(BaseModel):
    id: int
    username: str
    full_name: str | None = None
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)
    role: UserRole
    full_name: str | None = None
    is_active: bool = True

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        normalized_value = value.strip()
        if not normalized_value:
            raise ValueError("Username cannot be empty.")
        return normalized_value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        normalized_value = value.strip()
        if not normalized_value:
            raise ValueError("Password cannot be empty.")
        return normalized_value

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized_value = value.strip()
        return normalized_value or None


class UserRoleUpdate(BaseModel):
    role: UserRole


class UserPasswordUpdate(BaseModel):
    password: str = Field(min_length=1)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        normalized_value = value.strip()
        if not normalized_value:
            raise ValueError("Password cannot be empty.")
        return normalized_value


class UserActiveUpdate(BaseModel):
    is_active: bool

