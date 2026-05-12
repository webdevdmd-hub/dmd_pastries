-- Sprint 4.4: Bakery Orders / made-to-order workflow.

CREATE TABLE IF NOT EXISTS bakery_orders (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id),
    branch_id UUID NOT NULL REFERENCES branches(id),
    order_number VARCHAR(100) NOT NULL,
    customer_id UUID NULL REFERENCES customers(id),
    customer_name_snapshot VARCHAR(255),
    customer_phone_snapshot VARCHAR(100),
    order_type VARCHAR(50) NOT NULL,
    order_date DATE NOT NULL,
    event_date DATE NOT NULL,
    pickup_time VARCHAR(20),
    delivery_time VARCHAR(20),
    delivery_address TEXT,
    subtotal_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    balance_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    payment_status VARCHAR(50) NOT NULL DEFAULT 'unpaid',
    order_status VARCHAR(50) NOT NULL DEFAULT 'new',
    notes TEXT,
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    updated_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_bakery_orders_type CHECK (order_type IN ('pickup', 'delivery')),
    CONSTRAINT chk_bakery_orders_payment_status CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
    CONSTRAINT chk_bakery_orders_status CHECK (order_status IN ('new', 'confirmed', 'in_production', 'ready', 'delivered', 'completed', 'cancelled')),
    CONSTRAINT chk_bakery_orders_amounts CHECK (
        subtotal_amount >= 0 AND discount_amount >= 0 AND tax_amount >= 0
        AND total_amount >= 0 AND paid_amount >= 0 AND balance_amount >= 0
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bakery_orders_business_number
    ON bakery_orders(business_id, order_number)
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bakery_orders_business_branch ON bakery_orders(business_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_bakery_orders_customer ON bakery_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_bakery_orders_status ON bakery_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_bakery_orders_event_date ON bakery_orders(event_date);
CREATE INDEX IF NOT EXISTS idx_bakery_orders_deleted_at ON bakery_orders(deleted_at);

CREATE TABLE IF NOT EXISTS bakery_order_items (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id),
    bakery_order_id UUID NOT NULL REFERENCES bakery_orders(id),
    product_id UUID NOT NULL REFERENCES products(id),
    product_name_snapshot VARCHAR(255) NOT NULL,
    quantity NUMERIC(14,4) NOT NULL,
    unit_id UUID NOT NULL REFERENCES units(id),
    weight NUMERIC(14,4),
    flavor VARCHAR(255),
    design_notes TEXT,
    message_text TEXT,
    customizations_json JSONB,
    unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax_rate_id UUID NULL REFERENCES tax_rates(id),
    tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    line_total NUMERIC(14,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_bakery_order_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_bakery_order_items_amounts CHECK (unit_price >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_bakery_order_items_order ON bakery_order_items(bakery_order_id);
CREATE INDEX IF NOT EXISTS idx_bakery_order_items_product ON bakery_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_bakery_order_items_deleted_at ON bakery_order_items(deleted_at);

CREATE TABLE IF NOT EXISTS bakery_order_payments (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id),
    bakery_order_id UUID NOT NULL REFERENCES bakery_orders(id),
    payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
    payment_method_name_snapshot VARCHAR(255) NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    reference_number VARCHAR(255),
    payment_type VARCHAR(50) NOT NULL,
    paid_by_user_id UUID NOT NULL REFERENCES users(id),
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_bakery_order_payments_type CHECK (payment_type IN ('deposit', 'balance', 'full')),
    CONSTRAINT chk_bakery_order_payments_amount CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_bakery_order_payments_order ON bakery_order_payments(bakery_order_id);
CREATE INDEX IF NOT EXISTS idx_bakery_order_payments_method ON bakery_order_payments(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_bakery_order_payments_paid_at ON bakery_order_payments(paid_at);

CREATE TABLE IF NOT EXISTS bakery_order_productions (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id),
    bakery_order_id UUID NOT NULL REFERENCES bakery_orders(id),
    production_batch_id UUID NULL REFERENCES production_batches(id),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_bakery_order_productions_status CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bakery_order_productions_order
    ON bakery_order_productions(business_id, bakery_order_id);

CREATE TABLE IF NOT EXISTS bakery_order_packaging (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id),
    bakery_order_id UUID NOT NULL REFERENCES bakery_orders(id),
    packaging_item_id UUID NOT NULL REFERENCES packaging_items(id),
    packaging_name_snapshot VARCHAR(255) NOT NULL,
    quantity_required NUMERIC(14,4) NOT NULL,
    unit_id UUID NOT NULL REFERENCES units(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_bakery_order_packaging_quantity CHECK (quantity_required > 0)
);

CREATE INDEX IF NOT EXISTS idx_bakery_order_packaging_order ON bakery_order_packaging(bakery_order_id);
CREATE INDEX IF NOT EXISTS idx_bakery_order_packaging_item ON bakery_order_packaging(packaging_item_id);
