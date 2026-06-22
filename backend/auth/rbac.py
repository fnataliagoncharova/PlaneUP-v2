from collections.abc import Callable

from fastapi import Depends, HTTPException, status

from auth.dependencies import get_current_user


def require_roles(*allowed_roles: str) -> Callable[[dict], dict]:
    allowed_role_set = set(allowed_roles)

    def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] == "admin":
            return current_user

        if current_user["role"] not in allowed_role_set:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

        return current_user

    return dependency
