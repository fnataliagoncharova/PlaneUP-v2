ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'demo_admin', 'planner', 'master', 'maintenance', 'viewer'));

INSERT INTO users (username, full_name, password_hash, role, is_active)
VALUES
    ('demo_admin', 'Демо-администратор', '$2b$12$9zdnpS1Xo/nCFY0xMCiSyed9mJat1tcK2J9grWnVnCmNqyJPI0DuS', 'demo_admin', TRUE)
ON CONFLICT (username) DO UPDATE
SET
    full_name = EXCLUDED.full_name,
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
