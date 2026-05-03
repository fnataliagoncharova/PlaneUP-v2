CREATE TABLE IF NOT EXISTS production_plan_weeks (
    production_plan_week_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    production_plan_id BIGINT NOT NULL
        REFERENCES production_plans(production_plan_id)
        ON DELETE CASCADE,

    week_no INTEGER NOT NULL,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,

    status TEXT NOT NULL DEFAULT 'draft',
    comment TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT production_plan_weeks_week_no_check CHECK (
        week_no > 0 AND week_no <= 6
    ),

    CONSTRAINT production_plan_weeks_dates_check CHECK (
        week_end_date >= week_start_date
    ),

    CONSTRAINT production_plan_weeks_status_check CHECK (
        status IN ('draft')
    ),

    CONSTRAINT production_plan_weeks_unique_week UNIQUE (
        production_plan_id,
        week_no
    )
);


CREATE TABLE IF NOT EXISTS production_week_lines (
    production_week_line_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    production_plan_week_id BIGINT NOT NULL
        REFERENCES production_plan_weeks(production_plan_week_id)
        ON DELETE CASCADE,

    production_plan_line_id BIGINT NOT NULL
        REFERENCES production_plan_lines(production_plan_line_id)
        ON DELETE CASCADE,

    route_step_equipment_id BIGINT NULL
        REFERENCES route_step_equipment(step_equipment_id),

    planned_qty NUMERIC(12,3) NOT NULL,
    batch_count INTEGER NOT NULL DEFAULT 1,
    sequence_no INTEGER NOT NULL DEFAULT 1,

    comment TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT production_week_lines_planned_qty_check CHECK (
        planned_qty > 0
    ),

    CONSTRAINT production_week_lines_batch_count_check CHECK (
        batch_count > 0
    ),

    CONSTRAINT production_week_lines_sequence_no_check CHECK (
        sequence_no > 0
    ),

    CONSTRAINT production_week_lines_unique_plan_line_per_week UNIQUE (
        production_plan_week_id,
        production_plan_line_id
    )
);