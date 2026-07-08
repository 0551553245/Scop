-- Added Moyasar payment columns to subscriptions and billing_history
--
-- NOTE: this schema is prepared AHEAD of the Moyasar integration
-- (see fixing-plan CRITICAL item #2 — payment collection is not yet
-- built; Subscription.jsx still shows a "coming soon" placeholder).
-- Applying this migration does not make payments work by itself.
--
-- trial_ends_at already exists on subscriptions from the initial
-- schema (used throughout useSubscription.js, EmailVerify.jsx) —
-- included here as IF NOT EXISTS so this file is safe to run
-- standalone, not because it is new.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS moyasar_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS moyasar_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ;

ALTER TABLE public.billing_history
  ADD COLUMN IF NOT EXISTS moyasar_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'SAR',
  ADD COLUMN IF NOT EXISTS amount_halalas INTEGER,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;
