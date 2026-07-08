-- Subscriptions never auto-expired — see BUG #159 in
-- .claude/skills/scoop-bug-log/SKILL.md
--
-- Nothing previously flipped status to 'expired' when trial_ends_at
-- or expires_at passed. Owners could use Scop forever on a free trial
-- with no payment. This function + schedule closes that gap.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION expire_overdue_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subscriptions
  SET status = 'expired'
  WHERE (
    (status = 'trial'  AND trial_ends_at < NOW())
    OR (status = 'active' AND expires_at < NOW())
  )
  AND status != 'expired';
END;
$$;

-- Daily at 21:00 UTC = 00:00 Riyadh (UTC+3, no DST)
SELECT cron.schedule(
  'expire-overdue-subscriptions',
  '0 21 * * *',
  'SELECT expire_overdue_subscriptions()'
);
