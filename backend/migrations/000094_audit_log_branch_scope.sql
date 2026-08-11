-- Give activity logs a branch dimension.
--
-- audit_logs had no branch column at all, so the activity feed and the
-- dashboard's recent-activity panel were filtered by business only. A cashier
-- could read summaries of every other branch's sales, voids, purchases and
-- journal postings.
--
-- The column is nullable and unindexed data is left untouched: historical rows
-- keep a NULL branch and are attributed to the actor's branch at read time.

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES branches(id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_business_branch
    ON audit_logs (business_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_business_created
    ON audit_logs (business_id, created_at DESC);
