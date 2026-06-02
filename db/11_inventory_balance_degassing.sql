BEGIN;

CREATE TABLE IF NOT EXISTS inventory_balance_degassing (
    balance_degassing_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    as_of_date DATE NOT NULL,
    nomenclature_id BIGINT NOT NULL REFERENCES nomenclature(nomenclature_id),
    qty NUMERIC(18,3) NOT NULL,
    available_at TIMESTAMP NOT NULL,
    comment TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT inventory_balance_degassing_qty_check CHECK (qty > 0),
    CONSTRAINT inventory_balance_degassing_available_at_check
        CHECK (available_at > (as_of_date::timestamp + TIME '07:00'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_balance_degassing_as_of_date
    ON inventory_balance_degassing (as_of_date);

CREATE INDEX IF NOT EXISTS idx_inventory_balance_degassing_nomenclature_id
    ON inventory_balance_degassing (nomenclature_id);

CREATE INDEX IF NOT EXISTS idx_inventory_balance_degassing_available_at
    ON inventory_balance_degassing (available_at);

CREATE INDEX IF NOT EXISTS idx_inventory_balance_degassing_as_of_date_nomenclature_id
    ON inventory_balance_degassing (as_of_date, nomenclature_id);

COMMIT;
