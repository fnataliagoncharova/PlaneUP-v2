BEGIN;

-- V2 test seed data for production routes and equipment.

INSERT INTO nomenclature (
    nomenclature_code,
    nomenclature_name,
    unit_of_measure,
    is_active
)
VALUES
    ('NM-001', 'РџРѕР»РѕС‚РЅРѕ-РѕСЃРЅРѕРІР° СѓРЅРёРІРµСЂСЃР°Р»СЊРЅРѕРµ', 'м²', TRUE),
    ('NM-002', 'РџРѕР»РѕС‚РЅРѕ РіСЂСѓРЅС‚РѕРІР°РЅРЅРѕРµ', 'м²', TRUE),
    ('NM-003', 'РџРѕР»РѕС‚РЅРѕ Р»Р°РјРёРЅРёСЂРѕРІР°РЅРЅРѕРµ Р±РµР»РѕРµ РїРѕР»СѓС„Р°Р±СЂРёРєР°С‚', 'м²', TRUE),
    ('NM-004', 'РџРѕР»РѕС‚РЅРѕ Р»Р°РјРёРЅРёСЂРѕРІР°РЅРЅРѕРµ Р±РµР»РѕРµ', 'м²', TRUE),
    ('NM-005', 'РџРѕР»РѕС‚РЅРѕ Р»Р°РјРёРЅРёСЂРѕРІР°РЅРЅРѕРµ СЃРµСЂРѕРµ', 'м²', TRUE),
    ('NM-006', 'РџР»РµРЅРєР° РґРµРєРѕСЂР°С‚РёРІРЅР°СЏ Р±РµР»Р°СЏ', 'м²', TRUE),
    ('NM-007', 'РџР»РµРЅРєР° РґРµРєРѕСЂР°С‚РёРІРЅР°СЏ СЃРµСЂР°СЏ', 'м²', TRUE),
    ('NM-008', 'РџСЂРѕС„РёР»СЊ РџР’РҐ Р±Р°Р·РѕРІС‹Р№', 'м.п.', TRUE),
    ('NM-009', 'РџСЂРѕС„РёР»СЊ РџР’РҐ РѕРєСЂР°С€РµРЅРЅС‹Р№ Р±РµР»С‹Р№', 'м.п.', TRUE),
    ('NM-010', 'РљСЂРѕРјРєР° РџР’РҐ Р±РµР»Р°СЏ 50 РјРј', 'м.п.', TRUE),
    ('NM-011', 'РћР±СЂРµР·Рё РїСЂРѕС„РёР»СЏ РџР’РҐ', 'м.п.', TRUE),
    ('RM-001', 'Primer PU-01', 'кг', TRUE),
    ('RM-002', 'Primer PU-02 gray', 'кг', TRUE),
    ('RM-003', 'Paint RAL 9016', 'кг', TRUE);

INSERT INTO processes (
    process_code,
    process_name,
    is_active
)
VALUES
    ('PR-001', 'РџРѕРґРіРѕС‚РѕРІРєР° РѕСЃРЅРѕРІС‹', TRUE),
    ('PR-002', 'Р›Р°РјРёРЅР°С†РёСЏ', TRUE),
    ('PR-003', 'Р РµР·РєР° РІ СЂР°Р·РјРµСЂ', TRUE),
    ('PR-004', 'РћРєСЂР°СЃРєР° РїСЂРѕС„РёР»СЏ', TRUE);

INSERT INTO machines (
    machine_code,
    machine_name,
    is_active
)
VALUES
    ('MC-001', 'Р›РёРЅРёСЏ РїРѕРґРіРѕС‚РѕРІРєРё РїРѕР»РѕС‚РЅР°', TRUE),
    ('MC-002', 'Р›Р°РјРёРЅР°С‚РѕСЂ LAM-1600', TRUE),
    ('MC-003', 'Р›Р°РјРёРЅР°С‚РѕСЂ LAM-2200', TRUE),
    ('MC-004', 'Р РµР·Р°С‚РµР»СЊРЅС‹Р№ РєРѕРјРїР»РµРєСЃ РїРѕР»РѕС‚РЅР°', TRUE),
    ('MC-005', 'Р›РёРЅРёСЏ РѕРєСЂР°СЃРєРё РїСЂРѕС„РёР»СЏ', TRUE),
    ('MC-006', 'Р›РёРЅРёСЏ РїСЂРѕРґРѕР»СЊРЅРѕР№ СЂРµР·РєРё РїСЂРѕС„РёР»СЏ', TRUE);

