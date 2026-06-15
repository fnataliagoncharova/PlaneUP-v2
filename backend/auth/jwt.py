import os
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt


# Development fallback keeps local setup simple. Set PLANEUP_SECRET_KEY in production.
SECRET_KEY = os.getenv("PLANEUP_SECRET_KEY", "planeup-v2-dev-secret-change-me")
ALGORITHM = os.getenv("PLANEUP_JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("PLANEUP_ACCESS_TOKEN_EXPIRE_MINUTES", "720"))


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    token_data = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta is not None else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    token_data.update({"exp": expire})
    return jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
