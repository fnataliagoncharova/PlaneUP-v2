from datetime import datetime
from typing import Any

import psycopg2
from fastapi import APIRouter, HTTPException, Path, Query, status
from psycopg2.extras import RealDictCursor

from db import get_connection
from schemas.equipment_maintenance import (
    EquipmentMaintenanceCreate,
    EquipmentMaintenanceRead,
    EquipmentMaintenanceUpdate,
)


router = APIRouter(prefix="/equipment-maintenance", tags=["equipment_maintenance"])

# NOTE FOR NEXT STAGE:
# Overlapping maintenance intervals for the same machine are intentionally allowed.
# When calculating machine availability, intervals must be merged (unioned) per machine
# to avoid double-counting downtime. Example: 08:00-12:00 and 10:00-14:00 => 6h downtime.

SELECT_COLUMNS = """
    em.maintenance_id,
    em.machine_id,
    m.machine_code,
    m.machine_name,
    em.started_at,
    em.ended_at,
    em.duration_minutes,
    ROUND(em.duration_minutes::numeric / 60, 2) AS duration_hours,
    em.comment,
    em.created_at,
    em.updated_at
"""


def validate_period(
    started_at: datetime,
    ended_at: datetime,
) -> None:
    if ended_at <= started_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Окончание ТО должно быть позже начала.",
        )


def calculate_duration_minutes(started_at: datetime, ended_at: datetime) -> int:
    duration_minutes = int((ended_at - started_at).total_seconds() // 60)
    if duration_minutes <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Окончание ТО должно быть позже начала.",
        )
    return duration_minutes


def ensure_machine_exists(cursor: RealDictCursor, machine_id: int) -> None:
    cursor.execute(
        """
        SELECT machine_id
        FROM machines
        WHERE machine_id = %s;
        """,
        (machine_id,),
    )
    if cursor.fetchone() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Оборудование не найдено.",
        )


def require_equipment_maintenance(
    cursor: RealDictCursor,
    maintenance_id: int,
    lock: bool = False,
) -> dict[str, Any]:
    lock_clause = "FOR UPDATE" if lock else ""
    cursor.execute(
        f"""
        SELECT
            maintenance_id,
            machine_id,
            started_at,
            ended_at,
            duration_minutes,
            comment
        FROM equipment_maintenance
        WHERE maintenance_id = %s
        {lock_clause};
        """,
        (maintenance_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запись планового ТО не найдена.",
        )
    return row


def get_equipment_maintenance_by_id(
    connection,
    maintenance_id: int,
) -> dict[str, Any] | None:
    with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            f"""
            SELECT {SELECT_COLUMNS}
            FROM equipment_maintenance AS em
            INNER JOIN machines AS m ON m.machine_id = em.machine_id
            WHERE em.maintenance_id = %s;
            """,
            (maintenance_id,),
        )
        return cursor.fetchone()


def require_equipment_maintenance_exists(
    connection,
    maintenance_id: int,
) -> dict[str, Any]:
    row = get_equipment_maintenance_by_id(connection, maintenance_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запись планового ТО не найдена.",
        )
    return row


@router.get("", response_model=list[EquipmentMaintenanceRead])
def list_equipment_maintenance(
    machine_id: int | None = Query(default=None, gt=0),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
):
    connection = None

    try:
        if date_from is not None and date_to is not None and date_to < date_from:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Дата окончания периода должна быть не раньше даты начала.",
            )

        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            where_clauses: list[str] = []
            params: list[Any] = []

            if machine_id is not None:
                where_clauses.append("em.machine_id = %s")
                params.append(machine_id)

            if date_from is not None and date_to is not None:
                where_clauses.append("em.started_at <= %s")
                where_clauses.append("em.ended_at >= %s")
                params.extend([date_to, date_from])
            elif date_from is not None:
                where_clauses.append("em.ended_at >= %s")
                params.append(date_from)
            elif date_to is not None:
                where_clauses.append("em.started_at <= %s")
                params.append(date_to)

            where_sql = ""
            if where_clauses:
                where_sql = "WHERE " + " AND ".join(where_clauses)

            has_filters = machine_id is not None or date_from is not None or date_to is not None
            order_sql = (
                "ORDER BY em.started_at ASC, em.maintenance_id ASC"
                if has_filters
                else "ORDER BY em.started_at DESC, em.maintenance_id DESC"
            )
            limit_sql = "" if has_filters else "LIMIT 100"

            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM equipment_maintenance AS em
                INNER JOIN machines AS m ON m.machine_id = em.machine_id
                {where_sql}
                {order_sql}
                {limit_sql};
                """,
                tuple(params),
            )
            return cursor.fetchall()
    except HTTPException:
        raise
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить плановые ТО.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.post("", response_model=EquipmentMaintenanceRead, status_code=status.HTTP_201_CREATED)
def create_equipment_maintenance(payload: EquipmentMaintenanceCreate):
    connection = None

    try:
        validate_period(payload.started_at, payload.ended_at)
        duration_minutes = calculate_duration_minutes(payload.started_at, payload.ended_at)

        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            ensure_machine_exists(cursor, payload.machine_id)
            cursor.execute(
                """
                INSERT INTO equipment_maintenance (
                    machine_id,
                    started_at,
                    ended_at,
                    duration_minutes,
                    comment
                )
                VALUES (%s, %s, %s, %s, %s)
                RETURNING maintenance_id;
                """,
                (
                    payload.machine_id,
                    payload.started_at,
                    payload.ended_at,
                    duration_minutes,
                    payload.comment,
                ),
            )
            created_row = cursor.fetchone()

        connection.commit()
        return require_equipment_maintenance_exists(connection, int(created_row["maintenance_id"]))
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать плановое ТО.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.put("/{maintenance_id}", response_model=EquipmentMaintenanceRead)
def update_equipment_maintenance(
    payload: EquipmentMaintenanceUpdate,
    maintenance_id: int = Path(..., gt=0),
):
    connection = None

    try:
        validate_period(payload.started_at, payload.ended_at)
        duration_minutes = calculate_duration_minutes(payload.started_at, payload.ended_at)

        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            require_equipment_maintenance(cursor, maintenance_id, lock=True)
            ensure_machine_exists(cursor, payload.machine_id)
            cursor.execute(
                """
                UPDATE equipment_maintenance
                SET
                    machine_id = %s,
                    started_at = %s,
                    ended_at = %s,
                    duration_minutes = %s,
                    comment = %s,
                    updated_at = NOW()
                WHERE maintenance_id = %s;
                """,
                (
                    payload.machine_id,
                    payload.started_at,
                    payload.ended_at,
                    duration_minutes,
                    payload.comment,
                    maintenance_id,
                ),
            )

        connection.commit()
        return require_equipment_maintenance_exists(connection, maintenance_id)
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось обновить плановое ТО.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.delete("/{maintenance_id}")
def delete_equipment_maintenance(maintenance_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            require_equipment_maintenance(cursor, maintenance_id, lock=True)
            cursor.execute(
                """
                DELETE FROM equipment_maintenance
                WHERE maintenance_id = %s
                RETURNING maintenance_id;
                """,
                (maintenance_id,),
            )
            deleted_row = cursor.fetchone()

        connection.commit()
        return {
            "maintenance_id": int(deleted_row["maintenance_id"]),
            "message": "Плановое ТО удалено.",
        }
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось удалить плановое ТО.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()
