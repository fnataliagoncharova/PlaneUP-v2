CREATE TABLE IF NOT EXISTS production_actuals (
    production_actual_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    production_week_line_id INTEGER NOT NULL
        REFERENCES production_week_lines(production_week_line_id)
        ON DELETE CASCADE,

    actual_date DATE NOT NULL,
    shift_type TEXT NOT NULL,
    shift_team_no INTEGER NOT NULL,

    nomenclature_id INTEGER NOT NULL
        REFERENCES nomenclature(nomenclature_id),

    actual_qty NUMERIC(14,3) NOT NULL,
    unit_of_measure TEXT NOT NULL,

    machine_id INTEGER NULL
        REFERENCES machines(machine_id)
        ON DELETE SET NULL,

    comment TEXT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT production_actuals_shift_type_check CHECK (
        shift_type IN ('day', 'night')
    ),

    CONSTRAINT production_actuals_shift_team_no_check CHECK (
        shift_team_no >= 1 AND shift_team_no <= 4
    ),

    CONSTRAINT production_actuals_actual_qty_positive CHECK (
        actual_qty > 0
    )
);


CREATE INDEX IF NOT EXISTS idx_production_actuals_week_line
ON production_actuals (production_week_line_id);

CREATE INDEX IF NOT EXISTS idx_production_actuals_actual_date
ON production_actuals (actual_date);

CREATE INDEX IF NOT EXISTS idx_production_actuals_nomenclature
ON production_actuals (nomenclature_id);

CREATE INDEX IF NOT EXISTS idx_production_actuals_machine
ON production_actuals (machine_id);

CREATE INDEX IF NOT EXISTS idx_production_actuals_shift
ON production_actuals (actual_date, shift_type, shift_team_no);
