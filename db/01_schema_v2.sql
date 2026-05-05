CREATE TABLE nomenclature (
    nomenclature_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nomenclature_code VARCHAR UNIQUE NOT NULL,
    nomenclature_name TEXT NOT NULL,
    unit_of_measure TEXT NOT NULL,
    item_type TEXT NOT NULL DEFAULT 'manufactured',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (unit_of_measure IN ('м²', 'м.п.', 'шт', 'кг', 'л')),
    CHECK (item_type IN ('manufactured', 'purchased'))
);

CREATE TABLE processes (
    process_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    process_code VARCHAR UNIQUE NOT NULL,
    process_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE routes (
    route_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    route_code VARCHAR UNIQUE NOT NULL,
    route_name TEXT NOT NULL,
    result_nomenclature_id BIGINT NOT NULL REFERENCES nomenclature(nomenclature_id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE route_steps (
    route_step_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    route_id BIGINT NOT NULL REFERENCES routes(route_id),
    step_no INTEGER NOT NULL,
    process_id BIGINT NOT NULL REFERENCES processes(process_id),
    output_nomenclature_id BIGINT NOT NULL REFERENCES nomenclature(nomenclature_id),
    output_qty NUMERIC(12,3) NOT NULL DEFAULT 1.000,
    post_process_wait_hours NUMERIC(8,2) NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (route_id, step_no),
    CHECK (step_no > 0),
    CHECK (output_qty > 0),
    CHECK (post_process_wait_hours IS NULL OR post_process_wait_hours >= 0)
);

CREATE TABLE route_step_inputs (
    step_input_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    route_step_id BIGINT NOT NULL REFERENCES route_steps(route_step_id),
    input_nomenclature_id BIGINT NOT NULL REFERENCES nomenclature(nomenclature_id),
    input_qty NUMERIC(12,3) NOT NULL DEFAULT 1.000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT route_step_inputs_input_qty_check CHECK (input_qty > 0)
);

CREATE TABLE machines (
    machine_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    machine_code VARCHAR UNIQUE NOT NULL,
    machine_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE route_step_equipment (
    step_equipment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    route_step_id BIGINT NOT NULL REFERENCES route_steps(route_step_id),
    machine_id BIGINT NOT NULL REFERENCES machines(machine_id),
    equipment_role TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    nominal_rate NUMERIC(12,3) NOT NULL,
    min_batch_qty NUMERIC(12,3) NULL,
    rate_uom TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (priority > 0),
    CHECK (nominal_rate > 0),
    CHECK (min_batch_qty IS NULL OR min_batch_qty > 0),
    CHECK (equipment_role IN ('primary', 'alternative')),
    CHECK (rate_uom IN ('РјВІ/РјРёРЅ', 'Рј.Рї./РјРёРЅ')),
    UNIQUE (route_step_id, machine_id)
);

