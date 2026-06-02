from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

import psycopg2
from fastapi import APIRouter, HTTPException, Path, Query, status
from psycopg2.extras import RealDictCursor

from db import get_connection
from schemas.inventory_balance_degassing import (
    InventoryBalanceDegassingCreate,
    InventoryBalanceDegassingDeleteResponse,
    InventoryBalanceDegassingRead,
    InventoryBalanceDegassingUpdate,
)


router = APIRouter(prefix="/inventory-balance-degassing", tags=["inventory_balance_degassing"])

SELECT_COLUMNS = """
    ibd.balance_degassing_id,
    ibd.as_of_date,
    ibd.nomenclature_id,
    n.nomenclature_code,
    n.nomenclature_name,
    n.unit_of_measure,
    ibd.qty,
    ibd.available_at,
    ibd.comment,
    ibd.created_at,
    ibd.updated_at
"""


def get_balance_start_datetime(as_of_date: date) -> datetime:
    return datetime.combine(as_of_date, time(hour=7))


def validate_qty(qty: Decimal) -> None:
    if qty <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Количество должно быть больше 0.",
        )


def validate_available_at(as_of_date: date, available_at: datetime) -> None:
    if available_at <= get_balance_start_datetime(as_of_date):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Дата доступности должна быть позже даты остатков 07:00.",
        )


def ensure_nomenclature_exists(cursor: RealDictCursor, nomenclature_id: int) -> None:
    cursor.execute(
        """
        SELECT nomenclature_id
        FROM nomenclature
        WHERE nomenclature_id = %s;
        """,
        (nomenclature_id,),
    )
    if cursor.fetchone() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Номенклатура не найдена.",
        )


def lock_inventory_balance(cursor: RealDictCursor, as_of_date: date, nomenclature_id: int) -> Decimal:
    cursor.execute(
        """
        SELECT balance_id, available_qty
        FROM inventory_balance
        WHERE as_of_date = %s
          AND nomenclature_id = %s
        FOR UPDATE;
        """,
        (as_of_date, nomenclature_id),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Для выбранной даты остатков и номенклатуры не найден общий остаток.",
        )
    return row["available_qty"]


def get_existing_degassing_qty(
    cursor: RealDictCursor,
    as_of_date: date,
    nomenclature_id: int,
    exclude_balance_degassing_id: int | None = None,
) -> Decimal:
    where_sql = ""
    params: list[Any] = [as_of_date, nomenclature_id]

    if exclude_balance_degassing_id is not None:
        where_sql = "AND balance_degassing_id <> %s"
        params.append(exclude_balance_degassing_id)

    cursor.execute(
        f"""
        SELECT COALESCE(SUM(qty), 0) AS degassing_qty
        FROM inventory_balance_degassing
        WHERE as_of_date = %s
          AND nomenclature_id = %s
          {where_sql};
        """,
        tuple(params),
    )
    row = cursor.fetchone()
    return row["degassing_qty"] if row is not None else Decimal("0")


def ensure_degassing_qty_within_balance(
    cursor: RealDictCursor,
    as_of_date: date,
    nomenclature_id: int,
    qty: Decimal,
    exclude_balance_degassing_id: int | None = None,
) -> None:
    available_qty = lock_inventory_balance(cursor, as_of_date, nomenclature_id)
    existing_degassing_qty = get_existing_degassing_qty(
        cursor,
        as_of_date,
        nomenclature_id,
        exclude_balance_degassing_id=exclude_balance_degassing_id,
    )

    if existing_degassing_qty + qty > available_qty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Количество остатков в дегазации превышает общий остаток на дату остатков.",
        )


def require_inventory_balance_degassing_exists(connection, balance_degassing_id: int) -> dict[str, Any]:
    with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            f"""
            SELECT {SELECT_COLUMNS}
            FROM inventory_balance_degassing AS ibd
            INNER JOIN nomenclature AS n ON n.nomenclature_id = ibd.nomenclature_id
            WHERE ibd.balance_degassing_id = %s;
            """,
            (balance_degassing_id,),
        )
        row = cursor.fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запись остатков в дегазации не найдена.",
        )

    return row


