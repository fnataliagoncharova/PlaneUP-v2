from typing import List

import psycopg2
from fastapi import APIRouter, HTTPException, Path, status
from psycopg2.errors import CheckViolation, ForeignKeyViolation, UniqueViolation
from psycopg2.extras import RealDictCursor

from db import get_connection
from schemas.route_step_equipment import (
    RouteStepEquipmentCreate,
    RouteStepEquipmentRead,
    RouteStepEquipmentUpdate,
)


router = APIRouter(tags=["route_step_equipment"])

SELECT_COLUMNS = """
    step_equipment_id,
    route_step_id,
    machine_id,
    equipment_role,
    priority,
    nominal_rate,
    rate_uom,
    is_active
"""

# Backward compatibility for old records if they exist in DB.
LEGACY_RATE_UOM_TO_CANONICAL = {
    "РјВІ/РјРёРЅ": "м²/мин",
    "Рј.Рї./РјРёРЅ": "м.п./мин",
}


def get_constraint_name(exc: Exception) -> str | None:
    return getattr(getattr(exc, "diag", None), "constraint_name", None)


def normalize_rate_uom(value: str | None) -> str | None:
    if value is None:
        return None
    return LEGACY_RATE_UOM_TO_CANONICAL.get(value, value)


def normalize_step_equipment_row(row: dict | None) -> dict | None:
    if row is None:
        return None

    normalized_row = dict(row)
    normalized_row["rate_uom"] = normalize_rate_uom(normalized_row.get("rate_uom"))
    return normalized_row


def normalize_step_equipment_rows(rows: list[dict]) -> list[dict]:
    return [normalize_step_equipment_row(row) for row in rows]


def get_route_step(cursor: RealDictCursor, route_step_id: int, lock: bool = False) -> dict:
    lock_clause = "FOR UPDATE" if lock else ""
    cursor.execute(
        f"""
        SELECT
            route_step_id,
            route_id
        FROM route_steps
        WHERE route_step_id = %s
        {lock_clause};
        """,
        (route_step_id,),
    )
    route_step_row = cursor.fetchone()

    if route_step_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Шаг маршрута не найден.",
        )

    return route_step_row


def get_step_equipment_with_route(
    cursor: RealDictCursor, step_equipment_id: int, lock: bool = False
) -> dict:
    lock_clause = "FOR UPDATE OF rse, rs" if lock else ""
    cursor.execute(
        f"""
        SELECT
            rse.step_equipment_id,
            rse.route_step_id,
            rs.route_id
        FROM route_step_equipment AS rse
        INNER JOIN route_steps AS rs ON rs.route_step_id = rse.route_step_id
        WHERE rse.step_equipment_id = %s
        {lock_clause};
        """,
        (step_equipment_id,),
    )
    step_equipment_row = cursor.fetchone()

    if step_equipment_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Оборудование шага не найдено.",
        )

    return step_equipment_row


def deactivate_route_if_active(cursor: RealDictCursor, route_id: int) -> bool:
    cursor.execute(
        """
        UPDATE routes
        SET
            is_active = FALSE,
            updated_at = NOW()
        WHERE route_id = %s
          AND is_active = TRUE
        RETURNING route_id;
        """,
        (route_id,),
    )
    return cursor.fetchone() is not None


