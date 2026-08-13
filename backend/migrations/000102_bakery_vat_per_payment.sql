-- 000102: VAT recognition on each bakery payment (Phase 4 / W2)
--
-- Decision §2a (2026-08-12 workshop): a deposit carries its proportional VAT
-- slice immediately (Dr cash gross / Cr Customer Advance net + Cr VAT
-- Payable tax slice); completion recognizes only the remainder.
--
-- vat_recognized_amount tracks how much of the order's VAT has already been
-- credited to 2100 by payment journals, so the completion journal posts
-- exactly TaxAmount - vat_recognized_amount and stays balanced under partial
-- recognition. Slices use the cumulative-rounding rule (recognized =
-- round(tax * paid/total) at every step), so the final payment automatically
-- takes the remainder and drift is impossible.
--
-- No backfill: historical payments keep completion-time VAT. Orders that
-- already have deposits recognize the catch-up slice on their NEXT payment
-- (cumulative rule), or at completion if no further payment arrives.

ALTER TABLE bakery_orders ADD COLUMN IF NOT EXISTS vat_recognized_amount numeric(14,4) NOT NULL DEFAULT 0;
