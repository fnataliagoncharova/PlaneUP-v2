from typing import List

import psycopg2
from fastapi import APIRouter, HTTPException, Path, status
from psycopg2.errors import CheckViolation, UniqueViolation
from psycopg2.extras import RealDictCursor

from db import get_connection
from schemas.nomenclature import NomenclatureCreate, NomenclatureRead, NomenclatureUpdate


router = APIRouter(prefix="/nomenclature", tags=["nomenclature"])

SELECT_COLUMNS = """
    nomenclature_id,
    nomenclature_code,
    nomenclature_name,
    unit_of_measure,
    is_active
"""


@router.get("", response_model=List[NomenclatureRead])
def list_nomenclature():
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM nomenclature
                ORDER BY nomenclature_code;
                """
            )
            rows = cursor.fetchall()

        return rows
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить список номенклатуры.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.get("/{nomenclature_id}", response_model=NomenclatureRead)
def get_nomenclature(nomenclature_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT {SELECT_COLUMNS}
                FROM nomenclature
                WHERE nomenclature_id = %s;
                """,
                (nomenclature_id,),
            )
            row = cursor.fetchone()

        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Позиция номенклатуры не найдена.",
            )

        return row
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить позицию номенклатуры.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.post("", response_model=NomenclatureRead, status_code=status.HTTP_201_CREATED)
def create_nomenclature(payload: NomenclatureCreate):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                INSERT INTO nomenclature (
                    nomenclature_code,
                    nomenclature_name,
                    unit_of_measure,
                    is_active
                )
                VALUES (%s, %s, %s, %s)
                RETURNING {SELECT_COLUMNS};
                """,
                (
                    payload.nomenclature_code,
                    payload.nomenclature_name,
                    payload.unit_of_measure,
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
            detail="Позиция с таким кодом уже существует.",
        ) from exc
    except CheckViolation as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Единица измерения может быть только 'м²' или 'м.п.'.",
        ) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать позицию номенклатуры.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.put("/{nomenclature_id}", response_model=NomenclatureRead)
def update_nomenclature(
    payload: NomenclatureUpdate,
    nomenclature_id: int = Path(..., gt=0),
):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                UPDATE nomenclature
                SET
                    nomenclature_code = %s,
                    nomenclature_name = %s,
                    unit_of_measure = %s,
                    is_active = %s,
                    updated_at = NOW()
                WHERE nomenclature_id = %s
                RETURNING {SELECT_COLUMNS};
                """,
                (
                    payload.nomenclature_code,
                    payload.nomenclature_name,
                    payload.unit_of_measure,
                    payload.is_active,
                    nomenclature_id,
                ),
            )
            updated_row = cursor.fetchone()

        if updated_row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Позиция номенклатуры не найдена.",
            )

        connection.commit()
        return updated_row
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Позиция с таким кодом уже существует.",
        ) from exc
    except CheckViolation as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Единица измерения может быть только 'м²' или 'м.п.'.",
        ) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось изменить позицию номенклатуры.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.delete("/{nomenclature_id}", response_model=NomenclatureRead)
def deactivate_nomenclature(nomenclature_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                UPDATE nomenclature
                SET
                    is_active = FALSE,
                    updated_at = NOW()
                WHERE nomenclature_id = %s
                RETURNING {SELECT_COLUMNS};
                """,
                (nomenclature_id,),
            )
            deactivated_row = cursor.fetchone()

        if deactivated_row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Позиция номенклатуры не найдена.",
            )

        connection.commit()
        return deactivated_row
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось деактивировать позицию номенклатуры.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()

