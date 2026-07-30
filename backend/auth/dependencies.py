from collections.abc import Callable

import psycopg2
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from psycopg2.extras import RealDictCursor

from auth.jwt import ALGORITHM, SECRET_KEY
from db import get_connection


bearer_scheme = HTTPBearer(auto_error=False)


def get_user_by_username(username: str) -> dict | None:
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT id, username, full_name, password_hash, role, is_active
                FROM users
                WHERE username = %s;
                """,
                (username,),
            )
            return cursor.fetchone()
    finally:
        if connection is not None:
            connection.close()


def get_user_by_id(user_id: int) -> dict | None:
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT id, username, full_name, password_hash, role, is_active
                FROM users
                WHERE id = %s;
                """,
                (user_id,),
            )
            return cursor.fetchone()
    finally:
        if connection is not None:
            connection.close()


def build_user_read(user: dict) -> dict:
    return {
        "id": user["id"],
        "username": user["username"],
        "full_name": user.get("full_name"),
        "role": user["role"],
        "is_active": user["is_active"],
    }


def credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> dict:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise credentials_exception()

    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        user_id = payload.get("user_id")
        if not username or user_id is None:
            raise credentials_exception()
    except JWTError as exc:
        raise credentials_exception() from exc

    try:
        parsed_user_id = int(user_id)
    except (TypeError, ValueError) as exc:
        raise credentials_exception() from exc

    try:
        user = get_user_by_id(parsed_user_id)
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not load current user.",
        ) from exc

    if user is None or user["username"] != username:
        raise credentials_exception()

    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive.",
        )

    return user


def require_roles(*roles: str, allow_demo_admin: bool = True) -> Callable[[dict], dict]:
    allowed_roles = set(roles)

    def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        current_role = current_user["role"]

        if current_role == "admin":
            return current_user

        if allow_demo_admin and current_role == "demo_admin":
            return current_user

        if current_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden",
            )
        return current_user

    return dependency
