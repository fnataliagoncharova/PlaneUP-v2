from datetime import date, datetime, time, timedelta, timezone
from typing import Any

import psycopg2
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from psycopg2.extras import RealDictCursor

from auth.rbac import is_admin_like_role, require_roles
from db import get_connection
from schemas.equipment_downtime import (
    EquipmentDowntimeClose,
    EquipmentDowntimeCreate,
    EquipmentDowntimeRead,
    EquipmentDowntimeUpdate,
)


router = APIRouter(prefix="/equipment-downtimes", tags=["equipment_downtimes"])

DOWNTIME_READ_ROLES = ("planner", "master", "maintenance", "viewer")
DOWNTIME_CREATE_ROLES = ("planner", "master", "maintenance")
DOWNTIME_WRITE_ROLES = ("planner", "master", "maintenance")
DOWNTIME_PERMISSION_ERROR = "Недостаточно прав для изменения внепланового простоя."

STATUS_OPEN = "open"
STATUS_CLOSED = "closed"
STATUS_VALUES = {STATUS_OPEN, STATUS_CLOSED}
FUTURE_OPEN_DOWNTIME_ERROR = "Начало открытого простоя не может быть позже текущего времени."

SELECT_COLUMNS = """
    ed.downtime_id,
    ed.machine_id,
    m.machine_code,
    m.machine_name,
    ed.downtime_reason_id,
    dr.reason_code,
    dr.reason_name,
    dr.reason_category,
    ed.started_at,
    ed.ended_at,
    ed.duration_minutes,
    ed.comment,
    ed.created_by_user_id,
    created_user.username AS created_by_username,
    ed.updated_by_user_id,
    updated_user.username AS updated_by_username,
    ed.created_at,
    ed.updated_at
"""


def normalize_status_filter(value: str | None) -> str:
    normalized_value = str(value or "").strip().lower()
    if normalized_value not in STATUS_VALUES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Статус должен быть open или closed.",
        )
    return normalized_value


def calculate_duration_minutes(started_at: datetime, ended_at: datetime) -> int:
    if ended_at <= started_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Окончание простоя должно быть позже начала.",
        )

    duration_minutes = int((ended_at - started_at).total_seconds() // 60)
    if duration_minutes <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Окончание простоя должно быть позже начала.",
        )

    return duration_minutes


def get_local_now() -> datetime:
    return datetime.now()


def get_current_production_shift_interval(now: datetime | None = None) -> tuple[datetime, datetime]:
    current_datetime = now or datetime.utcnow()
    current_day_start = current_datetime.replace(hour=0, minute=0, second=0, microsecond=0)

    if 8 <= current_datetime.hour < 20:
        shift_start = current_day_start + timedelta(hours=8)
        shift_end = current_day_start + timedelta(hours=20)
        return shift_start, shift_end

    if current_datetime.hour >= 20:
        shift_start = current_day_start + timedelta(hours=20)
        shift_end = current_day_start + timedelta(days=1, hours=8)
        return shift_start, shift_end

    shift_start = current_day_start - timedelta(hours=4)
    shift_end = current_day_start + timedelta(hours=8)
    return shift_start, shift_end


def to_naive_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def ensure_can_modify_equipment_downtime(record: dict[str, Any], current_user: dict[str, Any]) -> None:
    if is_admin_like_role(current_user["role"]):
        return

    if current_user["role"] not in set(DOWNTIME_WRITE_ROLES):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=DOWNTIME_PERMISSION_ERROR,
        )

    created_at = record.get("created_at")
    if not isinstance(created_at, datetime):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=DOWNTIME_PERMISSION_ERROR,
        )

    current_shift_start, current_shift_end = get_current_production_shift_interval()
    normalized_created_at = to_naive_utc(created_at)

    if (
        record.get("created_by_user_id") == current_user["id"]
        and current_shift_start <= normalized_created_at < current_shift_end
    ):
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=DOWNTIME_PERMISSION_ERROR,
    )


