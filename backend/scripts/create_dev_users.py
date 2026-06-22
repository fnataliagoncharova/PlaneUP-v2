import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from auth.passwords import hash_password  # noqa: E402
from db import get_connection  # noqa: E402


DEV_USERS = [
    {
        "username": "planner",
        "password": "planner12345",
        "full_name": "Планировщик",
        "role": "planner",
    },
    {
        "username": "master",
        "password": "master12345",
        "full_name": "Мастер",
        "role": "master",
    },
    {
        "username": "maintenance",
        "password": "maintenance12345",
        "full_name": "Ответственный за ТО",
        "role": "maintenance",
    },
    {
        "username": "viewer",
        "password": "viewer12345",
        "full_name": "Просмотр",
        "role": "viewer",
    },
]


def main() -> int:
    connection = None

    try:
        connection = get_connection()
        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
            for user in DEV_USERS:
                cursor.execute(
                    """
                    SELECT id
                    FROM users
                    WHERE username = %s;
                    """,
                    (user["username"],),
                )
                existing_user = cursor.fetchone()

                if existing_user is not None:
                    print(f"User '{user['username']}' already exists. Skipped.")
                    continue

                cursor.execute(
                    """
                    INSERT INTO users (username, full_name, password_hash, role)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id;
                    """,
                    (
                        user["username"],
                        user["full_name"],
                        hash_password(user["password"]),
                        user["role"],
                    ),
                )
                created_user = cursor.fetchone()
                print(f"Created user '{user['username']}' with id={created_user['id']}.")

        connection.commit()
        return 0
    except psycopg2.Error as exc:
        if connection is not None:
            connection.rollback()
        print(f"Could not create dev users: {exc}", file=sys.stderr)
        return 1
    finally:
        if connection is not None:
            connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
