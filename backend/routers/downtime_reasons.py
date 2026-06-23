from typing import Any

import psycopg2
from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from psycopg2 import sql
from psycopg2.errors import UniqueViolation
from psycopg2.extras import RealDictCursor

from auth.rbac import require_roles
from db import get_connection
from schemas.downtime_reason import (
    DowntimeReasonCreate,
    DowntimeReasonDeleteResponse,
    DowntimeReasonRead,
    DowntimeReasonUpdate,
)


router = APIRouter(prefix="/downtime-reasons", tags=["downtime_reasons"])

DTIME_REASON_READ_ROLES = ("planner", "master", "maintenance", "viewer")
DTIME_REASON_WRITE_ROLES = ("planner", "maintenance")

SELECT_COLUMNS = """
    downtime_reason_id,
    reason_code,
    reason_name,
    reason_category,
    comment,
    created_at,
    updated_at
"""

DOWNTIME_FACT_TABLES = (
    "equipment_downtimes",
    "unplanned_downtimes",
    "downtime_journal",
)


def validate_reason_code(value: str) -> str:
    normalized_value = str(value or "").strip()
    if not normalized_value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Код причины обязателен.",
        )
    return normalized_value


def validate_reason_name(value: str) -> str:
    normalized_value = str(value or "").strip()
    if not normalized_value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Наименование причины обязательно.",
        )
    return normalized_value


def validate_reason_category(value: str) -> str:
    normalized_value = str(value or "").strip()
    if not normalized_value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Категория причины обязательна.",
        )
    return normalized_value


def build_payload_data(payload: DowntimeReasonCreate | DowntimeReasonUpdate) -> dict[str, Any]:
    return {
        "reason_code": validate_reason_code(payload.reason_code),
        "reason_name": validate_reason_name(payload.reason_name),
        "reason_category": validate_reason_category(payload.reason_category),
        "comment": payload.comment,
    }


def require_downtime_reason_exists(connection, downtime_reason_id: int) -> dict[str, Any]:
    with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            f"""
            SELECT {SELECT_COLUMNS}
            FROM downtime_reasons
            WHERE downtime_reason_id = %s;
            """,
            (downtime_reason_id,),
        )
        row = cursor.fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Причина простоя не найдена.",
        )

    return row


def ensure_reason_code_unique(
    cursor: RealDictCursor,
    reason_code: str,
    exclude_downtime_reason_id: int | None = None,
) -> None:
    params: list[Any] = [reason_code]
    where_sql = ""
    if exclude_downtime_reason_id is not None:
        where_sql = "AND downtime_reason_id <> %s"
        params.append(exclude_downtime_reason_id)

    cursor.execute(
        f"""
        SELECT downtime_reason_id
        FROM downtime_reasons
        WHERE reason_code = %s
          {where_sql}
        LIMIT 1;
        """,
        tuple(params),
    )
    if cursor.fetchone() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Причина простоя с таким кодом уже существует.",
        )


def table_exists(cursor: RealDictCursor, table_name: str) -> bool:
    cursor.execute("SELECT to_regclass(%s) AS table_name;", (f"public.{table_name}",))
    row = cursor.fetchone() or {}
    return row.get("table_name") is not None


def table_has_downtime_reason_id(cursor: RealDictCursor, table_name: str) -> bool:
    cursor.execute(
        """
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = %s
          AND column_name = 'downtime_reason_id'
        LIMIT 1;
        """,
        (table_name,),
    )
    return cursor.fetchone() is not None


def ensure_reason_is_not_used(cursor: RealDictCursor, downtime_reason_id: int) -> None:
    for table_name in DOWNTIME_FACT_TABLES:
        if not table_exists(cursor, table_name):
            continue
        if not table_has_downtime_reason_id(cursor, table_name):
            continue

        cursor.execute(
            sql.SQL(
                """
                SELECT 1
                FROM {table_name}
                WHERE downtime_reason_id = %s
                LIMIT 1;
                """
            ).format(table_name=sql.Identifier(table_name)),
            (downtime_reason_id,),
        )
        if cursor.fetchone() is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Нельзя удалить причину простоя: по ней уже есть факты простоев.",
            )


