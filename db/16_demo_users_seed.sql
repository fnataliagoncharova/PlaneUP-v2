INSERT INTO users (username, full_name, password_hash, role, is_active)
VALUES
    ('admin', 'Администратор', '$2b$12$SoYugIU17aJcWBUOQtCqTuhwlLjr0Rw4HJ6BlLC8oDTVVovQIgY5K', 'admin', TRUE),
    ('planner', 'Планировщик', '$2b$12$WelDqoyPZ2AlpWSOaz8jH.yU2uFf7CJR97HkJcAEU1eU3npTuEMAW', 'planner', TRUE),
    ('master', 'Мастер', '$2b$12$5fvsTJ4LW94tFBR/c6T.IOp5YYie1UyccqUlAf/mqLdiHNyQbHdIe', 'master', TRUE),
    ('maintenance', 'Служба ТО', '$2b$12$ksAFqyIYwqhfuyD691.KlObvYH11yd94JC/7CDiUmT4eoFxLOVM6q', 'maintenance', TRUE),
    ('viewer', 'Наблюдатель', '$2b$12$jhy/90QZUUWTdiWX7mbld.CKRT8jo63AM3vhfd5WJkCeO8hT3A.w6', 'viewer', TRUE)
ON CONFLICT (username) DO UPDATE
SET
    full_name = EXCLUDED.full_name,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
