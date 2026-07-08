-- Creates cron_log table and updates expire_overdue_subscriptions
-- to log each run with success/error status and rows affected.
--
-- expire_overdue_subscriptions() (see 005_subscription_auto_expiry.sql)
-- had no monitoring — a silent failure (schema drift, exception) would
-- go unnoticed indefinitely and subscriptions would quietly stop
-- expiring again. This closes that gap.

-- 1. Log table
CREATE TABLE IF NOT EXISTS public.cron_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name TEXT NOT NULL,
  ran_at TIMESTAMPTZ DEFAULT NOW(),
  rows_affected INTEGER,
  status TEXT DEFAULT 'success',
  error_message TEXT
);

-- 2. RLS — admin read-only; the function itself writes as
-- SECURITY DEFINER, bypassing RLS, so no INSERT policy is needed
ALTER TABLE public.cron_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_cron_log" ON public.cron_log
  FOR SELECT USING (public.is_super_admin());

-- 3. Updated function — now logs success (with rows_affected) or
-- error (with SQLERRM) on every run instead of failing silently
CREATE OR REPLACE FUNCTION expire_overdue_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  UPDATE public.subscriptions
  SET status = 'expired'
  WHERE (
    (status = 'trial' AND trial_ends_at < NOW())
    OR (status = 'active' AND expires_at < NOW())
  )
  AND status != 'expired';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  INSERT INTO public.cron_log (job_name, rows_affected, status)
  VALUES ('expire_overdue_subscriptions', affected_rows, 'success');

EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.cron_log (job_name, rows_affected, status, error_message)
  VALUES ('expire_overdue_subscriptions', 0, 'error', SQLERRM);
END;
$$;
