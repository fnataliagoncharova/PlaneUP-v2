from decimal import Decimal
from typing import List

import psycopg2
from fastapi import APIRouter, HTTPException, Path, status
from psycopg2.errors import CheckViolation, ForeignKeyViolation, UniqueViolation
from psycopg2.extras import RealDictCursor

from db import get_connection
from schemas.route_steps import RouteStepCreate, RouteStepRead, RouteStepUpdate


router = APIRouter(tags=["route_steps"])

DEGASSING_ONLY_FIRST_STEP_MESSAGE = (
    "\u0414\u0435\u0433\u0430\u0437\u0430\u0446\u0438\u044f \u043c\u043e\u0436\u0435\u0442 "
    "\u0431\u044b\u0442\u044c \u0443\u043a\u0430\u0437\u0430\u043d\u0430 \u0442\u043e\u043b\u044c"
    "\u043a\u043e \u0434\u043b\u044f \u043f\u0435\u0440\u0432\u043e\u0433\u043e \u0448\u0430\u0433"
    "\u0430 \u043c\u0430\u0440\u0448\u0440\u0443\u0442\u0430."
)

SELECT_COLUMNS = """
    route_step_id,
    route_id,
    step_no,
    process_id,
    output_nomenclature_id,
    output_qty,
    post_process_wait_hours,
    notes
"""

STRUCTURE_FIELDS = (
    "step_no",
    "process_id",
    "output_nomenclature_id",
    "output_qty",
    "post_process_wait_hours",
)


def get_constraint_name(exc: Exception) -> str | None:
    return getattr(getattr(exc, "diag", None), "constraint_name", None)


def ensure_route_exists(cursor: RealDictCursor, route_id: int) -> None:
    cursor.execute(
        """
        SELECT 1
        FROM routes
        WHERE route_id = %s;
        """,
        (route_id,),
    )

    if cursor.fetchone() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Маршрут не найден.",
        )


def validate_post_process_wait_hours(step_no: int, wait_hours: Decimal | None) -> None:
    if step_no > 1 and wait_hours is not None and wait_hours > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=DEGASSING_ONLY_FIRST_STEP_MESSAGE,
        )


def get_route_step_for_update(cursor: RealDictCursor, route_step_id: int) -> dict:
    cursor.execute(
        """
        SELECT
            route_step_id,
            route_id,
            step_no,
            process_id,
            output_nomenclature_id,
            output_qty,
            post_process_wait_hours
        FROM route_steps
        WHERE route_step_id = %s
        FOR UPDATE;
        """,
        (route_step_id,),
    )
    step_row = cursor.fetchone()

    if step_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Шаг маршрута не найден.",
        )

    return step_row


def is_step_structure_changed(previous_step: dict, payload: RouteStepUpdate) -> bool:
    return any(previous_step[field] != getattr(payload, field) for field in STRUCTURE_FIELDS)


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


