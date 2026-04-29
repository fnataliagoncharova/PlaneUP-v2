import psycopg2
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from db import get_connection
from routers.demand import router as demand_router
from routers.inventory_balance import router as inventory_balance_router
from routers.machines import router as machines_router
from routers.nomenclature import router as nomenclature_router
from routers.processes import router as processes_router
from routers.production_plans import router as production_plans_router
from routers.route_step_equipment import router as route_step_equipment_router
from routers.route_step_inputs import router as route_step_inputs_router
from routers.route_steps import router as route_steps_router
from routers.routes import router as routes_router
from routers.safety_stock import router as safety_stock_router
from routers.sales_plan import router as sales_plan_router


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(nomenclature_router)
app.include_router(processes_router)
app.include_router(machines_router)
app.include_router(routes_router)
app.include_router(route_steps_router)
app.include_router(route_step_inputs_router)
app.include_router(route_step_equipment_router)
app.include_router(demand_router)
app.include_router(sales_plan_router)
app.include_router(inventory_balance_router)
app.include_router(safety_stock_router)
app.include_router(production_plans_router)


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
