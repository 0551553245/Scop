# Deploy Checklist

Run through this before every `git push` to `main`.

- [ ] 1. `npm run build` — must complete with 0 errors
- [ ] 2. Test owner panel: log in, confirm dashboard loads with data (not blank/stuck spinner)
- [ ] 3. Test branch manager panel: log in, submit at least one task
- [ ] 4. Test admin panel: log in, confirm dashboard loads
- [ ] 5. Verify mobile layout on at least one page (resize browser or use device toolbar — check sidebar/hamburger, no horizontal overflow)
- [ ] 6. Check Supabase logs (Dashboard → Logs) for any new errors since last deploy
- [ ] 7. Confirm real-time updates work — submit a task as branch manager, confirm owner dashboard updates without a manual refresh

---

## Critical bugs to watch for

Full history in `.claude/skills/scoop-bug-log/SKILL.md`. These are the ones most likely to silently regress:

**Login / auth (steps 2-4)**
- **#142** — `navigate()` called before auth context finishes committing state → blank page after login that only clears on manual refresh.
- **#144 / #148 / #149** — `ProtectedRoute` must check both `user` AND `profile`, not just `user`. Any auth context with a missing profile row must call `signOut()`, not just clear local state.
- **#056 / #060** — RLS policies on `public.users` and admin-read tables. If admin login shows "Failed to load" everywhere, this is the first place to check.

**Branch manager / task submission (step 3)**
- **#048 / #109** — BM submit actions must be blocked when the owner's subscription isn't active/trial, and must fail CLOSED (block) if the subscription check itself fails or hasn't loaded yet — never fail open.
- **#079 / #085** — Global tasks (`branch_id IS NULL`) must be scoped to the owner via `created_by`, or one owner's branch managers can see another owner's tasks.
- **#157** — Task photos must upload via `uploadPhoto()` returning a storage path, never a public URL. If photos stop displaying, check whether `SubmissionPhotoThumb`/`useSignedUrl` is still resolving correctly, not reverting to a public URL.

**Mobile (step 5)**
- **#107 / #131** — Every panel needs a working hamburger/sidebar toggle on every page, not just the dashboard.
- **#135** — Mobile form toggles (list ↔ form) break silently if `isMobile` state, the resize effect, or a stray `setShowMobileForm(false)` after save is reordered — check the three ordering rules in the bug log before touching any split list/form page.

**Real-time (step 7)**
- **#039 / #057 / #082 / #112** — Every channel name must include `profile.id` (never `branch_id` alone) and every real-time callback must be a non-async wrapper (`() => fetchData()`), or updates silently stop working or crash on duplicate subscriptions.
- **#158** — `App.jsx`'s `<Suspense>` must stay wrapped in `<ErrorBoundary>`. If this wrapper is ever removed or reordered, a failed chunk load blanks the entire page with no error message.

**Subscription enforcement**
- **#159** — Subscriptions rely on the `expire_overdue_subscriptions()` pg_cron job actually running daily. If trial/expired enforcement seems to have stopped working, check `SELECT * FROM cron.job` before assuming it's a frontend bug.
