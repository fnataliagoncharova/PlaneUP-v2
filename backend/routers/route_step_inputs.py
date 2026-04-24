from typing import List

import psycopg2
from fastapi import APIRouter, HTTPException, Path, status
from psycopg2.errors import CheckViolation, ForeignKeyViolation
from psycopg2.extras import RealDictCursor

from db import get_connection
from schemas.route_step_inputs import (
    RouteStepInputCreate,
    RouteStepInputRead,
    RouteStepInputUpdate,
)


router = APIRouter(tags=["route_step_inputs"])

SELECT_COLUMNS = """
    step_input_id,
    route_step_id,
    input_nomenclature_id,
    external_input_name,
    input_qty
"""


def get_constraint_name(exc: Exception) -> str | None:
    return getattr(getattr(exc, "diag", None), "constraint_name", None)


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


def get_step_input_with_route(cursor: RealDictCursor, step_input_id: int, lock: bool = False) -> dict:
    lock_clause = "FOR UPDATE OF rsi, rs" if lock else ""
    cursor.execute(
        f"""
        SELECT
            rsi.step_input_id,
            rsi.route_step_id,
            rs.route_id
        FROM route_step_inputs AS rsi
        INNER JOIN route_steps AS rs ON rs.route_step_id = rsi.route_step_id
        WHERE rsi.step_input_id = %s
        {lock_clause};
        """,
        (step_input_id,),
    )
    step_input_row = cursor.fetchone()

    if step_input_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Вход шага не найден.",
        )

    return step_input_row


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


@router.get("/route-steps/{route_step_id}/inputs", response_model=List[RouteStepInputRead])
def list_route_step_inputs(route_step_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            get_route_step(cursor, route_step_id)
            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM route_step_inputs
                WHERE route_step_id = %s
                ORDER BY step_input_id;
                """,
                (route_step_id,),
            )
            rows = cursor.fetchall()

        return rows
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить входы шага.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.get("/route-step-inputs/{step_input_id}", response_model=RouteStepInputRead)
def get_route_step_input(step_input_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM route_step_inputs
                WHERE step_input_id = %s;
                """,
                (step_input_id,),
            )
            row = cursor.fetchone()

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Вход шага не найден.",
            )

        return row
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить вход шага.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.post(
    "/route-steps/{route_step_id}/inputs",
    response_model=RouteStepInputRead,
    status_code=status.HTTP_201_CREATED,
)
def create_route_step_input(payload: RouteStepInputCreate, route_step_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            route_step_row = get_route_step(cursor, route_step_id, lock=True)
            cursor.execute(
                f"""
                INSERT INTO route_step_inputs (
                    route_step_id,
                    input_nomenclature_id,
                    external_input_name,
                    input_qty
                )
                VALUES (%s, %s, %s, %s)
                RETURNING {SELECT_COLUMNS};
                """,
                (
                    route_step_id,
                    payload.input_nomenclature_id,
                    payload.external_input_name,
                    payload.input_qty,
                ),
            )
            created_row = cursor.fetchone()
            deactivate_route_if_active(cursor, route_step_row["route_id"])

        connection.commit()
        return created_row
    except ForeignKeyViolation as exc:
        if connection is not None:
            connection.rollback()

        constraint_name = get_constraint_name(exc)
        if constraint_name == "route_step_inputs_input_nomenclature_id_fkey":
            detail = "Номенклатура входа не найдена."
        elif constraint_name == "route_step_inputs_route_step_id_fkey":
            detail = "Шаг маршрута не найден."
        else:
            detail = "Некорректная ссылка на связанный объект."

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    except CheckViolation as exc:
        if connection is not None:
            connection.rollback()

        constraint_name = get_constraint_name(exc)
        if constraint_name == "route_step_inputs_input_qty_check":
            detail = "Количество входа должно быть больше 0."
        elif constraint_name == "route_step_inputs_input_source_check":
            detail = "Заполните номенклатуру или внешний вход."
        else:
            detail = "Заполните номенклатуру или внешний вход."

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать вход шага.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.put("/route-step-inputs/{step_input_id}", response_model=RouteStepInputRead)
def update_route_step_input(payload: RouteStepInputUpdate, step_input_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            step_input_row = get_step_input_with_route(cursor, step_input_id, lock=True)
            cursor.execute(
                f"""
                UPDATE route_step_inputs
                SET
                    input_nomenclature_id = %s,
                    external_input_name = %s,
                    input_qty = %s,
                    updated_at = NOW()
                WHERE step_input_id = %s
                RETURNING {SELECT_COLUMNS};
                """,
                (
                    payload.input_nomenclature_id,
                    payload.external_input_name,
                    payload.input_qty,
                    step_input_id,
                ),
            )
            updated_row = cursor.fetchone()

            if updated_row is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Вход шага не найден.",
                )

            deactivate_route_if_active(cursor, step_input_row["route_id"])

        connection.commit()
        return updated_row
    except ForeignKeyViolation as exc:
        if connection is not None:
            connection.rollback()

        constraint_name = get_constraint_name(exc)
        if constraint_name == "route_step_inputs_input_nomenclature_id_fkey":
            detail = "Номенклатура входа не найдена."
        elif constraint_name == "route_step_inputs_route_step_id_fkey":
            detail = "Шаг маршрута не найден."
        else:
            detail = "Некорректная ссылка на связанный объект."

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    except CheckViolation as exc:
        if connection is not None:
            connection.rollback()

        constraint_name = get_constraint_name(exc)
        if constraint_name == "route_step_inputs_input_qty_check":
            detail = "Количество входа должно быть больше 0."
        elif constraint_name == "route_step_inputs_input_source_check":
            detail = "Заполните номенклатуру или внешний вход."
        else:
            detail = "Заполните номенклатуру или внешний вход."

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось изменить вход шага.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.delete("/route-step-inputs/{step_input_id}", response_model=RouteStepInputRead)
def delete_route_step_input(step_input_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            step_input_row = get_step_input_with_route(cursor, step_input_id, lock=True)
            cursor.execute(
                f"""
                DELETE FROM route_step_inputs
                WHERE step_input_id = %s
                RETURNING {SELECT_COLUMNS};
                """,
                (step_input_id,),
            )
            deleted_row = cursor.fetchone()

            if deleted_row is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Вход шага не найден.",
                )

            deactivate_route_if_active(cursor, step_input_row["route_id"])

        connection.commit()
        return deleted_row
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось удалить вход шага.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()