@router.get(
    "",
    response_model=list[DowntimeReasonRead],
    dependencies=[Depends(require_roles(*DTIME_REASON_READ_ROLES))],
)
def list_downtime_reasons(
    search: str | None = Query(default=None),
    reason_category: str | None = Query(default=None),
):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            where_clauses: list[str] = []
            params: list[Any] = []

            normalized_search = str(search or "").strip()
            if normalized_search:
                like_value = f"%{normalized_search}%"
                where_clauses.append(
                    "(reason_code ILIKE %s OR reason_name ILIKE %s OR COALESCE(comment, '') ILIKE %s)"
                )
                params.extend([like_value, like_value, like_value])

            normalized_category = str(reason_category or "").strip()
            if normalized_category:
                where_clauses.append("reason_category = %s")
                params.append(normalized_category)

            where_sql = ""
            if where_clauses:
                where_sql = "WHERE " + " AND ".join(where_clauses)

            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM downtime_reasons
                {where_sql}
                ORDER BY reason_category ASC, reason_code ASC;
                """,
                tuple(params),
            )
            return cursor.fetchall()
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить список причин простоев.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.post(
    "",
    response_model=DowntimeReasonRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*DTIME_REASON_WRITE_ROLES))],
)
def create_downtime_reason(payload: DowntimeReasonCreate):
    connection = None

    try:
        payload_data = build_payload_data(payload)
        connection = get_connection()

        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            ensure_reason_code_unique(cursor, payload_data["reason_code"])
            cursor.execute(
                """
                INSERT INTO downtime_reasons (
                    reason_code,
                    reason_name,
                    reason_category,
                    comment
                )
                VALUES (%s, %s, %s, %s)
                RETURNING downtime_reason_id;
                """,
                (
                    payload_data["reason_code"],
                    payload_data["reason_name"],
                    payload_data["reason_category"],
                    payload_data["comment"],
                ),
            )
            created_row = cursor.fetchone()

        connection.commit()
        return require_downtime_reason_exists(connection, int(created_row["downtime_reason_id"]))
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Причина простоя с таким кодом уже существует.",
        ) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать причину простоя.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.put(
    "/{downtime_reason_id}",
    response_model=DowntimeReasonRead,
    dependencies=[Depends(require_roles(*DTIME_REASON_WRITE_ROLES))],
)
def update_downtime_reason(
    payload: DowntimeReasonUpdate,
    downtime_reason_id: int = Path(..., gt=0),
):
    connection = None

    try:
        payload_data = build_payload_data(payload)
        connection = get_connection()

        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT downtime_reason_id
                FROM downtime_reasons
                WHERE downtime_reason_id = %s
                FOR UPDATE;
                """,
                (downtime_reason_id,),
            )
            if cursor.fetchone() is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Причина простоя не найдена.",
                )

            ensure_reason_code_unique(
                cursor,
                payload_data["reason_code"],
                exclude_downtime_reason_id=downtime_reason_id,
            )

            cursor.execute(
                """
                UPDATE downtime_reasons
                SET
                    reason_code = %s,
                    reason_name = %s,
                    reason_category = %s,
                    comment = %s,
                    updated_at = NOW()
                WHERE downtime_reason_id = %s;
                """,
                (
                    payload_data["reason_code"],
                    payload_data["reason_name"],
                    payload_data["reason_category"],
                    payload_data["comment"],
                    downtime_reason_id,
                ),
            )

        connection.commit()
        return require_downtime_reason_exists(connection, downtime_reason_id)
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Причина простоя с таким кодом уже существует.",
        ) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось обновить причину простоя.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.delete(
    "/{downtime_reason_id}",
    response_model=DowntimeReasonDeleteResponse,
    dependencies=[Depends(require_roles(*DTIME_REASON_WRITE_ROLES))],
)
def delete_downtime_reason(downtime_reason_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()

        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT downtime_reason_id
                FROM downtime_reasons
                WHERE downtime_reason_id = %s
                FOR UPDATE;
                """,
                (downtime_reason_id,),
            )
            if cursor.fetchone() is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Причина простоя не найдена.",
                )

            ensure_reason_is_not_used(cursor, downtime_reason_id)

            cursor.execute(
                """
                DELETE FROM downtime_reasons
                WHERE downtime_reason_id = %s
                RETURNING downtime_reason_id;
                """,
                (downtime_reason_id,),
            )
            deleted_row = cursor.fetchone()

        connection.commit()
        return DowntimeReasonDeleteResponse(
            downtime_reason_id=int(deleted_row["downtime_reason_id"]),
            message="Причина простоя удалена.",
        )
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось удалить причину простоя.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()
