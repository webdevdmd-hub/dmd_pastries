-- Ensure every branch has one active default stock location for basic receiving.
-- Existing branches may have been created after the original stock-location seed,
-- or may have locations without an active default.

UPDATE stock_locations sl
SET status = 'active',
    updated_at = now()
FROM branches b
WHERE b.id = sl.branch_id
  AND b.business_id = sl.business_id
  AND b.deleted_at IS NULL
  AND sl.deleted_at IS NULL
  AND sl.is_default = true
  AND sl.status <> 'active';

WITH branch_creator AS (
  SELECT DISTINCT ON (u.business_id)
    u.business_id,
    u.id AS user_id
  FROM users u
  WHERE u.deleted_at IS NULL
  ORDER BY u.business_id, u.created_at ASC
),
branches_without_active_default AS (
  SELECT b.id, b.business_id
  FROM branches b
  WHERE b.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM stock_locations sl
      WHERE sl.business_id = b.business_id
        AND sl.branch_id = b.id
        AND sl.is_default = true
        AND sl.deleted_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1
      FROM stock_locations sl
      WHERE sl.business_id = b.business_id
        AND sl.branch_id = b.id
        AND LOWER(sl.location_code) = 'main'
        AND sl.deleted_at IS NULL
    )
)
INSERT INTO stock_locations (
  id,
  business_id,
  branch_id,
  location_name,
  location_code,
  location_type,
  is_default,
  status,
  created_by_user_id,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  b.business_id,
  b.id,
  'Main Stock',
  'MAIN',
  'store_room',
  true,
  'active',
  bc.user_id,
  now(),
  now()
FROM branches_without_active_default b
JOIN branch_creator bc ON bc.business_id = b.business_id;

WITH ranked_default_candidates AS (
  SELECT
    sl.id,
    ROW_NUMBER() OVER (
      PARTITION BY sl.business_id, sl.branch_id
      ORDER BY
        CASE WHEN LOWER(sl.location_code) = 'main' THEN 0 ELSE 1 END,
        sl.created_at ASC,
        sl.id ASC
    ) AS rank
  FROM stock_locations sl
  JOIN branches b ON b.id = sl.branch_id
    AND b.business_id = sl.business_id
    AND b.deleted_at IS NULL
  WHERE sl.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM stock_locations existing_default
      WHERE existing_default.business_id = sl.business_id
        AND existing_default.branch_id = sl.branch_id
        AND existing_default.is_default = true
        AND existing_default.deleted_at IS NULL
    )
)
UPDATE stock_locations sl
SET is_default = true,
    status = 'active',
    updated_at = now()
FROM ranked_default_candidates candidate
WHERE sl.id = candidate.id
  AND candidate.rank = 1;
