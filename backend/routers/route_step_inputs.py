from typing import List

import psycopg2
from fastapi import APIRouter, HTTPException, Path, status
from psycopg2.errors import ForeignKeyViolation
from psycopg2.extras import RealDictCursor

from db import get_connection
from schemas.route_step_inputs import (
    RouteStepInputCreate,
    RouteStepInputRead,
    RouteStepInputUpdate,
)


router = APIRouter(tags=["route_step_inputs"])

SELECT_COLUMNS = """
    rsi.step_input_id,
    rsi.route_step_id,
    rsi.input_nomenclature_id,
    rsi.input_qty,
    n.nomenclature_code AS input_nomenclature_code,
    n.nomenclature_name AS input_nomenclature_name,
    n.unit_of_measure AS input_nomenclature_uom,
    n.item_type AS input_nomenclature_item_type
"""


def get_constraint_name(exc: Exception) -> str | None:
    return getattr(getattr(exc, "diag", None), "constraint_name", None)


def get_route_step(cursor: RealDictCursor, route_step_id: int, lock: bool = False) -> dict:
    lock_clause = "FOR UPDATE" if lock else ""
    cursor.execute(
        f"""
        SELECT route_step_id, route_id
        FROM route_steps
        WHERE route_step_id = %s
        {lock_clause};
        """,
        (route_step_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Шаг маршрута не найден.")
    return row


def get_step_input_with_route(cursor: RealDictCursor, step_input_id: int, lock: bool = False) -> dict:
    lock_clause = "FOR UPDATE OF rsi, rs" if lock else ""
    cursor.execute(
        f"""
        SELECT rsi.step_input_id, rsi.route_step_id, rs.route_id
        FROM route_step_inputs AS rsi
        INNER JOIN route_steps AS rs ON rs.route_step_id = rsi.route_step_id
        WHERE rsi.step_input_id = %s
        {lock_clause};
        """,
        (step_input_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Вход шага не найден.")
    return row


def deactivate_route_if_active(cursor: RealDictCursor, route_id: int) -> bool:
    cursor.execute(
        """
        UPDATE routes
        SET is_active = FALSE, updated_at = NOW()
        WHERE route_id = %s AND is_active = TRUE
        RETURNING route_id;
        """,
        (route_id,),
    )
    return cursor.fetchone() is not None


def ensure_nomenclature_exists(cursor: RealDictCursor, nomenclature_id: int) -> None:
    cursor.execute("SELECT nomenclature_id FROM nomenclature WHERE nomenclature_id = %s;", (nomenclature_id,))
    if cursor.fetchone() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Номенклатура не найдена.")


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
                FROM route_step_inputs AS rsi
                INNER JOIN nomenclature AS n ON n.nomenclature_id = rsi.input_nomenclature_id
                WHERE rsi.route_step_id = %s
                ORDER BY rsi.step_input_id;
                """,
                (route_step_id,),
            )
            return cursor.fetchall()
    except psycopg2.Error as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось получить входы шага.") from exc
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
                FROM route_step_inputs AS rsi
                INNER JOIN nomenclature AS n ON n.nomenclature_id = rsi.input_nomenclature_id
                WHERE rsi.step_input_id = %s;
                """,
                (step_input_id,),
            )
            row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Вход шага не найден.")
        return row
    except psycopg2.Error as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось получить вход шага.") from exc
    finally:
        if connection is not None:
            connection.close()


@router.post("/route-steps/{route_step_id}/inputs", response_model=RouteStepInputRead, status_code=status.HTTP_201_CREATED)
def create_route_step_input(payload: RouteStepInputCreate, route_step_id: int = Path(..., gt=0)):
    connection = None
    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            route_step_row = get_route_step(cursor, route_step_id, lock=True)

            if not payload.input_nomenclature_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Вход шага должен быть выбран из номенклатуры.")
            ensure_nomenclature_exists(cursor, payload.input_nomenclature_id)

            cursor.execute(
                """
                INSERT INTO route_step_inputs (route_step_id, input_nomenclature_id, input_qty)
                VALUES (%s, %s, %s)
                RETURNING step_input_id;
                """,
                (route_step_id, payload.input_nomenclature_id, payload.input_qty),
            )
            created = cursor.fetchone()

            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM route_step_inputs AS rsi
                INNER JOIN nomenclature AS n ON n.nomenclature_id = rsi.input_nomenclature_id
                WHERE rsi.step_input_id = %s;
                """,
                (created["step_input_id"],),
            )
            created_row = cursor.fetchone()
            deactivate_route_if_active(cursor, route_step_row["route_id"])

        connection.commit()
        return created_row
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except ForeignKeyViolation as exc:
        if connection is not None:
            connection.rollback()
        name = get_constraint_name(exc)
        if name == "route_step_inputs_input_nomenclature_id_fkey":
            detail = "Номенклатура не найдена."
        elif name == "route_step_inputs_route_step_id_fkey":
            detail = "Шаг маршрута не найден."
        else:
            detail = "Некорректная ссылка на связанный объект."
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось создать вход шага.") from exc
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

            if not payload.input_nomenclature_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Вход шага должен быть выбран из номенклатуры.")
            ensure_nomenclature_exists(cursor, payload.input_nomenclature_id)

            cursor.execute(
                """
                UPDATE route_step_inputs
                SET input_nomenclature_id = %s, input_qty = %s, updated_at = NOW()
                WHERE step_input_id = %s
                RETURNING step_input_id;
                """,
                (payload.input_nomenclature_id, payload.input_qty, step_input_id),
            )
            updated = cursor.fetchone()
            if updated is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Вход шага не найден.")

            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM route_step_inputs AS rsi
                INNER JOIN nomenclature AS n ON n.nomenclature_id = rsi.input_nomenclature_id
                WHERE rsi.step_input_id = %s;
                """,
                (step_input_id,),
            )
            updated_row = cursor.fetchone()
            deactivate_route_if_active(cursor, step_input_row["route_id"])

        connection.commit()
        return updated_row
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except ForeignKeyViolation as exc:
        if connection is not None:
            connection.rollback()
        name = get_constraint_name(exc)
        if name == "route_step_inputs_input_nomenclature_id_fkey":
            detail = "Номенклатура не найдена."
        elif name == "route_step_inputs_route_step_id_fkey":
            detail = "Шаг маршрута не найден."
        else:
            detail = "Некорректная ссылка на связанный объект."
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось изменить вход шага.") from exc
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
                SELECT {SELECT_COLUMNS}
                FROM route_step_inputs AS rsi
                INNER JOIN nomenclature AS n ON n.nomenclature_id = rsi.input_nomenclature_id
                WHERE rsi.step_input_id = %s;
                """,
                (step_input_id,),
            )
            existing_row = cursor.fetchone()
            cursor.execute(
                """
                DELETE FROM route_step_inputs
                WHERE step_input_id = %s
                RETURNING step_input_id;
                """,
                (step_input_id,),
            )
            deleted = cursor.fetchone()
            if deleted is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Вход шага не найден.")
            deactivate_route_if_active(cursor, step_input_row["route_id"])

        connection.commit()
        return existing_row
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Не удалось удалить вход шага.") from exc
    finally:
        if connection is not None:
            connection.close()
