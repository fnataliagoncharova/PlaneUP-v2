BEGIN;

-- V2 test seed data for production routes and equipment.

INSERT INTO nomenclature (
    nomenclature_code,
    nomenclature_name,
    unit_of_measure,
    is_active
)
VALUES
    ('NM-001', 'Полотно-основа универсальное', 'м²', TRUE),
    ('NM-002', 'Полотно грунтованное', 'м²', TRUE),
    ('NM-003', 'Полотно ламинированное белое полуфабрикат', 'м²', TRUE),
    ('NM-004', 'Полотно ламинированное белое', 'м²', TRUE),
    ('NM-005', 'Полотно ламинированное серое', 'м²', TRUE),
    ('NM-006', 'Пленка декоративная белая', 'м²', TRUE),
    ('NM-007', 'Пленка декоративная серая', 'м²', TRUE),
    ('NM-008', 'Профиль ПВХ базовый', 'м.п.', TRUE),
    ('NM-009', 'Профиль ПВХ окрашенный белый', 'м.п.', TRUE),
    ('NM-010', 'Кромка ПВХ белая 50 мм', 'м.п.', TRUE),
    ('NM-011', 'Декоративная вставка ПВХ', 'м.п.', TRUE);

INSERT INTO processes (
    process_code,
    process_name,
    is_active
)
VALUES
    ('PR-001', 'Подготовка основы', TRUE),
    ('PR-002', 'Ламинация', TRUE),
    ('PR-003', 'Резка в размер', TRUE),
    ('PR-004', 'Окраска профиля', TRUE);

INSERT INTO machines (
    machine_code,
    machine_name,
    is_active
)
VALUES
    ('MC-001', 'Линия подготовки полотна', TRUE),
    ('MC-002', 'Ламинатор LAM-1600', TRUE),
    ('MC-003', 'Ламинатор LAM-2200', TRUE),
    ('MC-004', 'Резательный комплекс полотна', TRUE),
    ('MC-005', 'Линия окраски профиля', TRUE),
    ('MC-006', 'Линия продольной резки профиля', TRUE);

INSERT INTO routes (
    route_code,
    route_name,
    result_nomenclature_id,
    is_active
)
VALUES
    (
        'RT-001',
        'Маршрут получения полотна ламинированного белого',
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-004'),
        TRUE
    ),
    (
        'RT-002',
        'Маршрут получения полотна ламинированного серого',
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-005'),
        TRUE
    ),
    (
        'RT-003',
        'Маршрут получения кромки ПВХ белой 50 мм',
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-010'),
        TRUE
    );

INSERT INTO route_steps (
    route_id,
    step_no,
    process_id,
    output_nomenclature_id,
    output_qty,
    notes
)
VALUES
    (
        (SELECT route_id FROM routes WHERE route_code = 'RT-001'),
        1,
        (SELECT process_id FROM processes WHERE process_code = 'PR-001'),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-002'),
        1.000,
        'Подготовка основы под белую ламинацию'
    ),
    (
        (SELECT route_id FROM routes WHERE route_code = 'RT-001'),
        2,
        (SELECT process_id FROM processes WHERE process_code = 'PR-002'),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-003'),
        1.000,
        'Ламинация белой декоративной пленкой'
    ),
    (
        (SELECT route_id FROM routes WHERE route_code = 'RT-001'),
        3,
        (SELECT process_id FROM processes WHERE process_code = 'PR-003'),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-004'),
        1.000,
        'Финишная резка белого полотна'
    ),
    (
        (SELECT route_id FROM routes WHERE route_code = 'RT-002'),
        1,
        (SELECT process_id FROM processes WHERE process_code = 'PR-001'),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-002'),
        1.000,
        'Подготовка основы под серую ламинацию'
    ),
    (
        (SELECT route_id FROM routes WHERE route_code = 'RT-002'),
        2,
        (SELECT process_id FROM processes WHERE process_code = 'PR-002'),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-005'),
        1.000,
        'Ламинация серой декоративной пленкой'
    ),
    (
        (SELECT route_id FROM routes WHERE route_code = 'RT-003'),
        1,
        (SELECT process_id FROM processes WHERE process_code = 'PR-004'),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-009'),
        1.000,
        'Окраска базового профиля в белый цвет'
    ),
    (
        (SELECT route_id FROM routes WHERE route_code = 'RT-003'),
        2,
        (SELECT process_id FROM processes WHERE process_code = 'PR-003'),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-010'),
        1.000,
        'Резка и сборка кромки ПВХ 50 мм'
    );

