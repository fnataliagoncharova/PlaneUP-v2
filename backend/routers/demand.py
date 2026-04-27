from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any

import psycopg2
from fastapi import APIRouter, HTTPException, status
from psycopg2.extras import RealDictCursor

from db import get_connection
from schemas.demand import (
    DemandCalculateRequest,
    DemandCalculateResponse,
    DemandProblemItem,
    ExternalDemandItem,
    NomenclatureDemandItem,
    TopLevelDemandItem,
)


router = APIRouter(prefix="/demand", tags=["demand"])

DECIMAL_ZERO = Decimal("0")
QTY_SCALE = Decimal("0.001")
DEFAULT_EXTERNAL_INPUT_NAME = "Внешний вход"


@dataclass
class ActiveRouteInfo:
    route_id: int | None
    route_code: str | None
    route_name: str | None
    result_nomenclature_id: int | None
    active_count: int


@dataclass
class RouteStructure:
    route_id: int
    route_code: str
    route_name: str
    result_nomenclature_id: int
    producer_step_by_output: dict[int, dict[str, Any]]
    inputs_by_step_id: dict[int, list[dict[str, Any]]]


def normalize_qty(value: Decimal) -> Decimal:
    if value <= DECIMAL_ZERO:
        return DECIMAL_ZERO
    return value.quantize(QTY_SCALE)


def to_decimal(value: Any) -> Decimal:
    if value is None:
        return DECIMAL_ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


