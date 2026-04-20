import psycopg2
from fastapi import FastAPI, HTTPException

from db import get_connection


app = FastAPI()


@app.get("/")
def read_root():
    return {"message": "PlaneUP V2 backend is running"}


@app.get("/health/db")
def health_db():
    connection = None

    try:
        connection = get_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT current_database();")
            database_name = cursor.fetchone()[0]

        return {"database": database_name}
    except psycopg2.Error as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    finally:
        if connection is not None:
            connection.close()