@router.get("/routes/{route_id}/steps", response_model=List[RouteStepRead])
def list_route_steps(route_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            ensure_route_exists(cursor, route_id)
            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM route_steps
                WHERE route_id = %s
                ORDER BY step_no;
                """,
                (route_id,),
            )
            rows = cursor.fetchall()

        return rows
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить шаги маршрута.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.get("/route-steps/{route_step_id}", response_model=RouteStepRead)
def get_route_step(route_step_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM route_steps
                WHERE route_step_id = %s;
                """,
                (route_step_id,),
            )
            row = cursor.fetchone()

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Шаг маршрута не найден.",
            )

        return row
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить шаг маршрута.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.post("/routes/{route_id}/steps", response_model=RouteStepRead, status_code=status.HTTP_201_CREATED)
def create_route_step(payload: RouteStepCreate, route_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            ensure_route_exists(cursor, route_id)
            validate_post_process_wait_hours(payload.step_no, payload.post_process_wait_hours)
            cursor.execute(
                f"""
                INSERT INTO route_steps (
                    route_id,
                    step_no,
                    process_id,
                    output_nomenclature_id,
                    output_qty,
                    post_process_wait_hours,
                    notes
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING {SELECT_COLUMNS};
                """,
                (
                    route_id,
                    payload.step_no,
                    payload.process_id,
                    payload.output_nomenclature_id,
                    payload.output_qty,
                    payload.post_process_wait_hours,
                    payload.notes,
                ),
            )
            created_row = cursor.fetchone()
            deactivate_route_if_active(cursor, route_id)

        connection.commit()
        return created_row
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()

        if get_constraint_name(exc) == "route_steps_route_id_step_no_key":
            detail = "Номер шага уже существует в этом маршруте."
        else:
            detail = "Не удалось создать шаг маршрута из-за ограничения уникальности."

        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc
    except ForeignKeyViolation as exc:
        if connection is not None:
            connection.rollback()

        constraint_name = get_constraint_name(exc)
        if constraint_name == "route_steps_process_id_fkey":
            detail = "Технологическая операция не найдена."
        elif constraint_name == "route_steps_output_nomenclature_id_fkey":
            detail = "Выходная номенклатура не найдена."
        elif constraint_name == "route_steps_route_id_fkey":
            detail = "Маршрут не найден."
        else:
            detail = "Некорректная ссылка на связанный объект."

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    except CheckViolation as exc:
        if connection is not None:
            connection.rollback()

        constraint_name = get_constraint_name(exc)
        if constraint_name == "route_steps_step_no_check":
            detail = "Номер шага должен быть больше 0."
        elif constraint_name == "route_steps_output_qty_check":
            detail = "Количество результата должно быть больше 0."
        elif constraint_name == "route_steps_post_process_wait_hours_check":
            detail = "Значение технологической выдержки должно быть больше или равно 0."
        else:
            detail = "Некорректные данные шага маршрута."

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать шаг маршрута.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.put("/route-steps/{route_step_id}", response_model=RouteStepRead)
def update_route_step(payload: RouteStepUpdate, route_step_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            previous_step = get_route_step_for_update(cursor, route_step_id)
            validate_post_process_wait_hours(payload.step_no, payload.post_process_wait_hours)
            is_structure_changed = is_step_structure_changed(previous_step, payload)

            cursor.execute(
                f"""
                UPDATE route_steps
                SET
                    step_no = %s,
                    process_id = %s,
                    output_nomenclature_id = %s,
                    output_qty = %s,
                    post_process_wait_hours = %s,
                    notes = %s,
                    updated_at = NOW()
                WHERE route_step_id = %s
                RETURNING {SELECT_COLUMNS};
                """,
                (
                    payload.step_no,
                    payload.process_id,
                    payload.output_nomenclature_id,
                    payload.output_qty,
                    payload.post_process_wait_hours,
                    payload.notes,
                    route_step_id,
                ),
            )
            updated_row = cursor.fetchone()

            if updated_row is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Шаг маршрута не найден.",
                )

            if is_structure_changed:
                deactivate_route_if_active(cursor, previous_step["route_id"])

        connection.commit()
        return updated_row
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()

        if get_constraint_name(exc) == "route_steps_route_id_step_no_key":
            detail = "Номер шага уже существует в этом маршруте."
        else:
            detail = "Не удалось сохранить шаг маршрута из-за ограничения уникальности."

        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc
    except ForeignKeyViolation as exc:
        if connection is not None:
            connection.rollback()

        constraint_name = get_constraint_name(exc)
        if constraint_name == "route_steps_process_id_fkey":
            detail = "Технологическая операция не найдена."
        elif constraint_name == "route_steps_output_nomenclature_id_fkey":
            detail = "Выходная номенклатура не найдена."
        elif constraint_name == "route_steps_route_id_fkey":
            detail = "Маршрут не найден."
        else:
            detail = "Некорректная ссылка на связанный объект."

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    except CheckViolation as exc:
        if connection is not None:
            connection.rollback()

        constraint_name = get_constraint_name(exc)
        if constraint_name == "route_steps_step_no_check":
            detail = "Номер шага должен быть больше 0."
        elif constraint_name == "route_steps_output_qty_check":
            detail = "Количество результата должно быть больше 0."
        elif constraint_name == "route_steps_post_process_wait_hours_check":
            detail = "Значение технологической выдержки должно быть больше или равно 0."
        else:
            detail = "Некорректные данные шага маршрута."

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось изменить шаг маршрута.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.delete("/route-steps/{route_step_id}", response_model=RouteStepRead)
def delete_route_step(route_step_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            step_row = get_route_step_for_update(cursor, route_step_id)

            cursor.execute(
                """
                DELETE FROM route_step_inputs
                WHERE route_step_id = %s;
                """,
                (route_step_id,),
            )
            cursor.execute(
                """
                DELETE FROM route_step_equipment
                WHERE route_step_id = %s;
                """,
                (route_step_id,),
            )
            cursor.execute(
                f"""
                DELETE FROM route_steps
                WHERE route_step_id = %s
                RETURNING {SELECT_COLUMNS};
                """,
                (route_step_id,),
            )
            deleted_row = cursor.fetchone()

            if deleted_row is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Шаг маршрута не найден.",
                )

            deactivate_route_if_active(cursor, step_row["route_id"])

        connection.commit()
        return deleted_row
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось удалить шаг маршрута.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()