INSERT INTO routes (
    route_code,
    route_name,
    result_nomenclature_id,
    is_active
)
VALUES
    (
        'RT-001',
        'РњР°СЂС€СЂСѓС‚ РїРѕР»СѓС‡РµРЅРёСЏ РїРѕР»РѕС‚РЅР° Р»Р°РјРёРЅРёСЂРѕРІР°РЅРЅРѕРіРѕ Р±РµР»РѕРіРѕ',
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-004'),
        TRUE
    ),
    (
        'RT-002',
        'РњР°СЂС€СЂСѓС‚ РїРѕР»СѓС‡РµРЅРёСЏ РїРѕР»РѕС‚РЅР° Р»Р°РјРёРЅРёСЂРѕРІР°РЅРЅРѕРіРѕ СЃРµСЂРѕРіРѕ',
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-005'),
        TRUE
    ),
    (
        'RT-003',
        'РњР°СЂС€СЂСѓС‚ РїРѕР»СѓС‡РµРЅРёСЏ РєСЂРѕРјРєРё РџР’РҐ Р±РµР»РѕР№ 50 РјРј',
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
        'РџРѕРґРіРѕС‚РѕРІРєР° РѕСЃРЅРѕРІС‹ РїРѕРґ Р±РµР»СѓСЋ Р»Р°РјРёРЅР°С†РёСЋ'
    ),
    (
        (SELECT route_id FROM routes WHERE route_code = 'RT-001'),
        2,
        (SELECT process_id FROM processes WHERE process_code = 'PR-002'),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-003'),
        1.000,
        'Р›Р°РјРёРЅР°С†РёСЏ Р±РµР»РѕР№ РґРµРєРѕСЂР°С‚РёРІРЅРѕР№ РїР»РµРЅРєРѕР№'
    ),
    (
        (SELECT route_id FROM routes WHERE route_code = 'RT-001'),
        3,
        (SELECT process_id FROM processes WHERE process_code = 'PR-003'),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-004'),
        1.000,
        'Р¤РёРЅРёС€РЅР°СЏ СЂРµР·РєР° Р±РµР»РѕРіРѕ РїРѕР»РѕС‚РЅР°'
    ),
    (
        (SELECT route_id FROM routes WHERE route_code = 'RT-002'),
        1,
        (SELECT process_id FROM processes WHERE process_code = 'PR-001'),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-002'),
        1.000,
        'РџРѕРґРіРѕС‚РѕРІРєР° РѕСЃРЅРѕРІС‹ РїРѕРґ СЃРµСЂСѓСЋ Р»Р°РјРёРЅР°С†РёСЋ'
    ),
    (
        (SELECT route_id FROM routes WHERE route_code = 'RT-002'),
        2,
        (SELECT process_id FROM processes WHERE process_code = 'PR-002'),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-005'),
        1.000,
        'Р›Р°РјРёРЅР°С†РёСЏ СЃРµСЂРѕР№ РґРµРєРѕСЂР°С‚РёРІРЅРѕР№ РїР»РµРЅРєРѕР№'
    ),
    (
        (SELECT route_id FROM routes WHERE route_code = 'RT-003'),
        1,
        (SELECT process_id FROM processes WHERE process_code = 'PR-004'),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-009'),
        1.000,
        'РћРєСЂР°СЃРєР° Р±Р°Р·РѕРІРѕРіРѕ РїСЂРѕС„РёР»СЏ РІ Р±РµР»С‹Р№ С†РІРµС‚'
    ),
    (
        (SELECT route_id FROM routes WHERE route_code = 'RT-003'),
        2,
        (SELECT process_id FROM processes WHERE process_code = 'PR-003'),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'NM-010'),
        1.000,
        'Р РµР·РєР° Рё СЃР±РѕСЂРєР° РєСЂРѕРјРєРё РџР’РҐ 50 РјРј'
    );

INSERT INTO route_step_inputs (
    route_step_id,
    input_nomenclature_id,
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
        1.000
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-001' AND rs.step_no = 1
        ),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'RM-001'),
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
        1.000
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-002' AND rs.step_no = 1
        ),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'RM-002'),
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
        1.000
    ),
    (
        (
            SELECT rs.route_step_id
            FROM route_steps rs
            JOIN routes r ON r.route_id = rs.route_id
            WHERE r.route_code = 'RT-003' AND rs.step_no = 1
        ),
        (SELECT nomenclature_id FROM nomenclature WHERE nomenclature_code = 'RM-003'),
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
        'РјВІ/РјРёРЅ',
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
        'РјВІ/РјРёРЅ',
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
        'РјВІ/РјРёРЅ',
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
        'РјВІ/РјРёРЅ',
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
        'РјВІ/РјРёРЅ',
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
        'РјВІ/РјРёРЅ',
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
        'Рј.Рї./РјРёРЅ',
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
        'Рј.Рї./РјРёРЅ',
        TRUE
    );

COMMIT;

