-- Sprint 2.1 products foundation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  category_id uuid NOT NULL REFERENCES product_categories(id),
  unit_id uuid NOT NULL REFERENCES units(id),
  tax_rate_id uuid REFERENCES tax_rates(id),
  product_name varchar(255) NOT NULL,
  product_code varchar(100) NOT NULL,
  sku varchar(150),
  barcode varchar(150),
  description varchar(1000),
  product_type varchar(50) NOT NULL,
  sale_price numeric(14, 4) NOT NULL DEFAULT 0,
  cost_price numeric(14, 4),
  compare_at_price numeric(14, 4),
  image_url varchar(500),
  is_pos_visible boolean NOT NULL DEFAULT true,
  is_stock_tracked boolean NOT NULL DEFAULT false,
  is_expiry_tracked boolean NOT NULL DEFAULT false,
  is_custom_order_available boolean NOT NULL DEFAULT false,
  preparation_time_minutes integer,
  status varchar(50) NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_products_product_type CHECK (product_type IN ('ready_to_sell', 'made_to_order', 'manufactured', 'retail', 'service')),
  CONSTRAINT chk_products_status CHECK (status IN ('active', 'inactive', 'archived')),
  CONSTRAINT chk_products_sale_price CHECK (sale_price >= 0),
  CONSTRAINT chk_products_cost_price CHECK (cost_price IS NULL OR cost_price >= 0),
  CONSTRAINT chk_products_compare_at_price CHECK (compare_at_price IS NULL OR compare_at_price >= sale_price),
  CONSTRAINT chk_products_preparation_time CHECK (preparation_time_minutes IS NULL OR preparation_time_minutes >= 0)
);

CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_unit_id ON products(unit_id);
CREATE INDEX IF NOT EXISTS idx_products_tax_rate_id ON products(tax_rate_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_business_code_active ON products(business_id, lower(product_code)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_business_sku_active ON products(business_id, lower(sku)) WHERE sku IS NOT NULL AND sku <> '' AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_business_barcode_active ON products(business_id, lower(barcode)) WHERE barcode IS NOT NULL AND barcode <> '' AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  product_id uuid NOT NULL REFERENCES products(id),
  variant_name varchar(255) NOT NULL,
  sku varchar(150),
  barcode varchar(150),
  sale_price numeric(14, 4) NOT NULL DEFAULT 0,
  cost_price numeric(14, 4),
  image_url varchar(500),
  sort_order integer NOT NULL DEFAULT 0,
  status varchar(50) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_product_variants_status CHECK (status IN ('active', 'inactive', 'archived')),
  CONSTRAINT chk_product_variants_sale_price CHECK (sale_price >= 0),
  CONSTRAINT chk_product_variants_cost_price CHECK (cost_price IS NULL OR cost_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_product_variants_business_id ON product_variants(business_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_deleted_at ON product_variants(deleted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_business_sku_active ON product_variants(business_id, lower(sku)) WHERE sku IS NOT NULL AND sku <> '' AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_business_barcode_active ON product_variants(business_id, lower(barcode)) WHERE barcode IS NOT NULL AND barcode <> '' AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS product_media (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  product_id uuid NOT NULL REFERENCES products(id),
  file_url varchar(500) NOT NULL,
  file_type varchar(100) NOT NULL,
  alt_text varchar(255),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_product_media_business_id ON product_media(business_id);
CREATE INDEX IF NOT EXISTS idx_product_media_product_id ON product_media(product_id);
CREATE INDEX IF NOT EXISTS idx_product_media_deleted_at ON product_media(deleted_at);

CREATE TABLE IF NOT EXISTS product_prices (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  product_id uuid NOT NULL REFERENCES products(id),
  variant_id uuid REFERENCES product_variants(id),
  price_type varchar(50) NOT NULL,
  price numeric(14, 4) NOT NULL,
  currency varchar(10) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_prices_business_id ON product_prices(business_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_product_id ON product_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_variant_id ON product_prices(variant_id);

CREATE TABLE IF NOT EXISTS product_taxes (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses(id),
  product_id uuid NOT NULL REFERENCES products(id),
  tax_rate_id uuid NOT NULL REFERENCES tax_rates(id),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_taxes_business_id ON product_taxes(business_id);
CREATE INDEX IF NOT EXISTS idx_product_taxes_product_id ON product_taxes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_taxes_tax_rate_id ON product_taxes(tax_rate_id);