def validate_open_downtime_started_at(started_at: datetime, ended_at: datetime | None) -> None:
    if ended_at is not None:
        return

    if started_at > get_local_now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=FUTURE_OPEN_DOWNTIME_ERROR,
        )


def build_duration_fields(
    started_at: datetime,
    ended_at: datetime | None,
    duration_minutes: int | None,
    now_value: datetime | None = None,
) -> dict[str, Any]:
    resolved_now = now_value or get_local_now()

    if ended_at is None:
        current_duration_minutes = max(
            0,
            int((resolved_now - started_at).total_seconds() // 60),
        )
        current_duration_hours = round(current_duration_minutes / 60, 2)
        return {
            "status": STATUS_OPEN,
            "duration_minutes": None,
            "duration_hours": None,
            "current_duration_minutes": current_duration_minutes,
            "current_duration_hours": current_duration_hours,
        }

    resolved_duration_minutes = duration_minutes
    if resolved_duration_minutes is None:
        resolved_duration_minutes = calculate_duration_minutes(started_at, ended_at)
    resolved_duration_hours = round(resolved_duration_minutes / 60, 2)
    return {
        "status": STATUS_CLOSED,
        "duration_minutes": resolved_duration_minutes,
        "duration_hours": resolved_duration_hours,
        "current_duration_minutes": resolved_duration_minutes,
        "current_duration_hours": resolved_duration_hours,
    }


def normalize_row(row: dict[str, Any], now_value: datetime | None = None) -> dict[str, Any]:
    started_at = row["started_at"]
    ended_at = row["ended_at"]
    duration_fields = build_duration_fields(
        started_at=started_at,
        ended_at=ended_at,
        duration_minutes=row.get("duration_minutes"),
        now_value=now_value,
    )
    return {
        **row,
        **duration_fields,
    }


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


def ensure_downtime_reason_exists(cursor: RealDictCursor, downtime_reason_id: int) -> None:
    cursor.execute(
        """
        SELECT downtime_reason_id
        FROM downtime_reasons
        WHERE downtime_reason_id = %s;
        """,
        (downtime_reason_id,),
    )
    if cursor.fetchone() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Причина простоя не найдена.",
        )


def require_equipment_downtime_exists(connection, downtime_id: int) -> dict[str, Any]:
    now_value = get_local_now()

    with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            f"""
            SELECT {SELECT_COLUMNS}
            FROM equipment_downtimes AS ed
            INNER JOIN machines AS m ON m.machine_id = ed.machine_id
            INNER JOIN downtime_reasons AS dr ON dr.downtime_reason_id = ed.downtime_reason_id
            LEFT JOIN users AS created_user ON created_user.id = ed.created_by_user_id
            LEFT JOIN users AS updated_user ON updated_user.id = ed.updated_by_user_id
            WHERE ed.downtime_id = %s;
            """,
            (downtime_id,),
        )
        row = cursor.fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запись простоя не найдена.",
        )

    return normalize_row(row, now_value=now_value)


