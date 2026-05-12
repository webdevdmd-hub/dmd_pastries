-- Sprint 2.2 POS billing foundation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO permissions (id, module_name, permission_key, description, created_at, updated_at)
VALUES (gen_random_uuid(), 'pos', 'pos.void', 'Void POS sales', now(), now())
ON CONFLICT (permission_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  branch_id uuid NOT NULL REFERENCES branches(id),
  cashier_user_id uuid NOT NULL REFERENCES users(id),
  customer_id uuid,
  sale_number varchar(100) NOT NULL,
  subtotal_amount numeric(14, 4) NOT NULL DEFAULT 0,
  discount_type varchar(50),
  discount_value numeric(14, 4) NOT NULL DEFAULT 0,
  discount_amount numeric(14, 4) NOT NULL DEFAULT 0,
  taxable_amount numeric(14, 4) NOT NULL DEFAULT 0,
  tax_amount numeric(14, 4) NOT NULL DEFAULT 0,
  total_amount numeric(14, 4) NOT NULL DEFAULT 0,
  paid_amount numeric(14, 4) NOT NULL DEFAULT 0,
  change_amount numeric(14, 4) NOT NULL DEFAULT 0,
  payment_status varchar(50) NOT NULL DEFAULT 'unpaid',
  sale_status varchar(50) NOT NULL DEFAULT 'completed',
  notes text,
  sold_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_sales_discount_type CHECK (discount_type IS NULL OR discount_type IN ('percentage', 'fixed')),
  CONSTRAINT chk_sales_payment_status CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  CONSTRAINT chk_sales_sale_status CHECK (sale_status IN ('completed', 'voided', 'refunded', 'partially_refunded')),
  CONSTRAINT chk_sales_amounts CHECK (
    subtotal_amount >= 0 AND discount_value >= 0 AND discount_amount >= 0 AND
    taxable_amount >= 0 AND tax_amount >= 0 AND total_amount >= 0 AND
    paid_amount >= 0 AND change_amount >= 0
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_business_sale_number ON sales(business_id, sale_number);
CREATE INDEX IF NOT EXISTS idx_sales_business_id ON sales(business_id);
CREATE INDEX IF NOT EXISTS idx_sales_branch_id ON sales(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_cashier_user_id ON sales(cashier_user_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON sales(sold_at);
CREATE INDEX IF NOT EXISTS idx_sales_statuses ON sales(sale_status, payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_deleted_at ON sales(deleted_at);

CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  sale_id uuid NOT NULL REFERENCES sales(id),
  product_id uuid NOT NULL REFERENCES products(id),
  product_variant_id uuid REFERENCES product_variants(id),
  product_name_snapshot varchar(255) NOT NULL,
  variant_name_snapshot varchar(255),
  sku_snapshot varchar(150),
  quantity numeric(14, 4) NOT NULL,
  unit_price numeric(14, 4) NOT NULL,
  discount_amount numeric(14, 4) NOT NULL DEFAULT 0,
  tax_rate_id uuid REFERENCES tax_rates(id),
  tax_rate_name_snapshot varchar(150),
  tax_rate_percentage_snapshot numeric(8, 4) NOT NULL DEFAULT 0,
  tax_amount numeric(14, 4) NOT NULL DEFAULT 0,
  line_subtotal numeric(14, 4) NOT NULL DEFAULT 0,
  line_total numeric(14, 4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_sale_items_amounts CHECK (
    quantity > 0 AND unit_price >= 0 AND discount_amount >= 0 AND
    tax_rate_percentage_snapshot >= 0 AND tax_amount >= 0 AND
    line_subtotal >= 0 AND line_total >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_sale_items_business_id ON sale_items(business_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_variant_id ON sale_items(product_variant_id);

CREATE TABLE IF NOT EXISTS sale_payments (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  sale_id uuid NOT NULL REFERENCES sales(id),
  payment_method_id uuid NOT NULL REFERENCES payment_methods(id),
  payment_method_name_snapshot varchar(150) NOT NULL,
  amount numeric(14, 4) NOT NULL,
  reference_number varchar(255),
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_sale_payments_amount CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_sale_payments_business_id ON sale_payments(business_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id ON sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_method_id ON sale_payments(payment_method_id);

CREATE TABLE IF NOT EXISTS sale_refunds (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  sale_id uuid NOT NULL REFERENCES sales(id),
  refund_number varchar(100) NOT NULL,
  refund_amount numeric(14, 4) NOT NULL,
  reason text NOT NULL,
  approved_by_user_id uuid REFERENCES users(id),
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_sale_refunds_amount CHECK (refund_amount > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sale_refunds_business_refund_number ON sale_refunds(business_id, refund_number);
CREATE INDEX IF NOT EXISTS idx_sale_refunds_business_id ON sale_refunds(business_id);
CREATE INDEX IF NOT EXISTS idx_sale_refunds_sale_id ON sale_refunds(sale_id);

CREATE TABLE IF NOT EXISTS sale_voids (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  sale_id uuid NOT NULL REFERENCES sales(id),
  reason text NOT NULL,
  approved_by_user_id uuid REFERENCES users(id),
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_voids_business_id ON sale_voids(business_id);
CREATE INDEX IF NOT EXISTS idx_sale_voids_sale_id ON sale_voids(sale_id);
