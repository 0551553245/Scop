-- subscriptions.owner_id UNIQUE constraint — see BUG #154 in
-- .claude/skills/scoop-bug-log/SKILL.md and the opspilot-auth
-- CRITICAL AUTH RULE: "subscriptions table has a UNIQUE constraint
-- on owner_id — always use upsert, never blind insert."
--
-- Without this, a double-click on an email verification link (or any
-- retried insert) could create two subscription rows for the same
-- owner, breaking every .maybeSingle() query in useSubscription.js.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_owner_id_unique'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_owner_id_unique UNIQUE (owner_id);
  END IF;
END $$;
