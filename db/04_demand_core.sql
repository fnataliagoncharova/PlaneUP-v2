BEGIN;

CREATE TABLE IF NOT EXISTS sales_plan (
    sales_plan_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_date DATE NOT NULL,
    nomenclature_id BIGINT NOT NULL REFERENCES nomenclature(nomenclature_id),
    plan_qty NUMERIC(14,3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sales_plan_plan_qty_check CHECK (plan_qty >= 0),
    CONSTRAINT sales_plan_plan_date_nomenclature_key UNIQUE (plan_date, nomenclature_id)
);

CREATE TABLE IF NOT EXISTS inventory_balance (
    balance_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    as_of_date DATE NOT NULL,
    nomenclature_id BIGINT NOT NULL REFERENCES nomenclature(nomenclature_id),
    available_qty NUMERIC(14,3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT inventory_balance_available_qty_check CHECK (available_qty >= 0),
    CONSTRAINT inventory_balance_as_of_date_nomenclature_key UNIQUE (as_of_date, nomenclature_id)
);

CREATE TABLE IF NOT EXISTS safety_stock (
    safety_stock_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nomenclature_id BIGINT NOT NULL REFERENCES nomenclature(nomenclature_id),
    stock_qty NUMERIC(14,3) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT safety_stock_stock_qty_check CHECK (stock_qty >= 0),
    CONSTRAINT safety_stock_nomenclature_id_key UNIQUE (nomenclature_id)
);

CREATE INDEX IF NOT EXISTS idx_sales_plan_plan_date
    ON sales_plan (plan_date);

CREATE INDEX IF NOT EXISTS idx_inventory_balance_as_of_date
    ON inventory_balance (as_of_date);

COMMIT;
