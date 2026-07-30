from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from auth.dependencies import get_current_user


def is_admin_like_role(role: str | None) -> bool:
    return role in {"admin", "demo_admin"}


def require_roles(*allowed_roles: str, allow_demo_admin: bool = True) -> Callable[[dict], dict]:
    allowed_role_set = set(allowed_roles)

    def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        current_role = current_user["role"]

        if current_role == "admin":
            return current_user

        if allow_demo_admin and current_role == "demo_admin":
            return current_user

        if current_role not in allowed_role_set:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        return current_user

    return dependency
