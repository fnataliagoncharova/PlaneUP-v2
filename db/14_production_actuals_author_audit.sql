ALTER TABLE production_actuals
ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id);

ALTER TABLE production_actuals
ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER REFERENCES users(id);
