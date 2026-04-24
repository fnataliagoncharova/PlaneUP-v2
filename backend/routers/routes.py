from typing import List

import psycopg2
from fastapi import APIRouter, HTTPException, Path, status
from psycopg2.errors import ForeignKeyViolation, UniqueViolation
from psycopg2.extras import RealDictCursor

from db import get_connection
from schemas.routes import RouteCreate, RouteRead, RouteUpdate


router = APIRouter(prefix="/routes", tags=["routes"])

SELECT_COLUMNS = """
    route_id,
    route_code,
    route_name,
    result_nomenclature_id,
    is_active
"""


def has_steps_without_inputs(cursor: RealDictCursor, route_id: int) -> bool:
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM route_steps AS rs
            WHERE rs.route_id = %s
              AND NOT EXISTS (
                  SELECT 1
                  FROM route_step_inputs AS rsi
                  WHERE rsi.route_step_id = rs.route_step_id
              )
        ) AS has_steps_without_inputs;
        """,
        (route_id,),
    )
    row = cursor.fetchone()
    return bool(row and row["has_steps_without_inputs"])


def get_last_step_output_nomenclature_id(cursor: RealDictCursor, route_id: int) -> int | None:
    cursor.execute(
        """
        SELECT output_nomenclature_id
        FROM route_steps
        WHERE route_id = %s
        ORDER BY step_no DESC, route_step_id DESC
        LIMIT 1;
        """,
        (route_id,),
    )
    row = cursor.fetchone()
    if row is None:
        return None

    return row["output_nomenclature_id"]


def ensure_route_can_be_activated(
    cursor: RealDictCursor,
    route_id: int,
    result_nomenclature_id: int,
) -> None:
    last_step_output_nomenclature_id = get_last_step_output_nomenclature_id(cursor, route_id)

    if last_step_output_nomenclature_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя активировать маршрут: не добавлены шаги.",
        )

    if has_steps_without_inputs(cursor, route_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя активировать маршрут: есть шаги без входов.",
        )

    if last_step_output_nomenclature_id != result_nomenclature_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Нельзя активировать маршрут: "
                "выход последнего шага не совпадает с выходом маршрута."
            ),
        )


@router.get("", response_model=List[RouteRead])
def list_routes():
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM routes
                ORDER BY route_code;
                """
            )
            rows = cursor.fetchall()

        return rows
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить список маршрутов.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.get("/{route_id}", response_model=RouteRead)
def get_route(route_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM routes
                WHERE route_id = %s;
                """,
                (route_id,),
            )
            row = cursor.fetchone()

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Маршрут не найден.",
            )

        return row
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить маршрут.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.post("", response_model=RouteRead, status_code=status.HTTP_201_CREATED)
def create_route(payload: RouteCreate):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                INSERT INTO routes (
                    route_code,
                    route_name,
                    result_nomenclature_id,
                    is_active
                )
                VALUES (%s, %s, %s, %s)
                RETURNING {SELECT_COLUMNS};
                """,
                (
                    payload.route_code,
                    payload.route_name,
                    payload.result_nomenclature_id,
                    payload.is_active,
                ),
            )
            created_row = cursor.fetchone()

        connection.commit()
        return created_row
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Код маршрута уже существует",
        ) from exc
    except ForeignKeyViolation as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Выходная номенклатура не найдена.",
        ) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать маршрут.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.put("/{route_id}", response_model=RouteRead)
def update_route(payload: RouteUpdate, route_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT is_active
                FROM routes
                WHERE route_id = %s
                FOR UPDATE;
                """,
                (route_id,),
            )
            existing_route = cursor.fetchone()

            if existing_route is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Маршрут не найден.",
                )

            is_activation_transition = not existing_route["is_active"] and payload.is_active
            if is_activation_transition:
                ensure_route_can_be_activated(
                    cursor=cursor,
                    route_id=route_id,
                    result_nomenclature_id=payload.result_nomenclature_id,
                )

            cursor.execute(
                f"""
                UPDATE routes
                SET
                    route_code = %s,
                    route_name = %s,
                    result_nomenclature_id = %s,
                    is_active = %s,
                    updated_at = NOW()
                WHERE route_id = %s
                RETURNING {SELECT_COLUMNS};
                """,
                (
                    payload.route_code,
                    payload.route_name,
                    payload.result_nomenclature_id,
                    payload.is_active,
                    route_id,
                ),
            )
            updated_row = cursor.fetchone()

        if updated_row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Маршрут не найден.",
            )

        connection.commit()
        return updated_row
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Код маршрута уже существует",
        ) from exc
    except ForeignKeyViolation as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Выходная номенклатура не найдена.",
        ) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось изменить маршрут.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.delete("/{route_id}", response_model=RouteRead)
def deactivate_route(route_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                UPDATE routes
                SET
                    is_active = FALSE,
                    updated_at = NOW()
                WHERE route_id = %s
                RETURNING {SELECT_COLUMNS};
                """,
                (route_id,),
            )
            deactivated_row = cursor.fetchone()

        if deactivated_row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Маршрут не найден.",
            )

        connection.commit()
        return deactivated_row
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось деактивировать маршрут.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()