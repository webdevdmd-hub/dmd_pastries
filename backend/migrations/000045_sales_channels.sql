-- Sales channels / order sources foundation.
-- Channel names are business-defined; channel_type is only a controlled grouping.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sales_channels (
    id UUID PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id),
    channel_name VARCHAR(150) NOT NULL,
    channel_type VARCHAR(50) NOT NULL,
    requires_external_order_number BOOLEAN NOT NULL DEFAULT FALSE,
    default_payment_method_id UUID NULL REFERENCES payment_methods(id),
    commission_rate NUMERIC(8,4),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_sales_channels_type CHECK (channel_type IN ('walk_in', 'phone', 'whatsapp', 'social', 'website', 'platform', 'partner', 'other')),
    CONSTRAINT chk_sales_channels_status CHECK (status IN ('active', 'inactive')),
    CONSTRAINT chk_sales_channels_commission_rate CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 100))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_channels_business_name_active
    ON sales_channels(business_id, LOWER(channel_name))
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_channels_one_default_per_business
    ON sales_channels(business_id)
    WHERE is_default = TRUE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_channels_business_type
    ON sales_channels(business_id, channel_type)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_channels_business_status
    ON sales_channels(business_id, status)
    WHERE deleted_at IS NULL;

INSERT INTO sales_channels (
    id,
    business_id,
    channel_name,
    channel_type,
    requires_external_order_number,
    is_default,
    status,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    b.id,
    seed.channel_name,
    seed.channel_type,
    FALSE,
    seed.is_default,
    'active',
    NOW(),
    NOW()
FROM businesses b
CROSS JOIN (
    VALUES
        ('Walk-in', 'walk_in', TRUE),
        ('Phone', 'phone', FALSE),
        ('WhatsApp', 'whatsapp', FALSE),
        ('Website', 'website', FALSE),
        ('Other', 'other', FALSE)
) AS seed(channel_name, channel_type, is_default)
WHERE NOT EXISTS (
    SELECT 1
    FROM sales_channels sc
    WHERE sc.business_id = b.id
      AND LOWER(sc.channel_name) = LOWER(seed.channel_name)
      AND sc.deleted_at IS NULL
);
