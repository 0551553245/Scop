-- Per-branch pricing: new platform_settings keys + subscriptions.monthly_amount
--
-- Documents SQL already run directly in Supabase for the per-branch pricing
-- migration (see migration plan discussion). Additive only — does not touch
-- or remove the existing tier-based keys (price_starter/growth/pro,
-- starter/growth/pro_branches/managers) or getPlanLimits()'s behavior.
-- Safe to re-run: inserts are ON CONFLICT DO NOTHING, column add is IF NOT EXISTS.
--
-- Values actually set:
--   price_per_branch            = 50   (SAR/branch/month)
--   enterprise_branch_threshold = 10   (10+ branches = enterprise / contact us)
--   managers_per_branch         = 2

INSERT INTO public.platform_settings (key, value)
VALUES
  ('price_per_branch',            '50'),
  ('enterprise_branch_threshold', '10'),
  ('managers_per_branch',         '2')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS monthly_amount numeric;