@router.get("", response_model=list[InventoryBalanceDegassingRead])
def list_inventory_balance_degassing(
    as_of_date: date | None = Query(default=None),
    nomenclature_id: int | None = Query(default=None, gt=0),
):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            where_clauses: list[str] = []
            params: list[Any] = []

            if as_of_date is not None:
                where_clauses.append("ibd.as_of_date = %s")
                params.append(as_of_date)

            if nomenclature_id is not None:
                where_clauses.append("ibd.nomenclature_id = %s")
                params.append(nomenclature_id)

            where_sql = ""
            if where_clauses:
                where_sql = "WHERE " + " AND ".join(where_clauses)

            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM inventory_balance_degassing AS ibd
                INNER JOIN nomenclature AS n ON n.nomenclature_id = ibd.nomenclature_id
                {where_sql}
                ORDER BY ibd.as_of_date DESC, n.nomenclature_code ASC, ibd.available_at ASC;
                """,
                tuple(params),
            )
            return cursor.fetchall()
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить список остатков в дегазации.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.post("", response_model=InventoryBalanceDegassingRead, status_code=status.HTTP_201_CREATED)
def create_inventory_balance_degassing(payload: InventoryBalanceDegassingCreate):
    connection = None

    try:
        validate_qty(payload.qty)
        validate_available_at(payload.as_of_date, payload.available_at)

        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            ensure_nomenclature_exists(cursor, payload.nomenclature_id)
            ensure_degassing_qty_within_balance(
                cursor,
                payload.as_of_date,
                payload.nomenclature_id,
                payload.qty,
            )

            cursor.execute(
                """
                INSERT INTO inventory_balance_degassing (
                    as_of_date,
                    nomenclature_id,
                    qty,
                    available_at,
                    comment
                )
                VALUES (%s, %s, %s, %s, %s)
                RETURNING balance_degassing_id;
                """,
                (
                    payload.as_of_date,
                    payload.nomenclature_id,
                    payload.qty,
                    payload.available_at,
                    payload.comment,
                ),
            )
            created_row = cursor.fetchone()

        connection.commit()
        return require_inventory_balance_degassing_exists(connection, int(created_row["balance_degassing_id"]))
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать запись остатков в дегазации.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.put("/{balance_degassing_id}", response_model=InventoryBalanceDegassingRead)
def update_inventory_balance_degassing(
    payload: InventoryBalanceDegassingUpdate,
    balance_degassing_id: int = Path(..., gt=0),
):
    connection = None

    try:
        validate_qty(payload.qty)

        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT balance_degassing_id, as_of_date, nomenclature_id
                FROM inventory_balance_degassing
                WHERE balance_degassing_id = %s
                FOR UPDATE;
                """,
                (balance_degassing_id,),
            )
            current_row = cursor.fetchone()
            if current_row is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Запись остатков в дегазации не найдена.",
                )

            validate_available_at(current_row["as_of_date"], payload.available_at)
            ensure_nomenclature_exists(cursor, current_row["nomenclature_id"])
            ensure_degassing_qty_within_balance(
                cursor,
                current_row["as_of_date"],
                current_row["nomenclature_id"],
                payload.qty,
                exclude_balance_degassing_id=balance_degassing_id,
            )

            cursor.execute(
                """
                UPDATE inventory_balance_degassing
                SET
                    qty = %s,
                    available_at = %s,
                    comment = %s,
                    updated_at = NOW()
                WHERE balance_degassing_id = %s;
                """,
                (
                    payload.qty,
                    payload.available_at,
                    payload.comment,
                    balance_degassing_id,
                ),
            )

        connection.commit()
        return require_inventory_balance_degassing_exists(connection, balance_degassing_id)
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось обновить запись остатков в дегазации.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.delete("/{balance_degassing_id}", response_model=InventoryBalanceDegassingDeleteResponse)
def delete_inventory_balance_degassing(balance_degassing_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                DELETE FROM inventory_balance_degassing
                WHERE balance_degassing_id = %s
                RETURNING balance_degassing_id;
                """,
                (balance_degassing_id,),
            )
            deleted_row = cursor.fetchone()
            if deleted_row is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Запись остатков в дегазации не найдена.",
                )

        connection.commit()
        return InventoryBalanceDegassingDeleteResponse(
            balance_degassing_id=balance_degassing_id,
            message="Запись остатков в дегазации удалена.",
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
            detail="Не удалось удалить запись остатков в дегазации.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()
