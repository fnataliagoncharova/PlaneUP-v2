from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProcessBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    process_code: str = Field(min_length=1, max_length=120)
    process_name: str = Field(min_length=1)
    is_active: bool = True

    @field_validator("process_code", "process_name")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        normalized_value = value.strip()

        if not normalized_value:
            raise ValueError("Поле не может быть пустым.")

        return normalized_value


class ProcessCreate(ProcessBase):
    pass


class ProcessUpdate(ProcessBase):
    pass


class ProcessRead(ProcessBase):
    process_id: int

