-- Sprint 2 POS held sales / saved cart foundation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS held_sales (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  cashier_user_id uuid NOT NULL REFERENCES users(id),
  customer_id uuid,
  hold_number varchar(100) NOT NULL,
  item_count integer NOT NULL DEFAULT 0,
  estimated_subtotal numeric(14, 4) NOT NULL DEFAULT 0,
  estimated_discount_amount numeric(14, 4) NOT NULL DEFAULT 0,
  estimated_tax_amount numeric(14, 4) NOT NULL DEFAULT 0,
  estimated_total numeric(14, 4) NOT NULL DEFAULT 0,
  status varchar(50) NOT NULL DEFAULT 'held',
  notes text,
  held_at timestamptz NOT NULL DEFAULT now(),
  resumed_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_held_sales_status CHECK (status IN ('held', 'resumed', 'cancelled', 'expired')),
  CONSTRAINT chk_held_sales_amounts CHECK (
    item_count >= 0 AND estimated_subtotal >= 0 AND estimated_discount_amount >= 0 AND
    estimated_tax_amount >= 0 AND estimated_total >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_held_sales_business_hold_number ON held_sales(business_id, hold_number);
CREATE INDEX IF NOT EXISTS idx_held_sales_business_id ON held_sales(business_id);
CREATE INDEX IF NOT EXISTS idx_held_sales_branch_id ON held_sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_held_sales_cashier_user_id ON held_sales(cashier_user_id);
CREATE INDEX IF NOT EXISTS idx_held_sales_status ON held_sales(status);
CREATE INDEX IF NOT EXISTS idx_held_sales_held_at ON held_sales(held_at);
CREATE INDEX IF NOT EXISTS idx_held_sales_deleted_at ON held_sales(deleted_at);

CREATE TABLE IF NOT EXISTS held_sale_items (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  held_sale_id uuid NOT NULL REFERENCES held_sales(id),
  product_id uuid NOT NULL REFERENCES products(id),
  product_variant_id uuid REFERENCES product_variants(id),
  product_name_snapshot varchar(255) NOT NULL,
  variant_name_snapshot varchar(255),
  sku_snapshot varchar(150),
  quantity numeric(14, 4) NOT NULL,
  unit_price numeric(14, 4) NOT NULL,
  discount_type varchar(50),
  discount_value numeric(14, 4) NOT NULL DEFAULT 0,
  discount_amount numeric(14, 4) NOT NULL DEFAULT 0,
  tax_rate_id uuid REFERENCES tax_rates(id),
  tax_rate_name_snapshot varchar(150),
  tax_rate_percentage_snapshot numeric(8, 4) NOT NULL DEFAULT 0,
  tax_amount numeric(14, 4) NOT NULL DEFAULT 0,
  line_subtotal numeric(14, 4) NOT NULL DEFAULT 0,
  line_total numeric(14, 4) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_held_sale_items_discount_type CHECK (discount_type IS NULL OR discount_type IN ('percentage', 'fixed')),
  CONSTRAINT chk_held_sale_items_amounts CHECK (
    quantity > 0 AND unit_price >= 0 AND discount_value >= 0 AND discount_amount >= 0 AND
    tax_rate_percentage_snapshot >= 0 AND tax_amount >= 0 AND line_subtotal >= 0 AND line_total >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_held_sale_items_business_id ON held_sale_items(business_id);
CREATE INDEX IF NOT EXISTS idx_held_sale_items_held_sale_id ON held_sale_items(held_sale_id);
CREATE INDEX IF NOT EXISTS idx_held_sale_items_product_id ON held_sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_held_sale_items_variant_id ON held_sale_items(product_variant_id);
