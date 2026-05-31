CREATE TABLE IF NOT EXISTS equipment_maintenance (
    maintenance_id SERIAL PRIMARY KEY,

    machine_id INTEGER NOT NULL
        REFERENCES machines(machine_id),

    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP NOT NULL,
    duration_minutes INTEGER NOT NULL,
    comment TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT equipment_maintenance_dates_check CHECK (
        ended_at > started_at
    ),
    CONSTRAINT equipment_maintenance_duration_positive CHECK (
        duration_minutes > 0
    )
);


CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_machine
ON equipment_maintenance (machine_id);

CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_period
ON equipment_maintenance (started_at, ended_at);
