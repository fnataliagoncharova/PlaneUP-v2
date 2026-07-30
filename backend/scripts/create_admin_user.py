import os
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from auth.passwords import hash_password  # noqa: E402
from db import get_connection  # noqa: E402


DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "admin123"
DEFAULT_FULL_NAME = "Администратор"


def main() -> int:
    username = os.getenv("PLANEUP_ADMIN_USERNAME", DEFAULT_USERNAME)
    password = os.getenv("PLANEUP_ADMIN_PASSWORD", DEFAULT_PASSWORD)
    full_name = os.getenv("PLANEUP_ADMIN_FULL_NAME", DEFAULT_FULL_NAME)

    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT id, username
                FROM users
                WHERE username = %s;
                """,
                (username,),
            )
            existing_user = cursor.fetchone()

            if existing_user is not None:
                print(f"Admin user '{username}' already exists. Nothing to do.")
                return 0

            cursor.execute(
                """
                INSERT INTO users (username, full_name, password_hash, role)
                VALUES (%s, %s, %s, 'admin')
                RETURNING id;
                """,
                (username, full_name, hash_password(password)),
            )
            created_user = cursor.fetchone()

        connection.commit()

        print(f"Created admin user '{username}' with id={created_user['id']}.")
        if password == DEFAULT_PASSWORD:
            print("Development default password is used. Change it before real operation.")
        return 0
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        print(f"Could not create admin user: {exc}", file=sys.stderr)
        return 1
    finally:
        if connection is not None:
            connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
