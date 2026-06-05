-- Add business-level accounting financial year settings.

ALTER TABLE company_settings
    ADD COLUMN IF NOT EXISTS financial_year_start_month INTEGER,
    ADD COLUMN IF NOT EXISTS financial_year_start_day INTEGER;

ALTER TABLE company_settings
    ALTER COLUMN financial_year_start_month SET DEFAULT 1,
    ALTER COLUMN financial_year_start_day SET DEFAULT 1;

UPDATE company_settings
SET
    financial_year_start_month = COALESCE(financial_year_start_month, 1),
    financial_year_start_day = COALESCE(financial_year_start_day, 1),
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND (financial_year_start_month IS NULL OR financial_year_start_day IS NULL);

INSERT INTO company_settings (
    id,
    business_id,
    business_display_name,
    currency,
    timezone,
    financial_year_start_month,
    financial_year_start_day,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    b.id,
    b.business_name,
    COALESCE(b.currency, 'AED'),
    COALESCE(b.timezone, 'Asia/Dubai'),
    1,
    1,
    NOW(),
    NOW()
FROM businesses b
WHERE b.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM company_settings cs
      WHERE cs.business_id = b.id
        AND cs.deleted_at IS NULL
  );

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_company_settings_financial_year_start_month'
    ) THEN
        ALTER TABLE company_settings
            ADD CONSTRAINT chk_company_settings_financial_year_start_month
            CHECK (financial_year_start_month BETWEEN 1 AND 12);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_company_settings_financial_year_start_day'
    ) THEN
        ALTER TABLE company_settings
            ADD CONSTRAINT chk_company_settings_financial_year_start_day
            CHECK (financial_year_start_day BETWEEN 1 AND 31);
    END IF;
END $$;
