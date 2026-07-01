-- Repair databases where the duplicated 000081 migration version caused
-- 000081_super_admin_foundation.sql to be skipped even though the API now
-- requires platform_audit_logs during startup schema verification.
CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_appwrite_user_id varchar(100) NOT NULL,
  actor_email varchar(255) NOT NULL,
  action_type varchar(100) NOT NULL,
  target_type varchar(100) NOT NULL,
  target_id varchar(100),
  target_business_id uuid,
  reason text,
  before_data jsonb,
  after_data jsonb,
  ip_address varchar(100),
  user_agent varchar(255),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_actor_email ON platform_audit_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_target ON platform_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_business ON platform_audit_logs(target_business_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_created_at ON platform_audit_logs(created_at);
