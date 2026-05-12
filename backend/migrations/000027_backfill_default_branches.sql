WITH businesses_without_branches AS (
  SELECT b.id AS business_id, b.owner_user_id, b.business_name, b.timezone
  FROM businesses b
  WHERE b.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM branches br
      WHERE br.business_id = b.id
        AND br.deleted_at IS NULL
    )
),
created_branches AS (
  INSERT INTO branches (
    id,
    business_id,
    branch_name,
    name,
    code,
    timezone,
    is_default,
    status,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    business_id,
    'Main Branch',
    'Main Branch',
    'MAIN',
    COALESCE(NULLIF(timezone, ''), 'Asia/Dubai'),
    true,
    'active',
    now(),
    now()
  FROM businesses_without_branches
  RETURNING id, business_id
)
UPDATE users u
SET
  branch_id = COALESCE(u.branch_id, cb.id),
  current_branch_id = COALESCE(u.current_branch_id, cb.id),
  can_access_all_branches = true,
  updated_at = now()
FROM created_branches cb
JOIN businesses b ON b.id = cb.business_id
WHERE u.id = b.owner_user_id
  AND u.business_id = cb.business_id;

INSERT INTO user_branch_access (id, business_id, user_id, branch_id, created_at)
SELECT gen_random_uuid(), cb.business_id, b.owner_user_id, cb.id, now()
FROM branches cb
JOIN businesses b ON b.id = cb.business_id
WHERE cb.code = 'MAIN'
  AND cb.is_default = true
  AND cb.deleted_at IS NULL
  AND b.owner_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM user_branch_access uba
    WHERE uba.business_id = cb.business_id
      AND uba.user_id = b.owner_user_id
      AND uba.branch_id = cb.id
  );

UPDATE users u
SET can_access_all_branches = true,
    updated_at = now()
FROM businesses b
WHERE b.owner_user_id = u.id
  AND u.business_id = b.id
  AND u.can_access_all_branches = false;