class DemandCalculator:
    def __init__(
        self,
        cursor: RealDictCursor,
        plan_date: date,
        balance_date: date,
    ) -> None:
        self.cursor = cursor
        self.plan_date = plan_date
        self.balance_date = balance_date

        self.nomenclature_cache: dict[int, dict[str, Any] | None] = {}
        self.active_route_cache: dict[int, ActiveRouteInfo] = {}
        self.route_structure_cache: dict[int, RouteStructure | None] = {}
        self.remaining_inventory_by_nomenclature: dict[int, Decimal] = {}

        self.internal_demand_by_nomenclature: dict[int, Decimal] = defaultdict(lambda: DECIMAL_ZERO)
        self.external_nomenclature_demand: dict[int, Decimal] = defaultdict(lambda: DECIMAL_ZERO)
        self.external_input_demand: dict[str, Decimal] = defaultdict(lambda: DECIMAL_ZERO)
        self.problems: list[DemandProblemItem] = []
        self.problem_keys: set[tuple[str, int | None, int | None, str | None]] = set()

    def calculate(self, nomenclature_ids: list[int] | None) -> DemandCalculateResponse:
        target_nomenclature_ids = self.get_target_nomenclature_ids(nomenclature_ids)

        if not target_nomenclature_ids:
            return DemandCalculateResponse(
                plan_date=self.plan_date,
                balance_date=self.balance_date,
                top_level_demand=[],
                internal_production_demand=[],
                external_demand=[],
                problems=[],
            )

        sales_plan_by_nomenclature = self.get_sales_plan_map(target_nomenclature_ids)
        safety_stock_by_nomenclature = self.get_safety_stock_map(target_nomenclature_ids)
        inventory_by_nomenclature = self.get_inventory_map(target_nomenclature_ids)

        top_level_items: list[TopLevelDemandItem] = []
        for nomenclature_id in target_nomenclature_ids:
            nomenclature_row = self.get_nomenclature(nomenclature_id)
            if nomenclature_row is None:
                self.add_problem(
                    problem_code="missing_nomenclature",
                    message="Номенклатура не найдена.",
                    nomenclature_id=nomenclature_id,
                )
                continue

            sales_plan_qty = to_decimal(sales_plan_by_nomenclature.get(nomenclature_id))
            safety_stock_qty = to_decimal(safety_stock_by_nomenclature.get(nomenclature_id))
            available_qty = to_decimal(inventory_by_nomenclature.get(nomenclature_id))
            gross_demand_qty = sales_plan_qty + safety_stock_qty
            net_production_demand_qty = max(DECIMAL_ZERO, gross_demand_qty - available_qty)

            self.remaining_inventory_by_nomenclature[nomenclature_id] = max(
                DECIMAL_ZERO,
                available_qty - gross_demand_qty,
            )

            top_level_items.append(
                TopLevelDemandItem(
                    nomenclature_id=nomenclature_id,
                    nomenclature_code=nomenclature_row["nomenclature_code"],
                    nomenclature_name=nomenclature_row["nomenclature_name"],
                    sales_plan_qty=normalize_qty(sales_plan_qty),
                    safety_stock_qty=normalize_qty(safety_stock_qty),
                    available_qty=normalize_qty(available_qty),
                    gross_demand_qty=normalize_qty(gross_demand_qty),
                    net_production_demand_qty=normalize_qty(net_production_demand_qty),
                )
            )

            if net_production_demand_qty > DECIMAL_ZERO:
                self.resolve_nomenclature_demand(
                    nomenclature_id=nomenclature_id,
                    required_qty=net_production_demand_qty,
                    path=[],
                )

        internal_demand_items = self.build_internal_demand_items()
        external_demand_items = self.build_external_demand_items()

        return DemandCalculateResponse(
            plan_date=self.plan_date,
            balance_date=self.balance_date,
            top_level_demand=top_level_items,
            internal_production_demand=internal_demand_items,
            external_demand=external_demand_items,
            problems=self.problems,
        )

    def resolve_nomenclature_demand(
        self,
        nomenclature_id: int,
        required_qty: Decimal,
        path: list[int],
    ) -> None:
        if required_qty <= DECIMAL_ZERO:
            return

        if nomenclature_id in path:
            cycle_path = [*path, nomenclature_id]
            self.add_problem(
                problem_code="route_cycle",
                message="Обнаружена циклическая зависимость маршрутов.",
                nomenclature_id=nomenclature_id,
                details=self.format_nomenclature_path(cycle_path),
            )
            return

        nomenclature_row = self.get_nomenclature(nomenclature_id)
        if nomenclature_row is None:
            self.add_problem(
                problem_code="missing_nomenclature",
                message="Номенклатура не найдена.",
                nomenclature_id=nomenclature_id,
            )
            return

        net_qty_after_inventory = self.consume_inventory(nomenclature_id, required_qty)
        if net_qty_after_inventory <= DECIMAL_ZERO:
            return

        active_route_info = self.get_active_route(nomenclature_id)
        if active_route_info.active_count > 1:
            self.add_problem(
                problem_code="multiple_active_routes",
                message="Для номенклатуры найдено несколько активных маршрутов. Использован первый.",
                nomenclature_id=nomenclature_id,
                nomenclature_code=nomenclature_row["nomenclature_code"],
                route_id=active_route_info.route_id,
            )

        if active_route_info.route_id is None:
            self.external_nomenclature_demand[nomenclature_id] += net_qty_after_inventory
            self.add_problem(
                problem_code="missing_active_route",
                message="Для номенклатуры нет активного маршрута.",
                nomenclature_id=nomenclature_id,
                nomenclature_code=nomenclature_row["nomenclature_code"],
            )
            return

        self.internal_demand_by_nomenclature[nomenclature_id] += net_qty_after_inventory
        route_structure = self.get_route_structure(active_route_info.route_id)
        if route_structure is None:
            self.external_nomenclature_demand[nomenclature_id] += net_qty_after_inventory
            return

        self.expand_route_output(
            route_structure=route_structure,
            output_nomenclature_id=nomenclature_id,
            required_qty=net_qty_after_inventory,
            path=[*path, nomenclature_id],
            route_output_stack=[],
        )

    def expand_route_output(
        self,
        route_structure: RouteStructure,
        output_nomenclature_id: int,
        required_qty: Decimal,
        path: list[int],
        route_output_stack: list[int],
    ) -> None:
        if required_qty <= DECIMAL_ZERO:
            return

        if output_nomenclature_id in route_output_stack:
            cycle_ids = [*route_output_stack, output_nomenclature_id]
            self.add_problem(
                problem_code="invalid_route_cycle",
                message="Обнаружена циклическая зависимость внутри маршрута.",
                nomenclature_id=output_nomenclature_id,
                route_id=route_structure.route_id,
                details=self.format_nomenclature_path(cycle_ids),
            )
            return

        producer_step = route_structure.producer_step_by_output.get(output_nomenclature_id)
        if producer_step is None:
            self.resolve_nomenclature_demand(
                nomenclature_id=output_nomenclature_id,
                required_qty=required_qty,
                path=path,
            )
            return

        output_qty = to_decimal(producer_step["output_qty"])
        if output_qty <= DECIMAL_ZERO:
            self.add_problem(
                problem_code="invalid_route_step_output_qty",
                message="Некорректный маршрут: выход шага должен быть больше 0.",
                nomenclature_id=output_nomenclature_id,
                route_id=route_structure.route_id,
            )
            return

        runs_qty = required_qty / output_qty
        step_inputs = route_structure.inputs_by_step_id.get(producer_step["route_step_id"], [])

        for step_input in step_inputs:
            input_required_qty = runs_qty * to_decimal(step_input["input_qty"])
            if input_required_qty <= DECIMAL_ZERO:
                continue

            input_nomenclature_id = step_input["input_nomenclature_id"]
            if input_nomenclature_id is not None:
                if input_nomenclature_id in route_structure.producer_step_by_output:
                    net_internal_qty = self.consume_inventory(
                        nomenclature_id=input_nomenclature_id,
                        required_qty=input_required_qty,
                    )
                    if net_internal_qty <= DECIMAL_ZERO:
                        continue

                    self.internal_demand_by_nomenclature[input_nomenclature_id] += net_internal_qty
                    self.expand_route_output(
                        route_structure=route_structure,
                        output_nomenclature_id=input_nomenclature_id,
                        required_qty=net_internal_qty,
                        path=path,
                        route_output_stack=[*route_output_stack, output_nomenclature_id],
                    )
                    continue

                self.resolve_nomenclature_demand(
                    nomenclature_id=input_nomenclature_id,
                    required_qty=input_required_qty,
                    path=path,
                )
                continue

            external_input_name = (step_input.get("external_input_name") or "").strip()
            normalized_external_name = external_input_name or DEFAULT_EXTERNAL_INPUT_NAME
            self.external_input_demand[normalized_external_name] += input_required_qty

    def consume_inventory(self, nomenclature_id: int, required_qty: Decimal) -> Decimal:
        available_qty = self.get_remaining_inventory_qty(nomenclature_id)
        if available_qty <= DECIMAL_ZERO:
            return required_qty

        consumed_qty = min(required_qty, available_qty)
        self.remaining_inventory_by_nomenclature[nomenclature_id] = available_qty - consumed_qty
        return required_qty - consumed_qty

    def get_remaining_inventory_qty(self, nomenclature_id: int) -> Decimal:
        if nomenclature_id in self.remaining_inventory_by_nomenclature:
            return self.remaining_inventory_by_nomenclature[nomenclature_id]

        self.cursor.execute(
            """
            SELECT COALESCE(available_qty, 0) AS available_qty
            FROM inventory_balance
            WHERE as_of_date = %s
              AND nomenclature_id = %s;
            """,
            (self.balance_date, nomenclature_id),
        )
        row = self.cursor.fetchone()
        available_qty = to_decimal(row["available_qty"]) if row else DECIMAL_ZERO
        self.remaining_inventory_by_nomenclature[nomenclature_id] = available_qty
        return available_qty

    def get_target_nomenclature_ids(self, requested_ids: list[int] | None) -> list[int]:
        if requested_ids:
            return requested_ids

        self.cursor.execute(
            """
            SELECT DISTINCT nomenclature_id
            FROM sales_plan
            WHERE plan_date = %s
            ORDER BY nomenclature_id;
            """,
            (self.plan_date,),
        )
        rows = self.cursor.fetchall()
        return [row["nomenclature_id"] for row in rows]

    def get_sales_plan_map(self, nomenclature_ids: list[int]) -> dict[int, Decimal]:
        self.cursor.execute(
            """
            SELECT
                nomenclature_id,
                COALESCE(SUM(plan_qty), 0) AS qty
            FROM sales_plan
            WHERE plan_date = %s
              AND nomenclature_id = ANY(%s)
            GROUP BY nomenclature_id;
            """,
            (self.plan_date, nomenclature_ids),
        )
        rows = self.cursor.fetchall()
        return {row["nomenclature_id"]: to_decimal(row["qty"]) for row in rows}

    def get_safety_stock_map(self, nomenclature_ids: list[int]) -> dict[int, Decimal]:
        self.cursor.execute(
            """
            SELECT
                nomenclature_id,
                stock_qty AS qty
            FROM safety_stock
            WHERE nomenclature_id = ANY(%s);
            """,
            (nomenclature_ids,),
        )
        rows = self.cursor.fetchall()
        return {row["nomenclature_id"]: to_decimal(row["qty"]) for row in rows}

    def get_inventory_map(self, nomenclature_ids: list[int]) -> dict[int, Decimal]:
        self.cursor.execute(
            """
            SELECT
                nomenclature_id,
                available_qty AS qty
            FROM inventory_balance
            WHERE as_of_date = %s
              AND nomenclature_id = ANY(%s);
            """,
            (self.balance_date, nomenclature_ids),
        )
        rows = self.cursor.fetchall()
        return {row["nomenclature_id"]: to_decimal(row["qty"]) for row in rows}

    def get_nomenclature(self, nomenclature_id: int) -> dict[str, Any] | None:
        if nomenclature_id in self.nomenclature_cache:
            return self.nomenclature_cache[nomenclature_id]

        self.cursor.execute(
            """
            SELECT
                nomenclature_id,
                nomenclature_code,
                nomenclature_name
            FROM nomenclature
            WHERE nomenclature_id = %s;
            """,
            (nomenclature_id,),
        )
        row = self.cursor.fetchone()
        self.nomenclature_cache[nomenclature_id] = row
        return row

    def get_active_route(self, nomenclature_id: int) -> ActiveRouteInfo:
        cached_info = self.active_route_cache.get(nomenclature_id)
        if cached_info is not None:
            return cached_info

        self.cursor.execute(
            """
            SELECT
                route_id,
                route_code,
                route_name,
                result_nomenclature_id
            FROM routes
            WHERE result_nomenclature_id = %s
              AND is_active = TRUE
            ORDER BY route_id;
            """,
            (nomenclature_id,),
        )
        rows = self.cursor.fetchall()

        if not rows:
            route_info = ActiveRouteInfo(
                route_id=None,
                route_code=None,
                route_name=None,
                result_nomenclature_id=None,
                active_count=0,
            )
        else:
            first_row = rows[0]
            route_info = ActiveRouteInfo(
                route_id=first_row["route_id"],
                route_code=first_row["route_code"],
                route_name=first_row["route_name"],
                result_nomenclature_id=first_row["result_nomenclature_id"],
                active_count=len(rows),
            )

        self.active_route_cache[nomenclature_id] = route_info
        return route_info

    def get_route_structure(self, route_id: int) -> RouteStructure | None:
        if route_id in self.route_structure_cache:
            return self.route_structure_cache[route_id]

        self.cursor.execute(
            """
            SELECT
                route_id,
                route_code,
                route_name,
                result_nomenclature_id
            FROM routes
            WHERE route_id = %s;
            """,
            (route_id,),
        )
        route_row = self.cursor.fetchone()
        if route_row is None:
            self.add_problem(
                problem_code="missing_route",
                message="Маршрут не найден.",
                route_id=route_id,
            )
            self.route_structure_cache[route_id] = None
            return None

        self.cursor.execute(
            """
            SELECT
                route_step_id,
                step_no,
                output_nomenclature_id,
                output_qty
            FROM route_steps
            WHERE route_id = %s
            ORDER BY step_no, route_step_id;
            """,
            (route_id,),
        )
        step_rows = self.cursor.fetchall()

        if not step_rows:
            self.add_problem(
                problem_code="invalid_route_no_steps",
                message="Некорректный маршрут: не добавлены шаги.",
                route_id=route_id,
            )
            self.route_structure_cache[route_id] = None
            return None

        step_ids = [step_row["route_step_id"] for step_row in step_rows]
        self.cursor.execute(
            """
            SELECT
                step_input_id,
                route_step_id,
                input_nomenclature_id,
                external_input_name,
                input_qty
            FROM route_step_inputs
            WHERE route_step_id = ANY(%s)
            ORDER BY step_input_id;
            """,
            (step_ids,),
        )
        input_rows = self.cursor.fetchall()

        inputs_by_step_id: dict[int, list[dict[str, Any]]] = defaultdict(list)
        for input_row in input_rows:
            inputs_by_step_id[input_row["route_step_id"]].append(input_row)

        producer_step_by_output: dict[int, dict[str, Any]] = {}
        duplicate_outputs: set[int] = set()
        for step_row in step_rows:
            output_nomenclature_id = step_row["output_nomenclature_id"]
            if output_nomenclature_id in producer_step_by_output:
                duplicate_outputs.add(output_nomenclature_id)
            producer_step_by_output[output_nomenclature_id] = step_row

        for duplicate_output_nomenclature_id in duplicate_outputs:
            nomenclature_row = self.get_nomenclature(duplicate_output_nomenclature_id)
            self.add_problem(
                problem_code="invalid_route_duplicate_step_output",
                message=(
                    "Некорректный маршрут: несколько шагов с одинаковой выходной номенклатурой. "
                    "Использован шаг с максимальным номером."
                ),
                nomenclature_id=duplicate_output_nomenclature_id,
                nomenclature_code=(
                    nomenclature_row["nomenclature_code"] if nomenclature_row is not None else None
                ),
                route_id=route_id,
            )

        route_result_nomenclature_id = route_row["result_nomenclature_id"]
        if route_result_nomenclature_id not in producer_step_by_output:
            self.add_problem(
                problem_code="invalid_route_result_output_missing",
                message="Некорректный маршрут: нет шага, который выпускает выход маршрута.",
                nomenclature_id=route_result_nomenclature_id,
                route_id=route_id,
            )
            self.route_structure_cache[route_id] = None
            return None

        route_structure = RouteStructure(
            route_id=route_id,
            route_code=route_row["route_code"],
            route_name=route_row["route_name"],
            result_nomenclature_id=route_result_nomenclature_id,
            producer_step_by_output=producer_step_by_output,
            inputs_by_step_id=dict(inputs_by_step_id),
        )
        self.route_structure_cache[route_id] = route_structure
        return route_structure

    def build_internal_demand_items(self) -> list[NomenclatureDemandItem]:
        rows: list[NomenclatureDemandItem] = []
        for nomenclature_id, required_qty in self.internal_demand_by_nomenclature.items():
            if required_qty <= DECIMAL_ZERO:
                continue

            nomenclature_row = self.get_nomenclature(nomenclature_id)
            if nomenclature_row is None:
                continue

            rows.append(
                NomenclatureDemandItem(
                    nomenclature_id=nomenclature_id,
                    nomenclature_code=nomenclature_row["nomenclature_code"],
                    nomenclature_name=nomenclature_row["nomenclature_name"],
                    required_qty=normalize_qty(required_qty),
                )
            )

        rows.sort(key=lambda row: row.nomenclature_code)
        return rows

    def build_external_demand_items(self) -> list[ExternalDemandItem]:
        rows: list[ExternalDemandItem] = []

        for nomenclature_id, required_qty in self.external_nomenclature_demand.items():
            if required_qty <= DECIMAL_ZERO:
                continue

            nomenclature_row = self.get_nomenclature(nomenclature_id)
            if nomenclature_row is None:
                continue

            rows.append(
                ExternalDemandItem(
                    nomenclature_id=nomenclature_id,
                    nomenclature_code=nomenclature_row["nomenclature_code"],
                    nomenclature_name=nomenclature_row["nomenclature_name"],
                    external_input_name=None,
                    required_qty=normalize_qty(required_qty),
                )
            )

        for external_input_name, required_qty in self.external_input_demand.items():
            if required_qty <= DECIMAL_ZERO:
                continue

            rows.append(
                ExternalDemandItem(
                    nomenclature_id=None,
                    nomenclature_code=None,
                    nomenclature_name=None,
                    external_input_name=external_input_name,
                    required_qty=normalize_qty(required_qty),
                )
            )

        rows.sort(
            key=lambda row: (
                row.nomenclature_code or "",
                row.external_input_name or "",
            )
        )
        return rows

    def add_problem(
        self,
        *,
        problem_code: str,
        message: str,
        nomenclature_id: int | None = None,
        nomenclature_code: str | None = None,
        route_id: int | None = None,
        details: str | None = None,
    ) -> None:
        if nomenclature_code is None and nomenclature_id is not None:
            nomenclature_row = self.get_nomenclature(nomenclature_id)
            if nomenclature_row is not None:
                nomenclature_code = nomenclature_row["nomenclature_code"]

        problem_key = (problem_code, nomenclature_id, route_id, details)
        if problem_key in self.problem_keys:
            return

        self.problem_keys.add(problem_key)
        self.problems.append(
            DemandProblemItem(
                problem_code=problem_code,
                message=message,
                nomenclature_id=nomenclature_id,
                nomenclature_code=nomenclature_code,
                route_id=route_id,
                details=details,
            )
        )

    def format_nomenclature_path(self, nomenclature_ids: list[int]) -> str:
        labels: list[str] = []
        for nomenclature_id in nomenclature_ids:
            nomenclature_row = self.get_nomenclature(nomenclature_id)
            if nomenclature_row is None:
                labels.append(f"ID {nomenclature_id}")
            else:
                labels.append(nomenclature_row["nomenclature_code"])
        return " -> ".join(labels)


@router.post("/calculate", response_model=DemandCalculateResponse)
def calculate_demand(payload: DemandCalculateRequest):
    connection = None

    try:
        balance_date = payload.balance_date or payload.plan_date

        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            calculator = DemandCalculator(
                cursor=cursor,
                plan_date=payload.plan_date,
                balance_date=balance_date,
            )
            return calculator.calculate(payload.nomenclature_ids)
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось выполнить расчёт потребности.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()
