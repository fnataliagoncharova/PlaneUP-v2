from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


ALLOWED_UNITS = {"м²", "м.п.", "шт", "кг", "л"}
ALLOWED_ITEM_TYPES = {"manufactured", "purchased"}


class NomenclatureWriteBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nomenclature_code: str = Field(min_length=1, max_length=120)
    nomenclature_name: str = Field(min_length=1)
    unit_of_measure: str
    item_type: Literal["manufactured", "purchased"] = "manufactured"
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
            raise ValueError("Единица измерения должна быть одной из: м², м.п., шт, кг, л.")

        return normalized_value

    @field_validator("item_type")
    @classmethod
    def validate_item_type(cls, value: str) -> str:
        normalized_value = value.strip().lower()
        if normalized_value not in ALLOWED_ITEM_TYPES:
            raise ValueError("Тип номенклатуры должен быть manufactured или purchased.")
        return normalized_value


class NomenclatureCreate(NomenclatureWriteBase):
    pass


class NomenclatureUpdate(NomenclatureWriteBase):
    pass


class NomenclatureRead(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nomenclature_id: int
    nomenclature_code: str
    nomenclature_name: str
    unit_of_measure: str
    item_type: Literal["manufactured", "purchased"] = "manufactured"
    is_active: bool = True


ImportMode = Literal["add_only", "upsert"]
ImportPreviewRowStatus = Literal["new", "update", "conflict", "error"]
ImportCommitRowStatus = Literal["created", "updated", "skipped", "error"]


class NomenclatureImportPreviewRow(BaseModel):
    row_no: int
    nomenclature_code: str | None = None
    nomenclature_name: str | None = None
    unit_of_measure: str | None = None
    item_type: Literal["manufactured", "purchased"] | None = None
    is_active: bool | None = None
    status: ImportPreviewRowStatus
    can_import: bool
    messages: list[str] = Field(default_factory=list)
    unit_normalized_from: str | None = None


class NomenclatureImportPreviewResponse(BaseModel):
    import_mode: ImportMode
    total_rows: int
    valid_rows: int
    new_rows: int
    update_rows: int
    conflict_rows: int
    error_rows: int
    rows: list[NomenclatureImportPreviewRow]


class NomenclatureImportCommitRow(BaseModel):
    row_no: int
    nomenclature_code: str | None = None
    status: ImportCommitRowStatus
    message: str | None = None


class NomenclatureImportCommitResponse(BaseModel):
    import_mode: ImportMode
    total_rows: int
    created_count: int
    updated_count: int
    skipped_count: int
    error_count: int
    conflict_count: int
    rows: list[NomenclatureImportCommitRow]
