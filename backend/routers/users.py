from typing import Any

import psycopg2
from fastapi import APIRouter, Depends, HTTPException, Path, status
from psycopg2.errors import UniqueViolation
from psycopg2.extras import RealDictCursor

from auth.passwords import hash_password
from auth.rbac import require_roles
from db import get_connection
from schemas.users import (
    UserActiveUpdate,
    UserAdminRead,
    UserCreate,
    UserPasswordUpdate,
    UserProfileUpdate,
    UserRoleUpdate,
    UserUpdate,
)


router = APIRouter(prefix="/users", tags=["users"])

USER_ADMIN_ONLY = ("admin",)

USER_NOT_FOUND_ERROR = "Пользователь не найден."
USERNAME_EXISTS_ERROR = "Пользователь с таким логином уже существует."
LAST_ACTIVE_ADMIN_ERROR = "Нельзя оставить систему без активного администратора."

USER_SELECT_COLUMNS = """
    id,
    username,
    full_name,
    role,
    is_active,
    created_at,
    updated_at
"""

USER_SELECT_COLUMNS_WITH_PASSWORD = """
    id,
    username,
    full_name,
    password_hash,
    role,
    is_active,
    created_at,
    updated_at
"""


def get_user_row_by_id(cursor: RealDictCursor, user_id: int, *, include_password_hash: bool = False) -> dict[str, Any] | None:
    cursor.execute(
        f"""
        SELECT {USER_SELECT_COLUMNS_WITH_PASSWORD if include_password_hash else USER_SELECT_COLUMNS}
        FROM users
        WHERE id = %s;
        """,
        (user_id,),
    )
    return cursor.fetchone()


def ensure_user_exists(cursor: RealDictCursor, user_id: int, *, include_password_hash: bool = False) -> dict[str, Any]:
    user = get_user_row_by_id(cursor, user_id, include_password_hash=include_password_hash)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=USER_NOT_FOUND_ERROR)
    return user


def ensure_username_available(cursor: RealDictCursor, username: str, *, exclude_user_id: int | None = None) -> None:
    if exclude_user_id is None:
        cursor.execute(
            """
            SELECT id
            FROM users
            WHERE username = %s;
            """,
            (username,),
        )
    else:
        cursor.execute(
            """
            SELECT id
            FROM users
            WHERE username = %s
              AND id <> %s;
            """,
            (username, exclude_user_id),
        )

    if cursor.fetchone() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=USERNAME_EXISTS_ERROR)


def count_active_admins(cursor: RealDictCursor, *, exclude_user_id: int | None = None) -> int:
    if exclude_user_id is None:
        cursor.execute(
            """
            SELECT COUNT(*) AS admin_count
            FROM users
            WHERE role = 'admin' AND is_active = TRUE;
            """
        )
    else:
        cursor.execute(
            """
            SELECT COUNT(*) AS admin_count
            FROM users
            WHERE role = 'admin' AND is_active = TRUE AND id <> %s;
            """,
            (exclude_user_id,),
        )

    row = cursor.fetchone()
    return int(row["admin_count"]) if row is not None else 0


def ensure_not_last_active_admin(
    cursor: RealDictCursor,
    user: dict[str, Any],
    *,
    next_role: str | None = None,
    next_is_active: bool | None = None,
) -> None:
    role_after_update = next_role if next_role is not None else user["role"]
    is_active_after_update = next_is_active if next_is_active is not None else user["is_active"]

    if user["role"] == "admin" and user["is_active"] and (role_after_update != "admin" or not is_active_after_update):
        if count_active_admins(cursor, exclude_user_id=user["id"]) == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=LAST_ACTIVE_ADMIN_ERROR)