@router.get(
    "",
    response_model=list[EquipmentDowntimeRead],
    dependencies=[Depends(require_roles(*DOWNTIME_READ_ROLES))],
)
def list_equipment_downtimes(
    machine_id: int | None = Query(default=None, gt=0),
    downtime_reason_id: int | None = Query(default=None, gt=0),
    reason_category: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
):
    connection = None

    try:
        if date_from is not None and date_to is not None and date_from > date_to:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Дата окончания фильтра не может быть раньше даты начала.",
            )

        normalized_status = None
        if status_filter is not None:
            normalized_status = normalize_status_filter(status_filter)

        now_value = get_local_now()
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            where_clauses: list[str] = []
            params: list[Any] = []

            if machine_id is not None:
                where_clauses.append("ed.machine_id = %s")
                params.append(machine_id)

            if downtime_reason_id is not None:
                where_clauses.append("ed.downtime_reason_id = %s")
                params.append(downtime_reason_id)

            normalized_reason_category = str(reason_category or "").strip()
            if normalized_reason_category:
                where_clauses.append("dr.reason_category = %s")
                params.append(normalized_reason_category)

            if normalized_status == STATUS_OPEN:
                where_clauses.append("ed.ended_at IS NULL")
            elif normalized_status == STATUS_CLOSED:
                where_clauses.append("ed.ended_at IS NOT NULL")

            if date_from is not None:
                where_clauses.append("COALESCE(ed.ended_at, %s) >= %s")
                params.append(now_value)
                params.append(datetime.combine(date_from, time.min))

            if date_to is not None:
                upper_bound = datetime.combine(date_to + timedelta(days=1), time.min)
                where_clauses.append("ed.started_at < %s")
                params.append(upper_bound)

            where_sql = ""
            if where_clauses:
                where_sql = "WHERE " + " AND ".join(where_clauses)

            limit_sql = "LIMIT 100" if not where_clauses else ""

            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM equipment_downtimes AS ed
                INNER JOIN machines AS m ON m.machine_id = ed.machine_id
                INNER JOIN downtime_reasons AS dr ON dr.downtime_reason_id = ed.downtime_reason_id
                LEFT JOIN users AS created_user ON created_user.id = ed.created_by_user_id
                LEFT JOIN users AS updated_user ON updated_user.id = ed.updated_by_user_id
                {where_sql}
                ORDER BY
                    CASE WHEN ed.ended_at IS NULL THEN 0 ELSE 1 END ASC,
                    ed.started_at DESC,
                    ed.downtime_id DESC
                {limit_sql};
                """,
                tuple(params),
            )
            rows = cursor.fetchall()

        return [normalize_row(row, now_value=now_value) for row in rows]
    except HTTPException:
        raise
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить журнал внеплановых простоев.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.post(
    "",
    response_model=EquipmentDowntimeRead,
    status_code=status.HTTP_201_CREATED,
)
def create_equipment_downtime(
    payload: EquipmentDowntimeCreate,
    current_user: dict[str, Any] = Depends(require_roles(*DOWNTIME_CREATE_ROLES)),
):
    connection = None

    try:
        duration_minutes = None
        if payload.ended_at is not None:
            duration_minutes = calculate_duration_minutes(payload.started_at, payload.ended_at)
        validate_open_downtime_started_at(payload.started_at, payload.ended_at)

        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            ensure_machine_exists(cursor, payload.machine_id)
            ensure_downtime_reason_exists(cursor, payload.downtime_reason_id)

            cursor.execute(
                """
                INSERT INTO equipment_downtimes (
                    machine_id,
                    downtime_reason_id,
                    started_at,
                    ended_at,
                    duration_minutes,
                    comment,
                    created_by_user_id,
                    updated_by_user_id
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING downtime_id;
                """,
                (
                    payload.machine_id,
                    payload.downtime_reason_id,
                    payload.started_at,
                    payload.ended_at,
                    duration_minutes,
                    payload.comment,
                    current_user["id"],
                    current_user["id"],
                ),
            )
            created_row = cursor.fetchone()

        connection.commit()
        return require_equipment_downtime_exists(connection, int(created_row["downtime_id"]))
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать запись простоя.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.put(
    "/{downtime_id}",
    response_model=EquipmentDowntimeRead,
)
def update_equipment_downtime(
    payload: EquipmentDowntimeUpdate,
    downtime_id: int = Path(..., gt=0),
    current_user: dict[str, Any] = Depends(require_roles(*DOWNTIME_WRITE_ROLES)),
):
    connection = None

    try:
        payload_data = payload.model_dump(exclude_unset=True)
        connection = get_connection()

        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT
                    downtime_id,
                    machine_id,
                    downtime_reason_id,
                    started_at,
                    ended_at,
                    comment,
                    created_by_user_id,
                    created_at
                FROM equipment_downtimes
                WHERE downtime_id = %s
                FOR UPDATE;
                """,
                (downtime_id,),
            )
            current_row = cursor.fetchone()
            if current_row is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Запись простоя не найдена.",
                )

            ensure_can_modify_equipment_downtime(current_row, current_user)

            next_machine_id = payload_data.get("machine_id", current_row["machine_id"])
            next_reason_id = payload_data.get("downtime_reason_id", current_row["downtime_reason_id"])
            next_started_at = payload_data.get("started_at", current_row["started_at"])
            next_ended_at = payload_data.get("ended_at", current_row["ended_at"])
            next_comment = payload_data.get("comment", current_row["comment"])

            ensure_machine_exists(cursor, next_machine_id)
            ensure_downtime_reason_exists(cursor, next_reason_id)

            next_duration_minutes = None
            if next_ended_at is not None:
                next_duration_minutes = calculate_duration_minutes(next_started_at, next_ended_at)
            validate_open_downtime_started_at(next_started_at, next_ended_at)

            cursor.execute(
                """
                UPDATE equipment_downtimes
                SET
                    machine_id = %s,
                    downtime_reason_id = %s,
                    started_at = %s,
                    ended_at = %s,
                    duration_minutes = %s,
                    comment = %s,
                    updated_by_user_id = %s,
                    updated_at = NOW()
                WHERE downtime_id = %s;
                """,
                (
                    next_machine_id,
                    next_reason_id,
                    next_started_at,
                    next_ended_at,
                    next_duration_minutes,
                    next_comment,
                    current_user["id"],
                    downtime_id,
                ),
            )

        connection.commit()
        return require_equipment_downtime_exists(connection, downtime_id)
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось обновить запись простоя.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.patch(
    "/{downtime_id}/close",
    response_model=EquipmentDowntimeRead,
)
def close_equipment_downtime(
    payload: EquipmentDowntimeClose,
    downtime_id: int = Path(..., gt=0),
    current_user: dict[str, Any] = Depends(require_roles(*DOWNTIME_WRITE_ROLES)),
):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT
                    downtime_id,
                    started_at,
                    ended_at,
                    comment,
                    created_by_user_id,
                    created_at
                FROM equipment_downtimes
                WHERE downtime_id = %s
                FOR UPDATE;
                """,
                (downtime_id,),
            )
            current_row = cursor.fetchone()
            if current_row is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Запись простоя не найдена.",
                )

            ensure_can_modify_equipment_downtime(current_row, current_user)

            if current_row["ended_at"] is not None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Простой уже закрыт.",
                )

            duration_minutes = calculate_duration_minutes(current_row["started_at"], payload.ended_at)
            next_comment = payload.comment if payload.comment is not None else current_row["comment"]

            cursor.execute(
                """
                UPDATE equipment_downtimes
                SET
                    ended_at = %s,
                    duration_minutes = %s,
                    comment = %s,
                    updated_by_user_id = %s,
                    updated_at = NOW()
                WHERE downtime_id = %s;
                """,
                (
                    payload.ended_at,
                    duration_minutes,
                    next_comment,
                    current_user["id"],
                    downtime_id,
                ),
            )

        connection.commit()
        return require_equipment_downtime_exists(connection, downtime_id)
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось закрыть простой.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.delete(
    "/{downtime_id}",
)
def delete_equipment_downtime(
    downtime_id: int = Path(..., gt=0),
    current_user: dict[str, Any] = Depends(require_roles(*DOWNTIME_WRITE_ROLES)),
):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT downtime_id, created_by_user_id, created_at
                FROM equipment_downtimes
                WHERE downtime_id = %s
                FOR UPDATE;
                """,
                (downtime_id,),
            )
            current_row = cursor.fetchone()

        if current_row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Запись простоя не найдена.",
            )

        ensure_can_modify_equipment_downtime(current_row, current_user)

        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                DELETE FROM equipment_downtimes
                WHERE downtime_id = %s
                RETURNING downtime_id;
                """,
                (downtime_id,),
            )
            deleted_row = cursor.fetchone()

        connection.commit()
        return {
            "downtime_id": int(deleted_row["downtime_id"]),
            "message": "Запись простоя удалена.",
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
            detail="Не удалось удалить запись простоя.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()
