CREATE TABLE equipment_maintenance (
    maintenance_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    machine_id BIGINT NOT NULL REFERENCES machines(machine_id),
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP NOT NULL,
    duration_minutes INTEGER NOT NULL,
    comment TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (ended_at > started_at),
    CHECK (duration_minutes > 0)
);

CREATE INDEX idx_equipment_maintenance_machine_id ON equipment_maintenance(machine_id);
CREATE INDEX idx_equipment_maintenance_period ON equipment_maintenance(started_at, ended_at);
