from pydantic import BaseModel, ConfigDict, Field, field_validator


class MachineBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    machine_code: str = Field(min_length=1, max_length=120)
    machine_name: str = Field(min_length=1)
    is_active: bool = True

    @field_validator("machine_code", "machine_name")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        normalized_value = value.strip()

        if not normalized_value:
            raise ValueError("Поле не может быть пустым.")

        return normalized_value


class MachineCreate(MachineBase):
    pass


class MachineUpdate(MachineBase):
    pass


class MachineRead(MachineBase):
    machine_id: int

