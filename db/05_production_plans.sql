CREATE TABLE IF NOT EXISTS production_plans (
    production_plan_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    plan_month DATE NOT NULL,
    source_balance_date DATE NULL,
    source_calculated_at TIMESTAMPTZ NULL,

    plan_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    comment TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT production_plans_plan_month_first_day_check CHECK (
        plan_month = DATE_TRUNC('month', plan_month)::DATE
    ),

    CONSTRAINT production_plans_status_check CHECK (
        status IN ('draft', 'approved')
    ),

    CONSTRAINT production_plans_plan_month_unique UNIQUE (plan_month)
);


CREATE TABLE IF NOT EXISTS production_plan_lines (
    production_plan_line_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    production_plan_id BIGINT NOT NULL
        REFERENCES production_plans(production_plan_id)
        ON DELETE CASCADE,

    nomenclature_id BIGINT NOT NULL
        REFERENCES nomenclature(nomenclature_id),

    planned_qty NUMERIC(12,3) NOT NULL,
    unit_of_measure TEXT NOT NULL,

    is_priority BOOLEAN NOT NULL DEFAULT FALSE,
    priority_note TEXT NULL,
    line_comment TEXT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT production_plan_lines_planned_qty_check CHECK (
        planned_qty > 0
    ),

    CONSTRAINT production_plan_lines_unit_of_measure_check CHECK (
        unit_of_measure IN ('м²', 'м.п.', 'шт', 'кг', 'л')
    ),

    CONSTRAINT production_plan_lines_unique_nomenclature_per_plan UNIQUE (
        production_plan_id,
        nomenclature_id
    )
);


CREATE OR REPLACE FUNCTION validate_production_plan_line_nomenclature()
RETURNS TRIGGER AS $$
DECLARE
    v_item_type TEXT;
    v_unit_of_measure TEXT;
BEGIN
    SELECT
        item_type,
        unit_of_measure
    INTO
        v_item_type,
        v_unit_of_measure
    FROM nomenclature
    WHERE nomenclature_id = NEW.nomenclature_id;

    IF v_item_type IS NULL THEN
        RAISE EXCEPTION 'Номенклатура не найдена.';
    END IF;

    IF v_item_type <> 'manufactured' THEN
        RAISE EXCEPTION 'В план выпуска можно добавить только производимую номенклатуру.';
    END IF;

    NEW.unit_of_measure := v_unit_of_measure;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trg_validate_production_plan_line_nomenclature
ON production_plan_lines;

CREATE TRIGGER trg_validate_production_plan_line_nomenclature
BEFORE INSERT OR UPDATE
ON production_plan_lines
FOR EACH ROW
EXECUTE FUNCTION validate_production_plan_line_nomenclature();