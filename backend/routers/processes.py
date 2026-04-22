from typing import List

import psycopg2
from fastapi import APIRouter, HTTPException, Path, status
from psycopg2.errors import UniqueViolation
from psycopg2.extras import RealDictCursor

from db import get_connection
from schemas.processes import ProcessCreate, ProcessRead, ProcessUpdate


router = APIRouter(prefix="/processes", tags=["processes"])

SELECT_COLUMNS = """
    process_id,
    process_code,
    process_name,
    is_active
"""


@router.get("", response_model=List[ProcessRead])
def list_processes():
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM processes
                ORDER BY process_code;
                """
            )
            rows = cursor.fetchall()

        return rows
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить список технологических операций.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.get("/{process_id}", response_model=ProcessRead)
def get_process(process_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM processes
                WHERE process_id = %s;
                """,
                (process_id,),
            )
            row = cursor.fetchone()

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Технологическая операция не найдена.",
            )

        return row
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить технологическую операцию.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.post("", response_model=ProcessRead, status_code=status.HTTP_201_CREATED)
def create_process(payload: ProcessCreate):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                INSERT INTO processes (
                    process_code,
                    process_name,
                    is_active
                )
                VALUES (%s, %s, %s)
                RETURNING {SELECT_COLUMNS};
                """,
                (
                    payload.process_code,
                    payload.process_name,
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
            detail="Код технологической операции уже существует",
        ) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать технологическую операцию.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.put("/{process_id}", response_model=ProcessRead)
def update_process(payload: ProcessUpdate, process_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                UPDATE processes
                SET
                    process_code = %s,
                    process_name = %s,
                    is_active = %s
                WHERE process_id = %s
                RETURNING {SELECT_COLUMNS};
                """,
                (
                    payload.process_code,
                    payload.process_name,
                    payload.is_active,
                    process_id,
                ),
            )
            updated_row = cursor.fetchone()

        if updated_row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Технологическая операция не найдена.",
            )

        connection.commit()
        return updated_row
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Код технологической операции уже существует",
        ) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось изменить технологическую операцию.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.delete("/{process_id}", response_model=ProcessRead)
def deactivate_process(process_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                UPDATE processes
                SET
                    is_active = FALSE
                WHERE process_id = %s
                RETURNING {SELECT_COLUMNS};
                """,
                (process_id,),
            )
            deactivated_row = cursor.fetchone()

        if deactivated_row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Технологическая операция не найдена.",
            )

        connection.commit()
        return deactivated_row
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось деактивировать технологическую операцию.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()

