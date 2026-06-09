CREATE TABLE IF NOT EXISTS product_category_allowed_types (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  product_category_id uuid NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  product_type varchar(50) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_product_category_allowed_types_product_type CHECK (
    product_type IN (
      'finished_product',
      'ingredient',
      'packaging',
      'raw_material',
      'semi_finished',
      'consumable',
      'equipment',
      'service'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_product_category_allowed_types_business_branch
  ON product_category_allowed_types(business_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_product_category_allowed_types_category
  ON product_category_allowed_types(product_category_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_category_allowed_types_unique
  ON product_category_allowed_types(product_category_id, product_type);

INSERT INTO product_category_allowed_types (
  id,
  business_id,
  branch_id,
  product_category_id,
  product_type,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  pc.business_id,
  pc.branch_id,
  pc.id,
  allowed.product_type,
  now(),
  now()
FROM product_categories pc
CROSS JOIN (
  VALUES
    ('finished_product'),
    ('ingredient'),
    ('packaging'),
    ('raw_material'),
    ('semi_finished'),
    ('consumable'),
    ('equipment'),
    ('service')
) AS allowed(product_type)
WHERE pc.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM product_category_allowed_types pcat
    WHERE pcat.product_category_id = pc.id
      AND pcat.product_type = allowed.product_type
  );
