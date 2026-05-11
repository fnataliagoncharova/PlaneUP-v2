from __future__ import annotations

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class NomenclatureRouteChainEquipmentRead(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    step_equipment_id: int
    machine_id: int
    machine_code: str
    machine_name: str
    equipment_role: str
    priority: int
    nominal_rate: Decimal
    rate_uom: str
    min_batch_qty: Decimal | None = None


class NomenclatureRouteChainInputRead(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    step_input_id: int
    input_nomenclature_id: int
    input_nomenclature_code: str
    input_nomenclature_name: str
    input_item_type: Literal["manufactured", "purchased"] = "manufactured"
    input_qty: Decimal
    unit_of_measure: str
    child_chain: NomenclatureRouteChainNode | None = None


class NomenclatureRouteChainStepRead(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    route_step_id: int
    step_no: int
    process_id: int
    process_code: str
    process_name: str
    output_nomenclature_id: int
    output_nomenclature_code: str
    output_nomenclature_name: str
    output_qty: Decimal
    post_process_wait_hours: Decimal | None = None
    inputs: list[NomenclatureRouteChainInputRead] = Field(default_factory=list)
    equipment: list[NomenclatureRouteChainEquipmentRead] = Field(default_factory=list)


class NomenclatureRouteChainRouteRead(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    route_id: int
    route_code: str
    route_name: str
    is_active: bool
    steps: list[NomenclatureRouteChainStepRead] = Field(default_factory=list)


class NomenclatureRouteChainNode(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nomenclature_id: int
    nomenclature_code: str
    nomenclature_name: str
    unit_of_measure: str
    item_type: Literal["manufactured", "purchased"] = "manufactured"
    route: NomenclatureRouteChainRouteRead | None = None


class NomenclatureRouteChainResponse(NomenclatureRouteChainNode):
    warnings: list[str] = Field(default_factory=list)


NomenclatureRouteChainInputRead.model_rebuild()
