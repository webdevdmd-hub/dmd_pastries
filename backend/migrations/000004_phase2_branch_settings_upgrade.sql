-- Phase 2.2 branch settings upgrade.
-- Apply after 000003_phase2_settings_foundation.sql.

ALTER TABLE branches ADD COLUMN IF NOT EXISTS manager_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_branches_manager_user_id ON branches(manager_user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_branches_manager_user'
  ) THEN
    ALTER TABLE branches
      ADD CONSTRAINT fk_branches_manager_user
      FOREIGN KEY (manager_user_id) REFERENCES users(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;
