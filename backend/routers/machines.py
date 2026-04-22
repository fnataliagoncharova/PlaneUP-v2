from typing import List

import psycopg2
from fastapi import APIRouter, HTTPException, Path, status
from psycopg2.errors import UniqueViolation
from psycopg2.extras import RealDictCursor

from db import get_connection
from schemas.machines import MachineCreate, MachineRead, MachineUpdate


router = APIRouter(prefix="/machines", tags=["machines"])

SELECT_COLUMNS = """
    machine_id,
    machine_code,
    machine_name,
    is_active
"""


@router.get("", response_model=List[MachineRead])
def list_machines():
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM machines
                ORDER BY machine_code;
                """
            )
            rows = cursor.fetchall()

        return rows
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить список оборудования.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.get("/{machine_id}", response_model=MachineRead)
def get_machine(machine_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM machines
                WHERE machine_id = %s;
                """,
                (machine_id,),
            )
            row = cursor.fetchone()

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Единица оборудования не найдена.",
            )

        return row
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить единицу оборудования.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.post("", response_model=MachineRead, status_code=status.HTTP_201_CREATED)
def create_machine(payload: MachineCreate):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                INSERT INTO machines (
                    machine_code,
                    machine_name,
                    is_active
                )
                VALUES (%s, %s, %s)
                RETURNING {SELECT_COLUMNS};
                """,
                (
                    payload.machine_code,
                    payload.machine_name,
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
            detail="Код оборудования уже существует",
        ) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать единицу оборудования.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.put("/{machine_id}", response_model=MachineRead)
def update_machine(payload: MachineUpdate, machine_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                UPDATE machines
                SET
                    machine_code = %s,
                    machine_name = %s,
                    is_active = %s,
                    updated_at = NOW()
                WHERE machine_id = %s
                RETURNING {SELECT_COLUMNS};
                """,
                (
                    payload.machine_code,
                    payload.machine_name,
                    payload.is_active,
                    machine_id,
                ),
            )
            updated_row = cursor.fetchone()

        if updated_row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Единица оборудования не найдена.",
            )

        connection.commit()
        return updated_row
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Код оборудования уже существует",
        ) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось изменить единицу оборудования.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.delete("/{machine_id}", response_model=MachineRead)
def deactivate_machine(machine_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                UPDATE machines
                SET
                    is_active = FALSE,
                    updated_at = NOW()
                WHERE machine_id = %s
                RETURNING {SELECT_COLUMNS};
                """,
                (machine_id,),
            )
            deactivated_row = cursor.fetchone()

        if deactivated_row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Единица оборудования не найдена.",
            )

        connection.commit()
        return deactivated_row
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось деактивировать единицу оборудования.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()