INSERT INTO route_step_inputs (
    route_step_id,
    input_nomenclature_id,
    external_input_name,
    input_qty
)
VALUES
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-001' AND rs.step_no = 1
        ),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-001'),
        NULL,
        1.000
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-001' AND rs.step_no = 1
        ),
        NULL,
        'Праймер PU-01',
        0.050
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-001' AND rs.step_no = 2
        ),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-002'),
        NULL,
        1.000
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-001' AND rs.step_no = 2
        ),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-006'),
        NULL,
        1.020
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-001' AND rs.step_no = 3
        ),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-003'),
        NULL,
        1.000
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-002' AND rs.step_no = 1
        ),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-001'),
        NULL,
        1.000
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-002' AND rs.step_no = 1
        ),
        NULL,
        'Праймер PU-02 серый',
        0.050
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-002' AND rs.step_no = 2
        ),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-002'),
        NULL,
        1.000
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-002' AND rs.step_no = 2
        ),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-007'),
        NULL,
        1.020
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-003' AND rs.step_no = 1
        ),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-008'),
        NULL,
        1.000
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-003' AND rs.step_no = 1
        ),
        NULL,
        'Краска RAL 9016',
        0.030
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-003' AND rs.step_no = 2
        ),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-009'),
        NULL,
        1.000
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-003' AND rs.step_no = 2
        ),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-011'),
        NULL,
        1.000
    );

INSERT INTO route_step_equipment (
    route_step_id,
    machine_id,
    equipment_role,
    priority,
    nominal_rate,
    rate_uom,
    is_active
)
VALUES
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-001' AND rs.step_no = 1
        ),
        (SELECT machine_id FROM machines WHERE machine_code = 'MC-001'),
        'primary',
        1,
        18.000,
        'м²/мин',
        TRUE
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-001' AND rs.step_no = 2
        ),
        (SELECT machine_id FROM machines WHERE machine_code = 'MC-002'),
        'primary',
        1,
        12.000,
        'м²/мин',
        TRUE
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-001' AND rs.step_no = 2
        ),
        (SELECT machine_id FROM machines WHERE machine_code = 'MC-003'),
        'alternative',
        2,
        10.500,
        'м²/мин',
        TRUE
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-001' AND rs.step_no = 3
        ),
        (SELECT machine_id FROM machines WHERE machine_code = 'MC-004'),
        'primary',
        1,
        25.000,
        'м²/мин',
        TRUE
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-002' AND rs.step_no = 1
        ),
        (SELECT machine_id FROM machines WHERE machine_code = 'MC-001'),
        'primary',
        1,
        18.000,
        'м²/мин',
        TRUE
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-002' AND rs.step_no = 2
        ),
        (SELECT machine_id FROM machines WHERE machine_code = 'MC-003'),
        'primary',
        1,
        11.000,
        'м²/мин',
        TRUE
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-003' AND rs.step_no = 1
        ),
        (SELECT machine_id FROM machines WHERE machine_code = 'MC-005'),
        'primary',
        1,
        35.000,
        'м.п./мин',
        TRUE
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-003' AND rs.step_no = 2
        ),
        (SELECT machine_id FROM machines WHERE machine_code = 'MC-006'),
        'primary',
        1,
        42.000,
        'м.п./мин',
        TRUE
    );

COMMIT;
