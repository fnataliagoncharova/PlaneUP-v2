from typing import Literal

from pydantic import BaseModel, Field, field_validator


UserRole = Literal["admin", "planner", "master", "maintenance", "viewer"]


class UserRead(BaseModel):
    id: int
    username: str
    full_name: str | None = None
    role: UserRole
    is_active: bool


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        normalized_value = value.strip()

        if not normalized_value:
            raise ValueError("Username cannot be empty.")

        return normalized_value


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
