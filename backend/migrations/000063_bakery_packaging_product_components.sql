-- Phase 7: bakery order packaging should link to Product Master packaging products.
ALTER TABLE bakery_order_packaging
    ADD COLUMN IF NOT EXISTS component_product_id UUID REFERENCES products(id),
    ADD COLUMN IF NOT EXISTS component_variant_id UUID REFERENCES product_variants(id);

ALTER TABLE bakery_order_packaging
    ALTER COLUMN packaging_item_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bakery_order_packaging_component_product
    ON bakery_order_packaging(component_product_id);

CREATE INDEX IF NOT EXISTS idx_bakery_order_packaging_component_variant
    ON bakery_order_packaging(component_variant_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_bakery_order_packaging_product_or_legacy'
    ) THEN
        ALTER TABLE bakery_order_packaging
            ADD CONSTRAINT chk_bakery_order_packaging_product_or_legacy
            CHECK (
                packaging_item_id IS NOT NULL
                OR component_product_id IS NOT NULL
            );
    END IF;
END $$;