@router.get("", response_model=list[UserAdminRead], dependencies=[Depends(require_roles(*USER_ADMIN_ONLY, allow_demo_admin=False))])
def list_users():
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                SELECT {USER_SELECT_COLUMNS}
                FROM users
                ORDER BY username;
                """
            )
            return cursor.fetchall()
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось получить список пользователей.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.post(
    "",
    response_model=UserAdminRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*USER_ADMIN_ONLY, allow_demo_admin=False))],
)
def create_user(payload: UserCreate):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                f"""
                INSERT INTO users (
                    username,
                    full_name,
                    password_hash,
                    role,
                    is_active
                )
                VALUES (%s, %s, %s, %s, %s)
                RETURNING {USER_SELECT_COLUMNS};
                """,
                (
                    payload.username,
                    payload.full_name,
                    hash_password(payload.password),
                    payload.role,
                    payload.is_active,
                ),
            )
            created_user = cursor.fetchone()

        connection.commit()
        return created_user
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=USERNAME_EXISTS_ERROR) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось создать пользователя.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.patch(
    "/{user_id}",
    response_model=UserAdminRead,
    dependencies=[Depends(require_roles(*USER_ADMIN_ONLY, allow_demo_admin=False))],
)
def update_user(payload: UserUpdate, user_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            existing_user = ensure_user_exists(cursor, user_id)
            ensure_username_available(cursor, payload.username, exclude_user_id=user_id)
            ensure_not_last_active_admin(cursor, existing_user, next_role=payload.role)
            cursor.execute(
                f"""
                UPDATE users
                SET username = %s,
                    full_name = %s,
                    role = %s,
                    updated_at = NOW()
                WHERE id = %s
                RETURNING {USER_SELECT_COLUMNS};
                """,
                (payload.username, payload.full_name, payload.role, user_id),
            )
            updated_user = cursor.fetchone()

        connection.commit()
        return updated_user
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=USERNAME_EXISTS_ERROR) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось сохранить пользователя.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.patch(
    "/{user_id}/profile",
    response_model=UserAdminRead,
    dependencies=[Depends(require_roles(*USER_ADMIN_ONLY, allow_demo_admin=False))],
)
def update_user_profile(payload: UserProfileUpdate, user_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            ensure_user_exists(cursor, user_id)
            ensure_username_available(cursor, payload.username, exclude_user_id=user_id)
            cursor.execute(
                f"""
                UPDATE users
                SET username = %s,
                    full_name = %s,
                    updated_at = NOW()
                WHERE id = %s
                RETURNING {USER_SELECT_COLUMNS};
                """,
                (payload.username, payload.full_name, user_id),
            )
            updated_user = cursor.fetchone()

        connection.commit()
        return updated_user
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except UniqueViolation as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=USERNAME_EXISTS_ERROR) from exc
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось изменить профиль пользователя.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.patch(
    "/{user_id}/role",
    response_model=UserAdminRead,
    dependencies=[Depends(require_roles(*USER_ADMIN_ONLY, allow_demo_admin=False))],
)
def update_user_role(payload: UserRoleUpdate, user_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            existing_user = ensure_user_exists(cursor, user_id)
            ensure_not_last_active_admin(cursor, existing_user, next_role=payload.role)
            cursor.execute(
                f"""
                UPDATE users
                SET role = %s,
                    updated_at = NOW()
                WHERE id = %s
                RETURNING {USER_SELECT_COLUMNS};
                """,
                (payload.role, user_id),
            )
            updated_user = cursor.fetchone()

        connection.commit()
        return updated_user
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось изменить роль пользователя.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.patch(
    "/{user_id}/password",
    response_model=UserAdminRead,
    dependencies=[Depends(require_roles(*USER_ADMIN_ONLY, allow_demo_admin=False))],
)
def update_user_password(payload: UserPasswordUpdate, user_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            ensure_user_exists(cursor, user_id, include_password_hash=True)
            cursor.execute(
                f"""
                UPDATE users
                SET password_hash = %s,
                    updated_at = NOW()
                WHERE id = %s
                RETURNING {USER_SELECT_COLUMNS};
                """,
                (hash_password(payload.password), user_id),
            )
            updated_user = cursor.fetchone()

        connection.commit()
        return updated_user
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось изменить пароль пользователя.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()


@router.patch(
    "/{user_id}/active",
    response_model=UserAdminRead,
    dependencies=[Depends(require_roles(*USER_ADMIN_ONLY, allow_demo_admin=False))],
)
def update_user_active(payload: UserActiveUpdate, user_id: int = Path(..., gt=0)):
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            existing_user = ensure_user_exists(cursor, user_id)
            ensure_not_last_active_admin(cursor, existing_user, next_is_active=payload.is_active)
            cursor.execute(
                f"""
                UPDATE users
                SET is_active = %s,
                    updated_at = NOW()
                WHERE id = %s
                RETURNING {USER_SELECT_COLUMNS};
                """,
                (payload.is_active, user_id),
            )
            updated_user = cursor.fetchone()

        connection.commit()
        return updated_user
    except HTTPException:
        if connection is not None:
            connection.rollback()
        raise
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось изменить активность пользователя.",
        ) from exc
    finally:
        if connection is not None:
            connection.close()
