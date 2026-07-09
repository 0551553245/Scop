-- Trial abuse prevention: unique constraint on users.phone
--
-- Nothing previously prevented one person from registering unlimited
-- 14-day trials using email aliasing (owner+1@gmail.com, owner+2@gmail.com,
-- etc. all deliver to one inbox but register as distinct Supabase Auth
-- accounts). Phone number is a stronger identity signal in the Saudi
-- market specifically, since mobile numbers are tied to national ID/Iqama
-- at SIM registration (CITC regulation) — this constraint is step one
-- (uniqueness); real abuse resistance requires pairing it with SMS OTP
-- verification of phone possession, not yet implemented.
--
-- Run the pre-flight duplicate check below FIRST. If it returns rows,
-- resolve those duplicates manually before this constraint will succeed.

SELECT phone, COUNT(*)
FROM public.users
WHERE phone IS NOT NULL
GROUP BY phone
HAVING COUNT(*) > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_phone_unique'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_phone_unique UNIQUE (phone);
  END IF;
END $$;