@router.get("/route-steps/{route_step_id}/equipment", response_model=List[RouteStepEquipmentRead])
def list_route_step_equipment(route_step_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            get_route_step(cursor, route_step_id)
            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM route_step_equipment
                WHERE route_step_id = %s
                ORDER BY priority, step_equipment_id;
                """,
                (route_step_id,),
            )
            rows = cursor.fetchall()

        return normalize_step_equipment_rows(rows)
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить оборудование шага.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.get("/route-step-equipment/{step_equipment_id}", response_model=RouteStepEquipmentRead)
def get_route_step_equipment(step_equipment_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM route_step_equipment
                WHERE step_equipment_id = %s;
                """,
                (step_equipment_id,),
            )
            row = cursor.fetchone()

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Оборудование шага не найдено.",
            )

        return normalize_step_equipment_row(row)
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить оборудование шага.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.post(
    "/route-steps/{route_step_id}/equipment",
    response_model=RouteStepEquipmentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_route_step_equipment(payload: RouteStepEquipmentCreate, route_step_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            route_step_row = get_route_step(cursor, route_step_id, lock=True)
            cursor.execute(
                f"""
                INSERT INTO route_step_equipment (
                    route_step_id,
                    machine_id,
                    equipment_role,
                    priority,
                    nominal_rate,
                    rate_uom,
                    is_active
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING {SELECT_COLUMNS};
                """,
                (
                    route_step_id,
                    payload.machine_id,
                    payload.equipment_role,
                    payload.priority,
                    payload.nominal_rate,
                    payload.rate_uom,
                    payload.is_active,
                ),
            )
            created_row = cursor.fetchone()
            deactivate_route_if_active(cursor, route_step_row["route_id"])

        connection.commit()
        return normalize_step_equipment_row(created_row)
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()

        constraint_name = get_constraint_name(exc)
        if constraint_name == "route_step_equipment_route_step_id_machine_id_key":
            detail = "Эта единица оборудования уже добавлена для шага."
        else:
            detail = "Не удалось создать запись оборудования шага из-за ограничения уникальности."

        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc
    except ForeignKeyViolation as exc:
        if connection is not None:
            connection.rollback()

        constraint_name = get_constraint_name(exc)
        if constraint_name == "route_step_equipment_machine_id_fkey":
            detail = "Единица оборудования не найдена."
        elif constraint_name == "route_step_equipment_route_step_id_fkey":
            detail = "Шаг маршрута не найден."
        else:
            detail = "Некорректная ссылка на связанный объект."

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    except CheckViolation as exc:
        if connection is not None:
            connection.rollback()

        constraint_name = get_constraint_name(exc)
        if constraint_name == "route_step_equipment_priority_check":
            detail = "Приоритет должен быть больше 0."
        elif constraint_name == "route_step_equipment_nominal_rate_check":
            detail = "Производительность должна быть больше 0."
        elif constraint_name == "route_step_equipment_equipment_role_check":
            detail = "Роль оборудования должна быть primary или alternative."
        elif constraint_name == "route_step_equipment_rate_uom_check":
            detail = "Единица производительности должна быть м²/мин или м.п./мин."
        else:
            detail = "Некорректные данные оборудования шага."

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать запись оборудования шага.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.put("/route-step-equipment/{step_equipment_id}", response_model=RouteStepEquipmentRead)
def update_route_step_equipment(payload: RouteStepEquipmentUpdate, step_equipment_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            step_equipment_row = get_step_equipment_with_route(cursor, step_equipment_id, lock=True)
            cursor.execute(
                f"""
                UPDATE route_step_equipment
                SET
                    machine_id = %s,
                    equipment_role = %s,
                    priority = %s,
                    nominal_rate = %s,
                    rate_uom = %s,
                    is_active = %s,
                    updated_at = NOW()
                WHERE step_equipment_id = %s
                RETURNING {SELECT_COLUMNS};
                """,
                (
                    payload.machine_id,
                    payload.equipment_role,
                    payload.priority,
                    payload.nominal_rate,
                    payload.rate_uom,
                    payload.is_active,
                    step_equipment_id,
                ),
            )
            updated_row = cursor.fetchone()

            if updated_row is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Оборудование шага не найдено.",
                )

            deactivate_route_if_active(cursor, step_equipment_row["route_id"])

        connection.commit()
        return normalize_step_equipment_row(updated_row)
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()

        constraint_name = get_constraint_name(exc)
        if constraint_name == "route_step_equipment_route_step_id_machine_id_key":
            detail = "Эта единица оборудования уже добавлена для шага."
        else:
            detail = "Не удалось сохранить запись оборудования шага из-за ограничения уникальности."

        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc
    except ForeignKeyViolation as exc:
        if connection is not None:
            connection.rollback()

        constraint_name = get_constraint_name(exc)
        if constraint_name == "route_step_equipment_machine_id_fkey":
            detail = "Единица оборудования не найдена."
        elif constraint_name == "route_step_equipment_route_step_id_fkey":
            detail = "Шаг маршрута не найден."
        else:
            detail = "Некорректная ссылка на связанный объект."

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    except CheckViolation as exc:
        if connection is not None:
            connection.rollback()

        constraint_name = get_constraint_name(exc)
        if constraint_name == "route_step_equipment_priority_check":
            detail = "Приоритет должен быть больше 0."
        elif constraint_name == "route_step_equipment_nominal_rate_check":
            detail = "Производительность должна быть больше 0."
        elif constraint_name == "route_step_equipment_equipment_role_check":
            detail = "Роль оборудования должна быть primary или alternative."
        elif constraint_name == "route_step_equipment_rate_uom_check":
            detail = "Единица производительности должна быть м²/мин или м.п./мин."
        else:
            detail = "Некорректные данные оборудования шага."

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось изменить запись оборудования шага.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.delete("/route-step-equipment/{step_equipment_id}", response_model=RouteStepEquipmentRead)
def delete_route_step_equipment(step_equipment_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            step_equipment_row = get_step_equipment_with_route(cursor, step_equipment_id, lock=True)
            cursor.execute(
                f"""
                DELETE FROM route_step_equipment
                WHERE step_equipment_id = %s
                RETURNING {SELECT_COLUMNS};
                """,
                (step_equipment_id,),
            )
            deleted_row = cursor.fetchone()

            if deleted_row is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Оборудование шага не найдено.",
                )

            deactivate_route_if_active(cursor, step_equipment_row["route_id"])

        connection.commit()
        return normalize_step_equipment_row(deleted_row)
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось удалить запись оборудования шага.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()
