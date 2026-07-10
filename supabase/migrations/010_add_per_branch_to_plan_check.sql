-- Drop old plan check constraint that didn't include per_branch
ALTER TABLE public.subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

-- Add updated constraint including per_branch
ALTER TABLE public.subscriptions
ADD CONSTRAINT subscriptions_plan_check
CHECK (plan IN ('trial', 'starter', 'growth', 'pro', 'per_branch', 'expired', 'blocked'));

-- Migrate existing accounts to per_branch plan
UPDATE public.subscriptions
SET
  plan = 'per_branch',
  monthly_amount = branches_limit * 50,
  managers_limit = branches_limit * 2
WHERE plan IN ('trial', 'starter', 'growth', 'pro')
AND branches_limit IS NOT NULL;
