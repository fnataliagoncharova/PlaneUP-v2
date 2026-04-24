from pydantic import BaseModel, ConfigDict, Field, field_validator


class RouteBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    route_code: str = Field(min_length=1, max_length=120)
    route_name: str = Field(min_length=1)
    result_nomenclature_id: int = Field(gt=0)
    is_active: bool = True

    @field_validator("route_code", "route_name")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        normalized_value = value.strip()

        if not normalized_value:
            raise ValueError("Поле не может быть пустым.")

        return normalized_value


class RouteCreate(RouteBase):
    pass


class RouteUpdate(RouteBase):
    pass


class RouteRead(RouteBase):
    route_id: int

