CREATE TABLE IF NOT EXISTS downtime_reasons (
    downtime_reason_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reason_code TEXT NOT NULL,
    reason_name TEXT NOT NULL,
    reason_category TEXT NOT NULL,
    comment TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT downtime_reasons_reason_code_not_blank CHECK (BTRIM(reason_code) <> ''),
    CONSTRAINT downtime_reasons_reason_name_not_blank CHECK (BTRIM(reason_name) <> ''),
    CONSTRAINT downtime_reasons_reason_category_not_blank CHECK (BTRIM(reason_category) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS downtime_reasons_reason_code_uidx
    ON downtime_reasons (reason_code);

CREATE INDEX IF NOT EXISTS downtime_reasons_reason_category_idx
    ON downtime_reasons (reason_category);
