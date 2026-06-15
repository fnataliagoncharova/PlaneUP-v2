import psycopg2
from fastapi import APIRouter, Depends, HTTPException, status

from auth.dependencies import build_user_read, get_current_user, get_user_by_username
from auth.jwt import create_access_token
from auth.passwords import verify_password
from schemas.auth import LoginRequest, TokenResponse, UserRead


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    try:
        user = get_user_by_username(payload.username)
    except psycopg2.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not authenticate user.",
        ) from exc

    if user is None or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive.",
        )

    token = create_access_token(
        {
            "sub": user["username"],
            "role": user["role"],
            "user_id": user["id"],
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": build_user_read(user),
    }


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: dict = Depends(get_current_user)):
    return build_user_read(current_user)
