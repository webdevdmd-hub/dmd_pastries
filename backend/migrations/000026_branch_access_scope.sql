ALTER TABLE users
  ADD COLUMN IF NOT EXISTS current_branch_id uuid REFERENCES branches(id),
  ADD COLUMN IF NOT EXISTS can_access_all_branches boolean NOT NULL DEFAULT false;

UPDATE users
SET current_branch_id = branch_id
WHERE current_branch_id IS NULL
  AND branch_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_branch_access (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id, branch_id)
);

INSERT INTO user_branch_access (id, business_id, user_id, branch_id)
SELECT gen_random_uuid(), business_id, id, branch_id
FROM users
WHERE branch_id IS NOT NULL
ON CONFLICT (business_id, user_id, branch_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_users_current_branch_id ON users(current_branch_id);
CREATE INDEX IF NOT EXISTS idx_users_can_access_all_branches ON users(can_access_all_branches);
CREATE INDEX IF NOT EXISTS idx_user_branch_access_business_user ON user_branch_access(business_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_branch_access_branch ON user_branch_access(branch_id);
