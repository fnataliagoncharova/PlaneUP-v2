CREATE TABLE IF NOT EXISTS equipment_downtimes (
    downtime_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    machine_id BIGINT NOT NULL REFERENCES machines(machine_id),
    downtime_reason_id BIGINT NOT NULL REFERENCES downtime_reasons(downtime_reason_id),
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP NULL,
    duration_minutes INTEGER NULL,
    comment TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT equipment_downtimes_ended_after_started_check CHECK (
        ended_at IS NULL OR ended_at > started_at
    ),
    CONSTRAINT equipment_downtimes_duration_minutes_positive_check CHECK (
        duration_minutes IS NULL OR duration_minutes > 0
    )
);

CREATE INDEX IF NOT EXISTS equipment_downtimes_machine_id_idx
    ON equipment_downtimes (machine_id);

CREATE INDEX IF NOT EXISTS equipment_downtimes_downtime_reason_id_idx
    ON equipment_downtimes (downtime_reason_id);

CREATE INDEX IF NOT EXISTS equipment_downtimes_started_at_idx
    ON equipment_downtimes (started_at);

CREATE INDEX IF NOT EXISTS equipment_downtimes_ended_at_idx
    ON equipment_downtimes (ended_at);

CREATE INDEX IF NOT EXISTS equipment_downtimes_machine_started_ended_idx
    ON equipment_downtimes (machine_id, started_at, ended_at);

CREATE INDEX IF NOT EXISTS equipment_downtimes_started_ended_idx
    ON equipment_downtimes (started_at, ended_at);
