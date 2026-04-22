from pydantic import BaseModel, ConfigDict, Field, field_validator


ALLOWED_UNITS = {"м²", "м.п."}


class NomenclatureBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nomenclature_code: str = Field(min_length=1, max_length=120)
    nomenclature_name: str = Field(min_length=1)
    unit_of_measure: str
    is_active: bool = True

    @field_validator("nomenclature_code", "nomenclature_name")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        normalized_value = value.strip()

        if not normalized_value:
            raise ValueError("Поле не может быть пустым.")

        return normalized_value

    @field_validator("unit_of_measure")
    @classmethod
    def validate_unit_of_measure(cls, value: str) -> str:
        normalized_value = value.strip()

        if normalized_value not in ALLOWED_UNITS:
            raise ValueError("Единица измерения может быть только 'м²' или 'м.п.'.")

        return normalized_value


class NomenclatureCreate(NomenclatureBase):
    pass


class NomenclatureUpdate(NomenclatureBase):
    pass


class NomenclatureRead(NomenclatureBase):
    nomenclature_id: int

