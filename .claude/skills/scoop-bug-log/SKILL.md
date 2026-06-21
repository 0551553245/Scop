# Scop Bug Log — Read Before Touching Any File

Every bug ever fixed in Scop. Check this before writing code so you don't repeat history.

---

## BUG #038 — CRITICAL: Photos stored as base64 in database
**Files:** DailyTasks.jsx, WeeklyTasks.jsx, MonthlyTasks.jsx
**Symptom:** 1 photo = 3–11 MB in DB. Fills free tier in days. Freezes browser.
**Root cause:** `toBase64` function converted files to data-URL strings stored in photo_url column.
**Fix:** Replace with Supabase Storage upload. Use `task-photos` bucket (public). Path: `{branch_id}/{task_id}/{timestamp}.{ext}`. Store the public URL string in photo_url instead.
**Rule:** NEVER use base64 for photos. ALWAYS upload to storage and store URL.

---

## BUG #039 — CRITICAL: Real-time channels unfiltered (connection storm)
**Files:** All BM pages (Dashboard, DailyTasks, WeeklyTasks, MonthlyTasks, FoodSafety)
**Symptom:** 100 managers = 100 re-fetches per submission across ALL branches.
**Root cause:** `postgres_changes` subscriptions had no `filter` parameter.
**Fix:** Add `filter: 'branch_id=eq.${profile.branch_id}'` to every BM subscription.
**Rule:** ALWAYS add branch_id filter to BM real-time channels. Never subscribe without a filter.

---

## BUG #040 — HIGH: Query limits too low, silently truncating data
**Files:** Owner Dashboard (.limit 500→5000), Owner TaskManagement (.limit 200→2000), Owner FoodSafety (.limit 200→2000), BM DailyTasks/WeeklyTasks/MonthlyTasks (.limit 100→1000)
**Symptom:** At scale, submissions silently cut off. Completion rates wrong.
**Fix:** Raise all limits as documented above. Use paginated fetch for 90-day report queries.
**Rule:** Default Supabase limit is 1000. Always set an explicit limit appropriate to the data volume.

---

## BUG #041 — HIGH: Branches.jsx counted all frequencies as daily expected
**File:** src/pages/owner/Branches.jsx
**Symptom:** Branch health score denominator included weekly/monthly tasks, making completion rate artificially low.
**Root cause:** Task definitions fetch missing `.eq('frequency', 'daily')`.
**Fix:** Added `.eq('frequency', 'daily')` to the taskDefs query.
**Rule:** When calculating daily completion rate, ALWAYS filter task definitions by `frequency = 'daily'`.

---

## BUG #042 — HIGH: Language toggle caused DB re-fetch on every switch
**Files:** All owner pages (Dashboard, Branches, TaskManagement, FoodSafety, Reports)
**Symptom:** Toggling EN/AR fired a full DB re-fetch instead of just re-rendering.
**Root cause:** `isAr` listed in `useCallback` deps. Every lang change → new `fetchData` fn → `useEffect` re-triggers.
**Fix:** 
  1. Added `localStorage` persistence to `LanguageContext` (scop-lang key).
  2. All pages now use `useLanguage()` from context instead of local `useState`.
  3. Removed `isAr` from all `useCallback` dep arrays.
  4. Activity/manager data stored as raw fields (name, nameAr, status) and translated in render.
**Rule:** NEVER put `isAr` or `lang` in `useCallback` deps. Store raw data, translate in JSX.

---

## BUG #043 — MEDIUM: Daily cache key didn't include date — stale data shown next day
**Files:** BM DailyTasks.jsx, BM Dashboard.jsx
**Symptom:** Cache from yesterday served on next day's page load. Tasks showed as completed.
**Root cause:** Cache key was `bm-daily-tasks-${branch_id}` without date component.
**Fix:** Cache key is now `bm-daily-tasks-${branch_id}-${today}` where today = `new Date().toISOString().split('T')[0]`.
**Rule:** Daily data caches MUST include the date in the key.

---

## BUG #044 — HIGH: Silent submission failures — manager didn't know task failed
**Files:** DailyTasks.jsx, WeeklyTasks.jsx, MonthlyTasks.jsx
**Symptom:** Network errors during submit silently swallowed. Manager retried, causing duplicates or gave up.
**Fix:** Catch blocks now call `setFormErrors(p => ({ ...p, [task.id]: 'Submission failed...' }))`. Error shown below submit button with red styling.
**Rule:** NEVER silent catch on user-facing submit actions. Always show a visible error.

---

## BUG #045 — HIGH: Deactivated manager stayed logged in across tabs
**Files:** BranchManagerAuthContext.jsx
**Symptom:** Owner deactivates manager but manager's other open tabs still work.
**Fix:** 
  1. Added `SIGNED_OUT` event handler in `onAuthStateChange` to clear profile cache immediately.
  2. Added `visibilitychange` listener that clears cache and re-checks profile when tab becomes visible.
**Rule:** Auth cache MUST be cleared on SIGNED_OUT. Visibility listener MUST re-verify active status.

---

## BUG #046 — MEDIUM: Owner auth context didn't clear profile cache on SIGNED_OUT from another tab
**File:** src/context/OwnerAuthContext.jsx
**Symptom:** If owner signs out in tab A, tab B still has profile in memory cache.
**Fix:** Added explicit `SIGNED_OUT` event check in `onAuthStateChange` that clears `_profileCache` and `_profileCacheUserId`.
**Rule:** Both OwnerAuthContext and BranchManagerAuthContext MUST handle SIGNED_OUT explicitly.

---

## BUG #047 — MEDIUM: Real-time channel lost on network drop — data went stale
**File:** BM Dashboard.jsx
**Symptom:** After a connectivity blip, the channel status becomes CLOSED. Data no longer updated.
**Fix:** Added `.on('system', {}, (status) => { if (status === 'CLOSED') { invalidateCache(cacheKey); fetchDashboard() } })` to BM Dashboard channel.
**Rule:** Production real-time channels should handle 'CLOSED' system status to recover from drops.

---

## GENERAL COLUMN NAME RULES (memorize these)

- `food_safety_submissions` → `result` NOT `status`
- `task_submissions` → `note` NOT `notes`, `value_entered` NOT `numeric_value`
- `task_submissions` → filter by `submitted_at` range, NEVER `submission_date`
- NO `submission_date` column exists anywhere

## RATE CALCULATION RULES

```js
// All rates:
Math.min(100, Math.round((done / Math.max(expected, 1)) * 100))
// All pending:
Math.max(0, expected - done)
```

## REAL-TIME RULES

- NEVER make real-time callbacks async: `() => fetchData()` NOT `async () => {}`
- ALWAYS include `profile.id` in channel names
- ALWAYS return cleanup: `return () => supabase.removeChannel(channel)`
- ALWAYS invalidateCache before fetchData in real-time callback
- ALWAYS add `filter: branch_id=eq.${profile.branch_id}` on BM channels

## PHOTO UPLOAD RULES

```js
async function uploadPhoto(file, branchId, taskId) {
  const ext  = file.name.split('.').pop()
  const path = `${branchId}/${taskId}/${Date.now()}.${ext}`
  const { data, error } = await supabaseBranchManager.storage
    .from('task-photos')
    .upload(path, file, { upsert: true })
  if (error) throw error
  const { data: urlData } = supabaseBranchManager.storage
    .from('task-photos')
    .getPublicUrl(data.path)
  return urlData.publicUrl
}
```
NEVER use base64 (toBase64 / FileReader / readAsDataURL) for photo_url.

## LANGUAGE RULES

- LanguageContext persists to localStorage under key `scop-lang`
- All pages use `useLanguage()` from `../../context/LanguageContext`
- NEVER use local `useState('en')` for language in pages
- NEVER put `isAr` or `lang` in useCallback dependency arrays
- Store raw bilingual data in state, translate only in JSX render

## STORAGE BUCKET SETUP (run once in Supabase SQL editor)

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-photos', 'task-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "authenticated_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'task-photos' AND auth.role() = 'authenticated'
  );

CREATE POLICY "authenticated_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'task-photos' AND auth.role() = 'authenticated'
  );
```

---

## BUG #048 — CRITICAL: Branch managers could submit tasks after owner's subscription expired
**Files:** BranchManagerAuthContext.jsx, BM DailyTasks.jsx, WeeklyTasks.jsx, MonthlyTasks.jsx, FoodSafety.jsx
**Symptom:** Owner's subscription expires/gets blocked, but branch managers could keep submitting tasks and food safety records indefinitely — no enforcement on the BM side at all.
**Root cause:** `BranchManagerAuthContext` never checked the owner's `subscriptions` row. Submit handlers (`quickComplete`, `submitWithReqs`, `handleSubmit`) had no access-control gate.
**Fix:** `BranchManagerAuthContext` now fetches and exposes `ownerSubscription` + `ownerHasAccess` (true when owner's subscription status is `active` or `trial`). Every BM submit handler now checks `if (!ownerHasAccess) { setError(...); return }` before writing to `task_submissions` / `food_safety_submissions`. Added a persistent red banner on all four BM pages when `!ownerHasAccess` telling the manager to contact the owner.
**Rule:** Any write path reachable by a branch manager MUST be gated on the owner's subscription access, not just the owner's own pages.

---

## BUG #049 — HIGH: Admin block toggle only froze billing status, not the owner's login
**File:** admin/Restaurants.jsx
**Symptom:** Admin clicks "Block" on a restaurant — `subscriptions.status` becomes `blocked`, but the owner's `users.is_active` stays `true`, so the owner (and any BM under them prior to BUG #048's fix) could still authenticate and use the app.
**Root cause:** `handleToggleBlock` only updated the `subscriptions` table.
**Fix:** `handleToggleBlock` now updates `subscriptions.status` AND `users.is_active` together via `Promise.all`, both derived from the same pre-toggle `isBlocked` flag so unblocking re-activates the user and blocking deactivates it.
**Rule:** Blocking/unblocking an owner must update both the subscription status AND the user's `is_active` flag — they are two separate enforcement points and both must move together.

---

## BUG #050 — MEDIUM: Expired-subscription owners could still create tasks/standards/schedule events
**Files:** owner/TaskManagement.jsx, owner/FoodSafety.jsx, owner/Schedule.jsx
**Symptom:** `SubscriptionGuard` was already used on Branches.jsx/Managers.jsx, but not on the three main content-creation pages — an expired owner's "Save" buttons stayed fully clickable.
**Fix:** Added `useSubscription()` + `<SubscriptionGuard isExpired={isExpired} isAr={isAr}>` around the Save Task / Save Standard / Create Event buttons on all three pages, matching the existing pattern. (Schedule.jsx's button needed an explicit `width:'100%'` added since the guard wrapper is `display:inline-block`.)
**Rule:** Every owner-side create/save action MUST be wrapped in `SubscriptionGuard`, not just the ones discovered first. Check every page with a write action.

---

## BUG #051 — MEDIUM: New owner signups got a permanent 'active' subscription instead of a trial
**File:** owner/Register.jsx
**Symptom:** New signups inserted `plan: 'basic'`, `status: 'active'`, with no `expires_at`/`trial_ends_at`/`managers_limit` — a stray plan value not used anywhere else, and a subscription that would never expire or show trial banners.
**Root cause:** Insert was written ad hoc instead of matching the canonical trial shape used in admin/Restaurants.jsx's `handleCreateOwner`.
**Fix:** Register.jsx now inserts `plan: 'trial'`, `status: 'trial'`, `branches_limit: 1`, `managers_limit: 1`, `expires_at`/`trial_ends_at` both set to now + 14 days.
**Rule:** Every code path that creates a `subscriptions` row MUST use the same trial shape: plan/status `'trial'`, both `expires_at` and `trial_ends_at` set, all limit columns populated. Never invent a new plan or status string ad hoc.

---

## BUG #052 — MEDIUM: Subscription status changes by admin didn't reflect on owner's screen without a manual refresh
**File:** hooks/useSubscription.js
**Symptom:** Admin blocks/unblocks or changes an owner's plan — the owner's already-open tab kept showing the old subscription state until they reloaded.
**Fix:** Added a real-time `postgres_changes` subscription on `subscriptions` filtered by `owner_id=eq.${profile.id}`, calling `fetchSubscription()` (non-async callback) on any change, with `supabaseOwner.removeChannel(ch)` cleanup.
**Rule:** Any hook whose data can be changed by another panel (here: Admin changing a row Owner is reading) needs its own real-time listener — don't rely on the owner re-navigating to pick up the change.

---

## BUG #053 — MEDIUM: Prefetch cache never hit — wrong cache keys and wrong shape
**File:** lib/prefetch.js
**Symptom:** `prefetchOwnerTasks`/`prefetchBMDailyTasks` ran on hover (as designed) but the actual page load on click always refetched from scratch — the prefetched cache entry was silently never used.
**Root cause:** Two separate bugs: (1) cache keys (`'owner-tasks-' + profileId`, `'bm-daily-tasks-' + branchId`) were missing the `-${today}` date suffix that the consuming pages' `getCached()` calls require (same class of bug as BUG #043), so the keys never matched. (2) The cached shape (`{ tasks, subs }`) didn't match what the consuming pages actually read — `TaskManagement.jsx` expects `{ branches, tasks, subMap }` (subMap grouped by `task_id`), and BM `DailyTasks.jsx` expects `{ branch, tasks }` where `tasks` is the merged `{ task, submission }` array.
**Fix:** Rewrote both functions to use the exact same cache key format as their consumer pages, fetch branches/branch the same way the consumer pages do, and pre-build the `subMap` / merged `{task, submission}` array before calling `setCached`, so the cache entry is byte-for-byte what the consumer page would have produced itself.
**Rule:** A prefetch function's cache key AND cached shape must be verified against the exact `getCached`/`setCached` call in the consuming page — not assumed. Mismatched keys make prefetching silently useless; mismatched shapes crash the consumer.

---

## BUG #054 — LOW: Admin Analytics computed completion rate inline instead of using the shared helper
**File:** admin/Analytics.jsx
**Symptom:** Rate math (`Math.min(100, Math.round((done/total)*100))`) was duplicated inline instead of calling `calcRate` from `lib/stats.js`, risking drift from the standard formula.
**Fix:** Imported `calcRate` from `lib/stats.js` and replaced the inline calculation with `calcRate(completedCount, taskSubs.length)`.
**Rule:** ALWAYS use `calcRate`/`calcPending`/`getExpectedForBranch`/`getTotalExpected` from `lib/stats.js` for any rate/pending math — never reimplement inline, per CLAUDE.md STEP 2 question 5.

---

## BUG #055 — LOW: owner/Branches.jsx passed an async function directly as a real-time callback
**File:** owner/Branches.jsx
**Symptom:** Three `postgres_changes` listeners (`task_submissions`, `food_safety_submissions`, `branches`) passed `fetchBranches` (an async function) directly as the callback instead of wrapping it.
**Fix:** Wrapped each in a non-async arrow: `() => { fetchBranches() }`.
**Rule:** Per the real-time rules, NEVER pass an async function directly as a `postgres_changes` callback — always wrap in a non-async arrow, even when no `invalidateCache` call is needed (Branches.jsx doesn't use the cache module at all).

---

## BUG #056 — CRITICAL: RLS infinite recursion on users table → 500 error
**Files:** Supabase SQL (RLS policies on `public.users`)
**Symptom:** Any query to `public.users` returns a 500 error. Admin panel shows "Failed to load" on all pages.
**Root cause:** `admin_read_all_users` policy used `EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin')` — querying the same table inside its own RLS policy triggers the policy again → infinite recursion.
**Fix:** Create a `SECURITY DEFINER` function that bypasses RLS, then use it in all policies:
```sql
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'super_admin')
$$;

DROP POLICY IF EXISTS "admin_read_all_users" ON public.users;
CREATE POLICY "admin_read_all_users" ON public.users
  FOR SELECT USING (public.is_super_admin() OR auth.uid() = id);
```
**Rule:** NEVER query the same table inside its own RLS policy. Always use a `SECURITY DEFINER` function to break the recursion. Apply `is_super_admin()` to ALL tables needing admin access (subscriptions, branches, task_submissions, food_safety_submissions, billing_history, notifications, platform_settings).

---

## BUG #057 — HIGH: Real-time channel duplicate subscription crash
**Files:** hooks/useSubscription.js, hooks/useNotifications.js
**Symptom:** `"cannot add postgres_changes callbacks after subscribe()"` crash on owner login. Channel recreated constantly while profile loads.
**Root cause:** useEffect deps used object references `[profile, subscription]` — these object references change on every render even when the underlying IDs haven't changed, so the effect (and channel) tore down and rebuilt continuously. During rapid remounts, a channel was subscribed before the previous one was fully removed.
**Fix:**
1. Use primitive deps only: `[profile?.id]` and `[profile?.id, subscription?.plan]`
2. Add pre-cleanup before subscribing to evict any lingering channel with the same name:
```js
const channelName = `owner-subscription-${profile.id}`
supabaseOwner.removeChannel(supabaseOwner.channel(channelName))
const ch = supabaseOwner.channel(channelName).on(...).subscribe()
return () => supabaseOwner.removeChannel(ch)
```
**Rule:** NEVER use object references (`profile`, `subscription`) in useEffect deps for real-time channels. Always extract and use primitive values (`profile?.id`, `subscription?.plan`). Add pre-cleanup before subscribing.

---

## BUG #058 — HIGH: NotificationBell crashes before profile and subscription load
**File:** src/components/NotificationBell.jsx
**Symptom:** NotificationBell throws on initial render because `useNotifications` tries to build a real-time channel before profile/subscription are available.
**Root cause:** Component rendered immediately on page mount with no guard, so hooks ran against null profile/subscription.
**Fix:** Call all hooks unconditionally at the top (rules of hooks), then guard the render after:
```jsx
const { profile } = useOwnerAuth()
const { subscription } = useSubscription()
const { notifications, unreadCount, open, setOpen, markAllRead } = useNotifications()
// ... other hooks (useRef, useEffect) ...
if (!profile?.id || !subscription) return <div style={{ width:32, height:32 }} />
// ... rest of JSX
```
**Rule:** Always guard components that depend on auth/subscription with a loading placeholder AFTER all hook calls — never before. Putting a return before a hook call violates React's rules of hooks and causes a different crash.

---

## BUG #059 — MEDIUM: Plan prices and limits hardcoded in 5 separate files
**Files:** admin/Dashboard.jsx, admin/Subscriptions.jsx, admin/Restaurants.jsx, admin/Trials.jsx, owner/Subscription.jsx
**Symptom:** Admin changes prices in Settings → no effect on any page — all prices shown on screen are wrong.
**Root cause:** `const PLAN_LIMITS = { starter: { branches:1, price:199 }, ... }` duplicated as a hardcoded constant in each file instead of reading from the `platform_settings` table.
**Fix:** Created `src/lib/platformSettings.js` exporting `getPlatformSettings(client)`, `getPlanLimits(settings)`, `DEFAULT_SETTINGS`, `invalidateSettingsCache()`. All five files now call `getPlatformSettings(supabaseAdmin/supabaseOwner)` in their fetch function and derive limits via `getPlanLimits(settings)`. Also added 6 new keys to `platform_settings` (`starter_branches`, `starter_managers`, `growth_branches`, `growth_managers`, `pro_branches`, `pro_managers`) and made them editable in admin/Settings.jsx.
**Rule:** NEVER hardcode plan prices or limits in component files. Always read from `platform_settings` via `getPlanLimits()` from `src/lib/platformSettings.js`.

---

## BUG #060 — HIGH: Admin panel RLS policies missing for all tables
**Files:** Supabase SQL (RLS policies on all tables)
**Symptom:** Admin panel shows "Failed to load" on every page. All queries from `supabaseAdmin` (which uses the anon key) are blocked because no RLS policies grant admin access.
**Root cause:** RLS was enabled on all tables but no policies existed for the `super_admin` role. The admin panel was built assuming service-role bypass, but the client uses the anon key.
**Fix:** After creating `is_super_admin()` (see BUG #056), add admin policies to every table the admin panel queries:
```sql
-- Pattern for each table:
CREATE POLICY "admin_read_all_TABLE" ON public.TABLE
  FOR SELECT USING (public.is_super_admin());
CREATE POLICY "admin_update_all_TABLE" ON public.TABLE
  FOR UPDATE USING (public.is_super_admin());
-- Tables: users, subscriptions, branches, task_submissions,
--         food_safety_submissions, billing_history, activity_log,
--         notifications, platform_settings
```
**Rule:** Every table the admin panel reads or writes MUST have an explicit RLS policy using `public.is_super_admin()`. When a new table is created for admin use, add its policy in the same migration — never add the table and defer the policy.

---

## BUG #061 — HIGH: Registration RLS blocked because session in wrong client
**File:** src/pages/owner/Register.jsx
**Symptom:** `supabaseOwner.from('users').insert()` returns RLS error — `auth.uid()` is null even though the user was just created.
**Root cause:** Auth user was created via `supabaseTemp.auth.signUp()`. The session lives in `supabaseTemp` (which has `persistSession: false`). `supabaseOwner` has no session, so `auth.uid()` returns null and all RLS policies that check `auth.uid() = id` block the insert.
**Fix:** After `supabaseTemp.auth.signUp()`, immediately call `supabaseOwner.auth.signInWithPassword()` BEFORE any DB inserts. This establishes a valid session in `supabaseOwner` so RLS allows `auth.uid() = id` checks.
```js
// WRONG — supabaseOwner has no session yet:
await supabaseTemp.auth.signUp(...)
await supabaseOwner.from('users').insert(...)  // RLS blocks: auth.uid() = null

// CORRECT:
await supabaseTemp.auth.signUp(...)
await supabaseOwner.auth.signInWithPassword(...)  // establish session first
await supabaseOwner.from('users').insert(...)     // now auth.uid() is valid
```
**Rule:** After creating an auth user with `supabaseTemp`, ALWAYS sign in with the panel client BEFORE doing any DB inserts. Never assume the session transfers between clients — each client maintains its own independent session.

---

## BUG #062 — HIGH: Upsert fails when table has no unique constraint on conflict column
**File:** src/pages/owner/Register.jsx
**Symptom:** `ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification` when calling `.upsert({ owner_id }, { onConflict: 'owner_id' })` on `subscriptions` or `branches`.
**Root cause:** `upsert` with `onConflict` requires a UNIQUE or PRIMARY KEY constraint on the specified column. Neither `subscriptions.owner_id` nor `branches.owner_id` has a unique constraint (both allow multiple rows per owner).
**Fix:** Use existence check + conditional insert instead of upsert:
```js
const { data: existing } = await supabaseOwner
  .from('subscriptions').select('id').eq('owner_id', userId).maybeSingle()
if (!existing) {
  await supabaseOwner.from('subscriptions').insert({ owner_id: userId, ... })
}
```
**Tables with confirmed unique constraints:**
- `users`: PRIMARY KEY on `id` → `upsert({ onConflict: 'id' })` ✅
- `subscriptions`: NO unique on `owner_id` → use existence check ✅
- `branches`: NO unique on `owner_id` → use existence check ✅

**Rule:** NEVER use `upsert` with `onConflict` unless you have verified a UNIQUE constraint exists on that column. Check with:
```sql
SELECT constraint_name, constraint_type, column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'TABLE_NAME' AND tc.table_schema = 'public';
```

---

## BUG #063 — MEDIUM: Duplicate branch created on registration retry
**File:** src/pages/owner/Register.jsx
**Symptom:** If registration fails after auth user creation but before completing all DB writes, retrying creates a second branch row with the same owner_id and name.
**Root cause:** `branches.insert()` has no guard — retries always insert, creating duplicates since there is no unique constraint on `(owner_id, name)`.
**Fix:** Check existence before inserting:
```js
const { data: existing } = await supabaseOwner
  .from('branches').select('id')
  .eq('owner_id', userId).eq('name', form.restaurantName).maybeSingle()
if (!existing) {
  await supabaseOwner.from('branches').insert({ owner_id: userId, name: ..., ... })
}
```
**Rule:** Any multi-step registration flow must be idempotent — safe to retry without creating duplicates. Always use existence check before insert when there is no unique constraint to rely on (see BUG #062).

---

## BUG #064 — DOCUMENTATION: First branch counts toward plan limit — this is intentional
**File:** src/pages/owner/Register.jsx
**Context:** Registration inserts 1 branch automatically. The subscription `branches_limit` starts at 1 (starter), 5 (growth), or 15 (pro). The auto-created branch counts toward this limit, so a starter owner immediately has 1/1 branches used.
**This is CORRECT behavior** — the restaurant branch IS their first branch. The owner panel correctly shows "1/1 branches" after registration.
**Rule:** Do NOT "fix" this by removing branch creation from registration, or by artificially inflating `branches_limit` to compensate. The first branch is intentional. Document it here so future developers don't mistake it for a bug.

---

## BUG #065 — HIGH: Owner Dashboard done count inflated by weekly/monthly submissions
**File:** src/pages/owner/Dashboard.jsx
**Symptom:** Tasks completed card shows `3/2` — done exceeds expected.
**Root cause:** `done` was computed as all `task_submissions` with `status = 'completed'` in the owner's branches today — including submissions for weekly and monthly tasks. But `totalExpected` (via `getTotalExpected`) only counts daily tasks (the `taskDefs` query correctly has `.eq('frequency', 'daily')`). Weekly/monthly completions inflated `done` past the daily `expected` ceiling.
**Fix:**
1. Build `taskDefIds = new Set(taskDefs.map(t => t.id))` from the already-filtered daily task definitions.
2. Filter both `done` and `missed` to only count submissions whose `task_id` is in `taskDefIds`.
3. Apply the same `taskDefIds.has(s.task_id)` guard in the branch performance loop so per-branch completion bars are also accurate.
4. Display safeguard: stats card shows `Math.min(taskStats.done, taskStats.total)` as the numerator so no UI ever renders `N/M` where `N > M`.
**Rule:** When `expected` is scoped to a specific frequency (daily), `done` must be scoped identically. Always cross-reference submission counts against the task definition set used to compute expected.

---

## BUG #066 — HIGH: .single() returns 406 when row not found — existence checks broken
**Files:** src/pages/owner/Register.jsx (lines 232, 251)
**Symptom:** Network errors `/subscriptions?select=id&owner_id=eq.xxx → 406` and `/branches?select=id&owner_id=eq.xxx&name=eq.baba → 406` during registration. Registration fails on first attempt (no existing rows yet).
**Root cause:** `.single()` throws a 406 HTTP error when the query returns 0 rows. Existence checks by definition expect "no row" to be the common case — `.single()` is the wrong API for this.
**Fix:** Replace both existence-check `.single()` calls with `.maybeSingle()`. `.maybeSingle()` returns `null` (no error) when no row is found, and an error only on ambiguous multi-row results.
**Rule:** NEVER use `.single()` for existence checks. Always use `.maybeSingle()` when the row might not exist. `.single()` is only appropriate when you are certain exactly one row must exist (e.g., fetching a row by PK after confirming it was just inserted).

---

## BUG #067 — HIGH: Subscription row missing after registration — 406 on every owner page load
**Files:** src/pages/owner/Register.jsx, src/hooks/useSubscription.js
**Symptom:** Owner registers, navigates to dashboard, and gets a 406 error on the subscriptions query on every page load. Owner panel appears broken.
**Root cause:** The subscription INSERT in `Register.jsx` is wrapped in a try/catch that could silently swallow the error (inner catch rethrows, but network timeouts or RLS failures during registration left some accounts with no subscription row). Any owner with a missing subscription row would permanently fail.
**Fix (Part A — recovery):** `useSubscription.js` already uses `.maybeSingle()`. Added a recovery branch: when `data` is null, insert a default starter/trial subscription immediately, then re-invoke `fetchSubscription()` to load it. This self-heals existing affected accounts on next login.
**Fix (Part B — prevention):** The two `.single()` existence checks in `Register.jsx` (branch and subscription) were changed to `.maybeSingle()` (see BUG #066), removing the 406 errors that could abort registration mid-flow and leave orphaned accounts.
**Rule:** Any hook that fetches a row that might not exist must use `.maybeSingle()` AND handle the null case gracefully — either by showing an appropriate empty state or, where safe, by auto-creating the missing row as a recovery action.

---

## BUG #068 — HIGH: Tasks filtered by created_by instead of branch ownership
**Files:** src/pages/owner/Dashboard.jsx, Branches.jsx, Reports.jsx, TaskManagement.jsx
**Symptom:** Tasks created by branch managers (or other users) but assigned to the owner's branches never appear in owner dashboard stats. Done count is artificially low.
**Root cause:** All four pages used `.eq('created_by', profile.id)` to fetch task definitions. This only returns tasks the owner personally created — misses any task assigned to their branches by another user.
**Fix:** Replace single `created_by` query with two parallel queries then merge:
```js
// Branch-specific tasks
const { data: branchTasks } = await supabaseOwner
  .from('tasks').select('id, branch_id, frequency')
  .in('branch_id', branchIds).eq('is_active', true)

// Global tasks (branch_id = null) — filter by created_by
const { data: globalTasks } = await supabaseOwner
  .from('tasks').select('id, branch_id, frequency')
  .is('branch_id', null).eq('is_active', true).eq('created_by', profile.id)

const allTasks = [...(branchTasks || []), ...(globalTasks || [])]
```
**Rule:** Branch-specific tasks → filter by `branch_id IN branchIds`. Global tasks → filter by `created_by = profile.id AND branch_id IS NULL`. NEVER use `created_by` alone to fetch all tasks for an owner.

---

## BUG #069 — HIGH: Food safety pass rate uses submission count not standards count
**File:** src/pages/owner/Branches.jsx
**Symptom:** Branch shows 100% food safety even when only 1 of 10 standards was checked today (because 1 submission passed → 1/1 = 100%).
**Root cause:** `fsTotal = bFs.length` used the number of submissions today as the denominator instead of the total number of active standards for that branch.
**Fix:** Fetch `food_safety_standards` and use the standards count as the denominator:
```js
const bStds   = fsStds.filter(s => s.branch_id === b.id || s.branch_id === null)
const fsTotal = bStds.length
const fsPassed = bFs.filter(f => f.result === 'pass').length
const fsPct    = fsTotal > 0 ? Math.min(100, Math.round((fsPassed / fsTotal) * 100)) : null
```
**Rule:** Food safety rate denominator = total active STANDARDS count, not submission count. Always fetch `food_safety_standards` and use `bStds.length` as denominator. Apply consistently to both Dashboard.jsx and Branches.jsx.

---

## BUG #070 — MEDIUM: Tasks set to is_active=false during development — empty task lists
**Context:** Soft delete sets `is_active = false`. During development/testing, tasks were accidentally deleted. Branch managers saw empty task lists with no error.
**Symptom:** Branch manager opens DailyTasks — list is empty. No error shown. Owner sees 0/0 completion.
**Diagnosis:** Before filing a bug, always check:
```sql
SELECT id, name, is_active FROM public.tasks
WHERE created_by = 'OWNER_ID' OR branch_id IN ('BRANCH_IDS');
```
If `is_active = false` → restore with:
```sql
UPDATE public.tasks SET is_active = true WHERE created_by = 'OWNER_ID';
```
**Rule:** When "tasks not showing" is reported, check `is_active` before assuming a code bug. All task queries filter `.eq('is_active', true)` — soft-deleted tasks are intentionally hidden.

---

## BUG #071 — MEDIUM: Branch created with wrong owner_id during registration
**File:** src/pages/owner/Register.jsx
**Symptom:** Owner registers successfully, but their dashboard shows 0 branches. The branch was created with the wrong `owner_id`.
**Root cause:** If the branch INSERT used a `userId` value sourced from `supabaseTemp` instead of the freshly signed-in `supabaseOwner` session, the IDs may differ (or `supabaseTemp` session expired), causing the branch to be orphaned.
**Diagnosis:** After registration, verify:
```sql
SELECT id, name, owner_id FROM public.branches
WHERE owner_id = 'NEW_USER_ID';
```
**Fix:** Always source `userId` from `supabaseOwner.auth.getUser()` AFTER signing in with `supabaseOwner.auth.signInWithPassword()` (see BUG #061). Never reuse the userId returned by `supabaseTemp.auth.signUp()` for subsequent inserts.
**Rule:** After registration sign-in, re-fetch the authenticated user ID from `supabaseOwner` before any DB inserts. Never assume the ID from `supabaseTemp.auth.signUp()` is identical to the one `supabaseOwner` will see.

---

## BUG #072 — HIGH: Managers.jsx used local lang state instead of LanguageContext
**File:** src/pages/owner/Managers.jsx
**Symptom:** Language toggle on Managers page doesn't persist across navigation. Also, `isAr` in useCallback deps caused a full DB re-fetch on every language toggle.
**Root cause:** `const [lang, setLang] = useState('en')` instead of `useLanguage()`, and `[profile, isAr]` in useCallback deps.
**Fix:** Import `useLanguage`, replace local state with `const { lang, isAr, toggleLang } = useLanguage()`, remove `isAr` from useCallback deps, change toggle button to `onClick={toggleLang}`.
**Rule:** NEVER use local `useState('en')` for language in any page — always use `useLanguage()` from `LanguageContext`. NEVER put `isAr` or `lang` in useCallback dep arrays.

---

## BUG #073 — HIGH: Managers.jsx food safety denominator used submission count not standards count
**File:** src/pages/owner/Managers.jsx
**Symptom:** Manager performance card showed inflated food safety score (e.g., 100% when only 1 of 5 standards was submitted).
**Root cause:** `const fsTotal = bFs.length` used submission count as denominator. Also missing `Math.min(100, ...)`.
**Fix:** Added `food_safety_standards` query to Promise.all, changed denominator to `bStds.filter(s => s.branch_id === branch.id || s.branch_id === null).length`, replaced inline calc with `calcRate(fsPassed, fsTotal)`.
**Rule:** Food safety rate denominator = active STANDARDS count, not submission count.

---

## BUG #074 — MEDIUM: prefetch.js owner task query used created_by alone, missing global tasks
**File:** src/lib/prefetch.js
**Symptom:** Prefetch cache had wrong shape — missed global tasks (branch_id = null), so on fast navigation the prefetched data showed tasks were missing compared to full load.
**Root cause:** `eq('created_by', profileId)` only fetches tasks if created by owner but may miss RLS edge cases. Corrected to two-query pattern: `.in('branch_id', branchIds)` + `.is('branch_id', null).eq('created_by', profileId)`.
**Fix:** Split into two parallel queries, spread-merge results before caching.
**Rule:** Owner task queries must use two-query pattern: branch-specific `.in('branch_id', branchIds)` and global `.is('branch_id', null).eq('created_by', profileId)`.

---

## BUG #075 — MEDIUM: 7 admin pages had isAr in useCallback deps — refetch on lang toggle
**Files:** admin/Dashboard.jsx, admin/ActivityLog.jsx, admin/Analytics.jsx, admin/Users.jsx, admin/Notifications.jsx, admin/Trials.jsx, admin/Settings.jsx
**Symptom:** Toggling language in the admin panel triggered a full DB re-fetch on every page.
**Root cause:** useCallback deps included `isAr` (or `[profile, isAr]`), causing the memoized function to be recreated on lang change, which in turn triggered useEffect re-runs.
**Fix:** Removed `isAr` from all 7 deps arrays. Error messages use the `isAr` value from when the callback was last created — acceptable since errors are transient.
**Rule:** NEVER put `isAr` or `lang` in useCallback deps. See BUG #042.

---

## BUG #076 — MEDIUM: Login pages and BM Schedule used local lang state instead of LanguageContext
**Files:** owner/Login.jsx, branch-manager/Login.jsx, branch-manager/Schedule.jsx
**Symptom:** Language toggle on login/schedule pages didn't persist to the main app and was disconnected from the global language state.
**Root cause:** `const [lang, setLang] = useState('en')` used instead of `useLanguage()`.
**Fix:** Added `useLanguage` import, replaced local state with `const { lang, isAr, toggleLang } = useLanguage()`, updated toggle button onClick to `toggleLang`.
**Rule:** LanguageProvider wraps the entire app (including login routes). All pages, including auth pages, must use `useLanguage()`.

---

## BUG #077 — LOW: Multiple inline rate calcs not using calcRate from stats.js
**Files:** owner/Dashboard.jsx (completionRate, fsPct), owner/Reports.jsx (fsRate), branch-manager/DailyTasks.jsx, WeeklyTasks.jsx, MonthlyTasks.jsx (pct), branch-manager/Dashboard.jsx (completionRate, fsRate)
**Symptom:** Rate formulas duplicated inline. BM task pages missing `Math.min(100, ...)` guard — could display >100% on data inconsistencies.
**Root cause:** Stats calculations not routed through `calcRate()` from `lib/stats.js`.
**Fix:** Replaced inline calcs with `calcRate(done, expected)` for owner KPIs and reports. Added `Math.min(100, ...)` wrapper to BM task progress display calcs.
**Rule:** All rates MUST use `calcRate()` from `lib/stats.js`. NEVER reimplement inline.

---

## BUG #078 — MEDIUM: owner/Subscription.jsx had isAr in useCallback deps
**File:** src/pages/owner/Subscription.jsx
**Symptom:** Language toggle on Subscription page caused a refetch of subscription/branch/billing data.
**Root cause:** `[profile, isAr]` in fetchExtra useCallback deps.
**Fix:** Removed `isAr` from deps → `[profile]`.
**Rule:** See BUG #042 and BUG #075.

---

## BUG #079 — CRITICAL: Global tasks (branch_id=null) visible to managers from ALL owners
**Files:** branch-manager/DailyTasks.jsx, WeeklyTasks.jsx, MonthlyTasks.jsx, Dashboard.jsx, FoodSafety.jsx
**Symptom:** A branch manager for Owner A could see global tasks and food safety standards created by Owner B. Cross-owner data leak.
**Root cause:** `.or('branch_id.eq.X,branch_id.is.null')` returns ALL global tasks regardless of who created them — no `created_by` filter applied.
**Fix:** Two-phase fetch pattern:
  1. Await branch query with `owner_id` in the select: `supabaseBranchManager.from('branches').select('id, name, name_ar, owner_id').eq('id', branchId).single()`
  2. Extract `ownerId = branchRes.data?.owner_id`
  3. Scope global tasks to owner: `.or('branch_id.eq.${branchId},and(branch_id.is.null,created_by.eq.${ownerId})')`
  4. Run remaining queries in parallel using `ownerId`
**Rule:** NEVER use `.or('branch_id.eq.X,branch_id.is.null')` alone — ALWAYS scope global tasks with `created_by.eq.${ownerId}`. The branch query must be awaited separately first to extract `owner_id` before task queries run.

---

## BUG #080 — HIGH: owner/Reports.jsx missing Link import → runtime crash on nav click
**File:** src/pages/owner/Reports.jsx
**Symptom:** Clicking any internal navigation link on the Reports page threw `Link is not defined` ReferenceError, crashing the page.
**Root cause:** `Link` from react-router-dom was used in JSX but never imported.
**Fix:** Added `import { Link } from 'react-router-dom'` to the file's imports.
**Rule:** Any file using `<Link>` must import it explicitly from react-router-dom. Never replace `<a href>` with `<Link>` without updating the import.

---

## BUG #081 — MEDIUM: WeeklyTasks + MonthlyTasks cache keys missing time-period suffix — stale data across week/month boundaries
**Files:** src/pages/branch-manager/WeeklyTasks.jsx, src/pages/branch-manager/MonthlyTasks.jsx
**Symptom:** On the first load of a new week or month, cached task data from the previous period was served instead of fresh data. Tasks appeared already submitted from the prior week/month.
**Root cause:** Cache keys were `bm-weekly-tasks-${branch_id}` and `bm-monthly-tasks-${branch_id}` with no time component — the same class of bug as BUG #043 (daily tasks).
**Fix:**
  - WeeklyTasks: `cacheKey = \`bm-weekly-tasks-${profile.branch_id}-${weekStart}\`` where `weekStart = getWeekStartStr()`
  - MonthlyTasks: `cacheKey = \`bm-monthly-tasks-${profile.branch_id}-${monthStart}\`` where `monthStart` is derived from `new Date().getFullYear()` + `getMonth()`
**Rule:** ALL cache keys for time-scoped data MUST include the time period. Daily = `${today}`, Weekly = `${weekStart}`, Monthly = `${monthStart}`. See also BUG #043.

---

## BUG #082 — MEDIUM: WeeklyTasks + MonthlyTasks real-time channel names used branch_id instead of profile.id
**Files:** src/pages/branch-manager/WeeklyTasks.jsx, src/pages/branch-manager/MonthlyTasks.jsx
**Symptom:** Channel names were `bm-weekly-tasks-${profile.branch_id}` and `bm-monthly-tasks-${profile.branch_id}`. Two managers at the same branch would share a channel name, causing Supabase to silently deduplicate subscriptions and drop updates for one of them.
**Root cause:** Channel name used `branch_id` (shared across managers at the same branch) instead of `profile.id` (unique per user).
**Fix:** Changed to `bm-weekly-tasks-${profile.id}` and `bm-monthly-tasks-${profile.id}`.
**Rule:** ALWAYS use `profile.id` in channel names — never `branch_id`. Two managers can share a branch but must have distinct channels. See CLAUDE.md STEP 3.

---

## BUG #083 — LOW: SubscriptionGuard.jsx used browser alert() to notify expired users
**File:** src/components/SubscriptionGuard.jsx
**Symptom:** When an expired-subscription owner clicked a guarded button, the browser showed a native alert() dialog. On some platforms this blocks the main thread; on mobile it looks broken. There was no bilingual support.
**Root cause:** `window.alert(message)` called in the click handler.
**Fix:** Replaced alert() with an inline state `showWarn` + a fixed-position red toast that auto-dismisses after 3 seconds. Toast text is bilingual (`isAr` prop).
**Rule:** NEVER use `alert()`, `confirm()`, or `prompt()` anywhere in the app. Use inline state for warnings, toasts for transient messages. See CLAUDE.md delete-operations rule for confirm().

---

## BUG #084 — MEDIUM: owner/FoodSafety.jsx had no real-time subscription — food safety data went stale
**File:** src/pages/owner/FoodSafety.jsx
**Symptom:** When a branch manager submitted a food safety reading, the owner's FoodSafety page didn't update until manually refreshed. Owner had no live view of branch compliance.
**Root cause:** The page fetched data once on mount via `fetchData` but had no `postgres_changes` subscription on `food_safety_submissions`.
**Fix:** Added a `useEffect` with `supabaseOwner.channel('owner-food-safety-${profile.id}')` subscribed to `event:'*'` on `food_safety_submissions`, calling `invalidateCache(cacheKey); fetchData()` on change, with `removeChannel` cleanup.
**Rule:** Any owner page that displays live submission data MUST have a real-time channel to catch branch manager writes. Match the rule from DailyTasks/BM pages: invalidate cache then refetch in callback.

---

## BUG #085 — CRITICAL: prefetch.js leaked global tasks from ALL owners to branch managers
**File:** src/lib/prefetch.js
**Symptom:** On nav hover, `prefetchBMDailyTasks` pre-seeded the cache with tasks from every owner in the platform, not just the BM's owner. On cache hit, the BM page displayed foreign tasks.
**Root cause:** `.or('branch_id.eq.${branchId},branch_id.is.null')` — the null-branch clause had no `created_by` scope, violating BUG #079 rule.
**Fix:** Fetch branch row first (with `owner_id`), then use: `.or('branch_id.eq.${branchId},and(branch_id.is.null,created_by.eq.${ownerId})')`. Changed branch select from `'id, name, name_ar'` to `'id, name, name_ar, owner_id'`. Restructured from `Promise.all` to sequential: branch first, then parallel tasks+subs.
**Rule:** ALWAYS scope `branch_id.is.null` global tasks with `created_by.eq.${ownerId}`. This applies to prefetch functions too — not just page-level queries.

---

## BUG #086 — CRITICAL: Admin notifications with target='active' were permanently silenced
**File:** src/pages/admin/Notifications.jsx
**Symptom:** Admin sent notifications with "Active Only" target. No owner ever received them.
**Root cause:** `useNotifications.js` filters by `plan` name (`trial`, `starter`, `growth`, `pro`). `'active'` is a subscription *status*, not a plan. The filter `.or('target.eq.all,target.eq.active')` never matched any owner's plan field.
**Fix:** Removed `{ key:'active', en:'Active Only', ar:'النشطون فقط' }` from the `TARGETS` array in admin/Notifications.jsx. History display falls back gracefully to raw `n.target` for any legacy 'active' records.
**Rule:** Notification targets must match plan names only: `all`, `trial`, `starter`, `growth`, `pro`. Never use subscription status as a notification target.

---

## BUG #087 — CRITICAL: Reports.jsx Missed Tasks KPI was always 0
**File:** src/pages/owner/Reports.jsx
**Symptom:** "Missed Tasks" card always showed 0, even when many tasks were overdue.
**Root cause:** `filtered.filter(s => s.status === 'missed').length` — BM task_submission pages only insert `status='completed'` records. No 'missed' status is ever written.
**Fix:** Changed to `Math.max(0, expected - done)` where `expected = getTotalExpected(branchIds, taskDefs)`.
**Rule:** Missed task count must use `Math.max(0, expected - done)` — never filter by `status === 'missed'` since that status is never inserted by branch managers.

---

## BUG #088 — CRITICAL: Reports.jsx bar chart missed bars were always empty
**File:** src/pages/owner/Reports.jsx
**Symptom:** The "Missed" (red) portion of the daily completion bar chart was always zero, making the chart appear all-green.
**Root cause:** Same as BUG #087 — chart used `day.filter(s => s.status === 'missed').length`.
**Fix:** Added `dailyExp = getTotalExpected(branchIds, taskDefs)` inside the `chartData` memo. Daily bars now use `Math.max(0, dailyExp - completed)`. Weekly bars (3m view) use `Math.max(0, dailyExp * 7 - completed)`.
**Rule:** Bar chart missed counts must be computed as `expected - completed`, not filtered by status.

---

## BUG #089 — HIGH: BranchManagerAuthContext fail-open when owner subscription fetch fails
**File:** src/context/BranchManagerAuthContext.jsx
**Symptom:** If `fetchOwnerSubscription` failed (network error, RLS block), `ownerSubscription` remained `null`. The check `!ownerSubscription || status === 'active'` evaluated `!null = true`, granting access even with no subscription data.
**Root cause:** Fail-open default: `const ownerHasAccess = !ownerSubscription || ...`
**Fix:** `const ownerHasAccess = ownerSubscription ? (ownerSubscription.status === 'active' || ownerSubscription.status === 'trial') : false`
**Rule:** Access control checks must be fail-CLOSED. When subscription data is missing/errored, default to `false`, not `true`.

---

## BUG #090 — HIGH: Reports.jsx week `numDays` was Monday-based, not Saudi Saturday-based
**File:** src/pages/owner/Reports.jsx
**Symptom:** In weekly view, the "X days" label was wrong, and the bar chart showed the wrong number of daily bars.
**Root cause:** `const day = now.getDay(); return day === 0 ? 7 : day` uses Sunday=0 (JavaScript) which gives Mon-Sun week, not the Saudi Sat-Fri week used by `getWeekStartStr()`.
**Fix:** `Math.floor((new Date() - new Date(getWeekStartStr() + 'T00:00:00.000Z')) / 86400000) + 1`
**Rule:** All week calculations must use `getWeekStartStr()` from `lib/weekUtils.js` which returns the most recent Saturday. Never use `getDay()` for Saudi week math.

---

## BUG #091 — HIGH: Owner Dashboard ignored eventsRes.error — silent crash path
**File:** src/pages/owner/Dashboard.jsx
**Symptom:** If the `schedule_events` query failed, the error was silently swallowed. `events` would be `[]` (from `eventsRes.data || []`), but the actual error never surfaced.
**Root cause:** All other query results had `if (res.error) throw res.error` checks, but `eventsRes.error` was missing.
**Fix:** Added `if (eventsRes.error) throw eventsRes.error` after the `Promise.all` checks.
**Rule:** EVERY query result from a `Promise.all` must have an explicit error check. Never skip one silently.

---

## BUG #092 — HIGH: Owner Dashboard "Next Event" missed global (branch_id=null) schedule events
**File:** src/pages/owner/Dashboard.jsx
**Symptom:** Events created as "All Branches" (branch_id=null) never appeared in the "Next Event" card even though they were fetched in `allEvents`.
**Root cause:** `allEvents.find(e => e.branch_id === branchId)` — strict equality check excluded null-branch events.
**Fix:** `allEvents.find(e => e.branch_id === branchId || e.branch_id === null)`
**Rule:** When filtering events or tasks by branch, always include the `|| e.branch_id === null` clause for global records.

---

## BUG #093 — HIGH: owner/TaskManagement.jsx handleDelete lacked ownership check
**File:** src/pages/owner/TaskManagement.jsx
**Symptom:** An owner could theoretically soft-delete a task they didn't create if they guessed the task ID.
**Root cause:** `.update({ is_active: false }).eq('id', taskId)` — no `created_by` filter.
**Fix:** Added `.eq('created_by', profile.id)` after `.eq('id', taskId)`.
**Rule:** Every owner-side delete/update on `tasks` MUST include `.eq('created_by', profile.id)` to ensure ownership. RLS alone is not a substitute for explicit scoping.

---

## BUG #094 — HIGH: owner/FoodSafety.jsx handleDelete lacked ownership check
**File:** src/pages/owner/FoodSafety.jsx
**Symptom:** Same class of bug as BUG #093 — soft-delete of food safety standards without ownership check.
**Root cause:** `.update({ is_active: false }).eq('id', id)` — no `created_by` filter.
**Fix:** Added `.eq('created_by', profile.id)` after `.eq('id', id)`.
**Rule:** Every owner-side delete/update on `food_safety_standards` MUST include `.eq('created_by', profile.id)`.

---

## BUG #095 — HIGH: owner/Managers.jsx branch assignment failure left orphaned auth user with no feedback
**File:** src/pages/owner/Managers.jsx
**Symptom:** If Step 3 (branch assignment) failed after auth account creation, the modal showed a generic error and closed. The auth user existed but the branch had no manager. The owner had no idea what happened.
**Root cause:** `if (branchErr) throw branchErr` — re-threw into the generic catch which called `setModalErr('Something went wrong.')`.
**Fix:** Inline error handling before the throw: `setModalErr('Manager account created but branch assignment failed. Contact support if the issue persists.')` then `return` without throwing.
**Rule:** Partial-success states (auth user created, profile setup failed) MUST show specific guidance, not generic errors.

---

## BUG #096 — HIGH: owner/Register.jsx orphaned auth user showed generic error with no recovery path
**File:** src/pages/owner/Register.jsx
**Symptom:** If profile/branch/subscription setup failed after auth.signUp, the owner saw "Registration failed: [DB error]" with no guidance.
**Root cause:** `throw innerErr` propagated the raw DB error to the outer catch which printed it literally.
**Fix:** Throw a descriptive `new Error('Account was created but setup failed. Try signing in, or contact support.')` instead.
**Rule:** Partial-registration failures must guide the user to try signing in (since auth was created), not just show "failed".

---

## BUG #097 — MEDIUM: useSubscription.js recovery insert used plan='starter' instead of plan='trial'
**File:** src/hooks/useSubscription.js
**Symptom:** Owner with missing subscription row got a recovery row with `plan='starter'` and `status='trial'`. This mix was inconsistent — `status='trial'` means the plan should also be `'trial'` per BUG #051 rule.
**Root cause:** Recovery insert had `plan: 'starter'` hardcoded.
**Fix:** Changed to `plan: 'trial'` to match the canonical trial row shape established in BUG #051.
**Rule:** Recovery subscription inserts must use the same canonical trial shape: `plan='trial'`, `status='trial'`, both `expires_at` and `trial_ends_at` set.

---

## BUG #098 — MEDIUM: owner/Branches.jsx task_submissions and food_safety_submissions queries had no .limit()
**File:** src/pages/owner/Branches.jsx
**Symptom:** On high-volume branches, the Branches page could silently return truncated submission data (Supabase default limit = 1000), causing incorrect branch health scores.
**Root cause:** Queries lacked explicit `.limit()`.
**Fix:** Added `.limit(2000)` to both `task_submissions` and `food_safety_submissions` queries.
**Rule:** ALWAYS set explicit `.limit()` on all queries. Supabase default is 1000 rows and it truncates silently.

---

## BUG #099 — MEDIUM: owner/FoodSafety.jsx fsSubData error silently swallowed
**File:** src/pages/owner/FoodSafety.jsx
**Symptom:** If the food_safety_submissions query failed, `fsSubData` was `undefined`, `setFsSubmissions([])` ran silently, all standards showed "Not submitted".
**Root cause:** `const { data: fsSubData } = await ...` — error not destructured.
**Fix:** Added `error: fsSubErr` to destructuring and `if (fsSubErr) console.error(...)`.
**Rule:** ALWAYS destructure and log `error` from every Supabase query, even non-critical ones.

---

## BUG #100 — MEDIUM: owner/Managers.jsx taskSubsRes/fsSubsRes/fsStdsRes errors silently swallowed
**File:** src/pages/owner/Managers.jsx
**Symptom:** If any of the three secondary queries failed, performance data was silently zeroed — all manager performance bars showed 0 or null with no error surfaced.
**Root cause:** Only `mgrRes.error` and `taskDefsRes.error` were checked; the others were not.
**Fix:** Added `console.error(...)` checks for `taskSubsRes.error`, `fsSubsRes.error`, `fsStdsRes.error`.
**Rule:** All errors from `Promise.all` results must be checked even if non-fatal. Log them so they appear in monitoring.

---

## BUG #101 — MEDIUM: branch-manager/FoodSafety.jsx subsRes error silently swallowed
**File:** src/pages/branch-manager/FoodSafety.jsx
**Symptom:** If the food_safety_submissions query for today's subs failed, every standard showed "Not submitted" with no error logged.
**Root cause:** `subsRes.error` not checked after `Promise.all`.
**Fix:** Added `if (subsRes.error) console.error('Food safety submissions fetch error:', subsRes.error)`.
**Rule:** Same as BUG #099 — always check and log every query error.

---

## BUG #102 — MEDIUM: owner/Reports.jsx fsRes had no .limit() — could silently truncate 90-day data
**File:** src/pages/owner/Reports.jsx
**Symptom:** High-volume owners with many food safety submissions could have the 90-day report silently capped at 1000 rows.
**Root cause:** `food_safety_submissions` query in `fetchData` had no `.limit()`.
**Fix:** Added `.limit(5000)`.
**Rule:** 90-day report queries must set high limits. task_submissions already uses pagination; fsRes needed explicit limit.

---

## BUG #103 — MEDIUM: owner/Reports.jsx client-side date filter had no timezone — missed Saudi-midnight submissions
**File:** src/pages/owner/Reports.jsx
**Symptom:** Submissions made between 00:00–03:00 Saudi time (21:00–00:00 UTC previous day) were excluded from the report period. "Today" missed the first 3 hours of local midnight.
**Root cause:** `.filter(s => s.submitted_at >= '${pStart}T00:00:00')` — no timezone. String comparison against UTC-stored ISO strings excluded Saudi-midnight UTC equivalents.
**Fix:** Adjusted start to Saudi UTC+3 midnight: `new Date('${pStart}T00:00:00.000Z'); d.setUTCHours(d.getUTCHours() - 3)`. Applied to both `filtered` and `fsFiltered` memos.
**Rule:** Client-side date filters on `submitted_at` must account for UTC+3 offset. Always convert period start from Saudi midnight (UTC+3) to the equivalent UTC timestamp before comparing.

---

## BUG #104 — LOW: branch-manager/DailyTasks.jsx real-time useEffect used full profile object as dep
**File:** src/pages/branch-manager/DailyTasks.jsx
**Symptom:** Real-time channel rebuilt on every render because `profile` object reference changed, even when `profile.id` and `profile.branch_id` were stable.
**Root cause:** `}, [profile, fetchTasks])` — object reference in deps.
**Fix:** Changed to `}, [profile?.id, profile?.branch_id, fetchTasks])`.
**Rule:** NEVER use full objects in useEffect deps for real-time channels. Always use primitive values.

---

## BUG #105 — LOW: admin/Dashboard.jsx fetchDashboard useCallback used full profile object as dep
**File:** src/pages/admin/Dashboard.jsx
**Symptom:** `fetchDashboard` was recreated on every render because `[profile]` object reference changed, causing unnecessary refetches.
**Root cause:** `}, [profile])` — object reference dep.
**Fix:** Changed to `}, [profile?.id])`.
**Rule:** ALWAYS use `profile?.id` (primitive) in useCallback deps, not the full profile object.

---

## BUG #106 — LOW: admin/Dashboard.jsx had no .limit() on main entity queries — dangerous at scale
**File:** src/pages/admin/Dashboard.jsx
**Symptom:** At scale (>1000 owners/subs/branches/managers), the admin dashboard would silently truncate data, showing wrong totals.
**Root cause:** `supabaseAdmin.from('users')...`, `supabaseAdmin.from('subscriptions')...`, etc. had no `.limit()`.
**Fix:** Added `.limit(500)` to `ownersRes`, `subsRes`, `branchesRes`, `managersRes` queries.
**Rule:** Even admin aggregate queries must have explicit limits. `.limit(500)` is appropriate for the admin dashboard; if growth exceeds this, add pagination.

---

## Bug count: #038 – #106 (69 bugs total)

---

## BUG #107 — CRITICAL: No mobile sidebar — layouts unusable on phones
**Files:** src/components/BMLayout.jsx, src/components/OwnerLayout.jsx, src/components/AdminLayout.jsx
**Symptom:** On mobile, sidebar occupied full width and overlapped content. No way to navigate or dismiss.
**Root cause:** All three layouts used `position:sticky` / always-visible sidebars with no responsive behavior.
**Fix:** Added `isMobile` state (resize listener) + `sidebarOpen` toggle. Sidebar now uses `position:fixed` with `transform:translateX()` slide-in. Hamburger button (44×44px) injected into topbar. Overlay backdrop closes sidebar on tap. RTL-aware: Arabic slides from right. Nav links auto-close sidebar on click.
**Rule:** Any fixed-width sidebar layout MUST have mobile behavior. Use `transform:translateX()` + `position:fixed` pattern. Hamburger must be ≥44×44px.

---

## BUG #108 — CRITICAL: BM Schedule calendar not horizontally scrollable on mobile
**File:** src/pages/branch-manager/Schedule.jsx
**Symptom:** On narrow screens, the weekly calendar grid overflowed and clipped. Managers could not see all columns.
**Root cause:** Calendar grid container had no `overflow:hidden`/`auto` and no `minWidth` to prevent collapse.
**Fix:** Wrapped calendar grid in `<div style={{overflowX:'auto',width:'100%'}}><div style={{minWidth:600}}>`. Also increased time labels and day header font from `fontSize:9` to `fontSize:11`.
**Rule:** Any fixed multi-column calendar grid must be wrapped in an `overflowX:auto` container with `minWidth` set to the minimum readable width.

---

## BUG #109 — CRITICAL: BranchManagerAuthContext fail-open when owner has no subscription row
**File:** src/context/BranchManagerAuthContext.jsx
**Symptom:** A new owner with no `subscriptions` row (edge case) would give all their BMs unrestricted access. `ownerHasAccess` would be `null` (still loading) forever and never block submits.
**Root cause:** `ownerHasAccess` was `null` both for "fetching" and "no subscription found" — the consuming pages could not distinguish these states.
**Fix:** Implemented 3-state system: `ownerSubscription===undefined` → `ownerHasAccess=null` (still loading, allow interaction), `ownerSubscription===null` → `ownerHasAccess=false` (no row = fail-closed), otherwise check `.status`. All BM pages gate submits on `ownerHasAccess === false` not `!ownerHasAccess`.
**Rule:** Subscription access checks must be fail-closed: missing data = no access, not loading.

---

## BUG #110 — CRITICAL: Register.jsx email validation too weak — accepted invalid addresses
**File:** src/pages/owner/Register.jsx
**Symptom:** Emails like "test@" or "@foo" passed validation and got sent to Supabase, which returned confusing auth errors instead of a clear "invalid email" message.
**Root cause:** Validation was `!form.email.includes('@')` — any string with `@` passed.
**Fix:** Changed to full regex: `!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)`.
**Rule:** Email validation must use a regex that checks for `user@domain.tld` format, not just `@` presence.

---

## BUG #111 — CRITICAL: Login pages show unusable decorative panel on mobile
**Files:** src/pages/owner/Login.jsx, src/pages/branch-manager/Login.jsx
**Symptom:** On mobile, the left decorative panel (42% width) forced the form into an unusable narrow column.
**Root cause:** Split-screen layout had no mobile breakpoint — both panels always rendered.
**Fix:** Added `isMobile` state (resize listener). Left panel now conditionally renders: `{!isMobile && <div style={{width:'42%',...}}>...</div>}`. Right form panel gets full width on mobile.
**Rule:** Split-screen login layouts must hide decorative panels on mobile (`window.innerWidth < 768`).

---

## BUG #112 — HIGH: BM FoodSafety real-time channel used branch_id instead of profile.id
**File:** src/pages/branch-manager/FoodSafety.jsx
**Symptom:** If two branch managers shared the same branch_id, their real-time channels would have identical names, causing Supabase to crash with "cannot add callbacks after subscribe()" error.
**Root cause:** Channel name was `bm-fs-${profile.branch_id}` — not unique per user.
**Fix:** Changed to `bm-fs-${profile.id}` — unique per manager.
**Rule:** ALL channel names MUST use `profile.id` (the user's UUID), never `branch_id`. This is documented in CLAUDE.md STEP 3.

---

## BUG #113 — HIGH: Managers.jsx taskSubsRes missing .limit() — could silently truncate
**File:** src/pages/owner/Managers.jsx
**Symptom:** Owners with many branches and many submissions today could get silently truncated task submission data, causing manager performance scores to be wrong.
**Root cause:** `taskSubsRes` query (today's task submissions) had no `.limit()`.
**Fix:** Added `.limit(1000)` to the `taskSubsRes` query.
**Rule:** Every `task_submissions` query must have an explicit `.limit()`.

---

## BUG #114 — HIGH: Reports.jsx pagination was sequential — blocked UI for large date ranges
**File:** src/pages/owner/Reports.jsx
**Symptom:** For owners with many branches and a 90-day window, each pagination page waited for the previous one to finish — N pages × ~200ms = multi-second blocking fetch.
**Root cause:** `while (true)` loop fetched pages one at a time in sequence.
**Fix:** Fetch page 0 first. If full (1000 rows), fetch pages 1–4 in parallel with `Promise.all`. Sequential break logic maintained: stop at first empty page.
**Rule:** Multi-page fetches must use `Promise.all` for parallel requests, not sequential while loops.

---

## BUG #115 — HIGH: Register.jsx missing Arabic name field — name_ar stored as null
**File:** src/pages/owner/Register.jsx
**Symptom:** All new owners had `name_ar=null` in `public.users`. Arabic mode showed blank names everywhere.
**Root cause:** Registration form had no `nameAr` field.
**Fix:** Added optional `nameAr` form field (Arabic name, RTL input), stored as `name_ar: form.nameAr || null` in `users.upsert`.
**Rule:** Any `users` upsert during registration must include `name_ar` if the product supports Arabic.

---

## BUG #116 — HIGH: Register.jsx password minimum 6 chars — too weak for a production app
**File:** src/pages/owner/Register.jsx
**Symptom:** Owners could register with trivially weak passwords like "123456", creating security risk.
**Root cause:** Validation was `password.length < 6`. Password strength thresholds also based on 6/10.
**Fix:** Changed minimum to `< 8`. Strength thresholds updated to `< 8` / `< 12`. Placeholder updated to "Min. 8 characters". Error message updated.
**Rule:** Production passwords must require minimum 8 characters.

---

## BUG #117 — HIGH: Register.jsx showed raw Supabase English errors to Arabic users
**File:** src/pages/owner/Register.jsx
**Symptom:** On registration errors (duplicate email, network failure, timeout), Arabic users saw raw Supabase error strings in English like "User already registered".
**Root cause:** `catch` block called `setError(err.message)` directly.
**Fix:** Added `translateAuthError(msg, isAr)` function that maps Supabase error patterns to bilingual user-friendly messages. Also wraps the registration flow in a `Promise.race` with a 15-second timeout that maps to a bilingual timeout message.
**Rule:** NEVER show raw `err.message` from Supabase auth to users. Always translate through a bilingual error mapping function.

---

## BUG #118 — HIGH: TaskManagement.jsx globalTasksRes missing .limit(500) — unbounded fetch
**File:** src/pages/owner/TaskManagement.jsx
**Symptom:** Owners with many global tasks (branch_id=null) could silently truncate at the Supabase default limit of 1000, showing incomplete task lists.
**Root cause:** The `globalTasksRes` query for global tasks had no `.limit()`.
**Fix:** Added `.limit(500)` to `globalTasksRes`.
**Rule:** All task queries must have an explicit `.limit()`.

---

## BUG #119 — HIGH: BM real-time callbacks fired immediately on every change with no debounce
**Files:** src/pages/branch-manager/Dashboard.jsx, DailyTasks.jsx, WeeklyTasks.jsx, FoodSafety.jsx
**Symptom:** When a manager submitted 5 tasks rapidly, each submission triggered an immediate `fetchData()` re-fetch. This caused 5 sequential DB round trips instead of 1, creating race conditions and flicker.
**Root cause:** RT callbacks called `fetchData()` directly with no debounce.
**Fix:** Added `debounce(fn, ms)` export to `src/lib/cache.js`. Each BM RT useEffect now creates a `debouncedFetch` (300ms), passes it as the callback, and calls `debouncedFetch.cancel()` in cleanup.
**Rule:** Real-time fetch callbacks in high-frequency tables (task_submissions) MUST be debounced. Use `debounce` from `lib/cache.js`.

---

## BUG #120 — MEDIUM: Dashboard stat cards used fixed 3-column grid — unusable on mobile
**Files:** src/pages/branch-manager/Dashboard.jsx, src/pages/owner/Dashboard.jsx
**Symptom:** On mobile, the 3-column stat card grid rendered each card at ~110px wide — too narrow to read numbers and labels.
**Root cause:** `gridTemplateColumns:'1fr 1fr 1fr'` (BM) and `gridTemplateColumns:'repeat(3,1fr)'` (Owner) were hardcoded with no mobile breakpoint.
**Fix:** Added `isMobile` state (resize listener) to both Dashboards. Grid now uses `isMobile ? '1fr' : '1fr 1fr 1fr'` / `isMobile ? '1fr' : 'repeat(3,1fr)'`.
**Rule:** Any grid with 3+ columns must be responsive. Use `isMobile` state (window.innerWidth < 768) to switch to single column.

---

## BUG #121 — MEDIUM: Reports.jsx included submissions for deleted/inactive tasks — inflated missed count
**File:** src/pages/owner/Reports.jsx
**Symptom:** Task submissions for tasks that were subsequently deleted (is_active=false) still appeared in the 90-day report, inflating "missed" counts and skewing completion rates.
**Root cause:** `setTaskSubs(allTaskSubs)` stored all fetched submissions without filtering by active task IDs.
**Fix:** After merging taskDefs, build `activeTaskIds = new Set(allTaskDefs.map(t=>t.id))` and filter: `setTaskSubs(allTaskSubs.filter(s => activeTaskIds.has(s.task_id)))`.
**Rule:** Report data must always be filtered to currently-active task definitions.

---

## BUG #122 — MEDIUM: BM FoodSafety submissions query had .limit(50) — silently truncated
**File:** src/pages/branch-manager/FoodSafety.jsx
**Symptom:** Branches with more than 50 food safety submissions today would silently show incomplete data, causing standards to appear "pending" when they were actually submitted.
**Root cause:** `.limit(50)` on the `food_safety_submissions` query.
**Fix:** Changed `.limit(50)` → `.limit(500)`.
**Rule:** Food safety submission queries must use `.limit(500)` minimum.

---

## BUG #123 — MEDIUM: ResetPassword.jsx 5-second timeout too short — shown expired before link loads
**File:** src/pages/owner/ResetPassword.jsx
**Symptom:** On slow connections, users who clicked a valid password reset link saw "Link expired" after 5 seconds before the auth callback had a chance to fire.
**Root cause:** `setTimeout(() => setExpired(true), 5000)` — 5 seconds is too short for slow connections.
**Fix:** Extended to 12000ms. Added intermediate `stillWaiting` state at 6000ms that shows a bilingual hint: "Still loading — make sure you clicked the link from your email…"
**Rule:** Auth callback timeouts must be ≥10 seconds. Add an intermediate warning at ~50% of the timeout rather than jumping straight to "expired".

---

## BUG #124 — MEDIUM: Register.jsx had no timeout on registration flow — could hang forever
**File:** src/pages/owner/Register.jsx
**Symptom:** On poor connections, the multi-step registration flow (signUp → signIn → upsert → insert) could hang indefinitely with the spinner showing forever, no error, no recovery.
**Root cause:** No timeout on the async registration flow.
**Fix:** Wrapped flow in `Promise.race([registrationFlow(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))])`. Timeout error maps to bilingual "Connection timed out" message.
**Rule:** Multi-step async flows that involve network requests MUST have a timeout (15s is appropriate). Never leave users with a spinner that can't resolve.

---

## BUG #125 — MEDIUM: SubscriptionBanner "Renew Now" button overflowed on narrow screens
**File:** src/components/SubscriptionBanner.jsx
**Symptom:** On mobile, the "Renew Now" button extended outside the banner card on expired/expiring-soon banners.
**Root cause:** Row containers had no `flexWrap`, and buttons had `whiteSpace:'nowrap'`.
**Fix:** Added `flexWrap:'wrap', gap:8` to all three banner row containers. Removed `whiteSpace:'nowrap'` from "Renew Now" buttons.
**Rule:** Banner action rows must use `flexWrap:'wrap'` so the CTA button wraps to a new line on mobile.

---

## BUG #126 — MEDIUM: Managers.jsx had no users table RT subscription — manager deactivation not reflected live
**File:** src/pages/owner/Managers.jsx
**Symptom:** When an owner deactivated a manager in Managers.jsx (via toggle), the change wasn't reflected in the manager list until the owner refreshed, because the real-time channel only listened to `branches` and `task_submissions`.
**Root cause:** Missing `users` table listener in the RT subscription.
**Fix:** Added `.on('postgres_changes', { event:'*', schema:'public', table:'users' }, () => { fetchData() })` to the existing channel.
**Rule:** Pages that display user data that can change (is_active, role) must subscribe to the `users` table real-time channel.

---

## BUG #127 — LOW: platformSettings DEFAULT_SETTINGS had placeholder WhatsApp number
**File:** src/lib/platformSettings.js, src/components/SubscriptionBanner.jsx
**Symptom:** SubscriptionBanner showed a "Renew Now" link to `wa.me/966XXXXXXXXX` — a non-functional placeholder — before admin had configured the real number.
**Root cause:** `DEFAULT_SETTINGS.support_whatsapp` was `'+966XXXXXXXXX'` (placeholder string, not null).
**Fix:** Changed to `null`. Updated `waLink()` in SubscriptionBanner to return `null` when number is null or has fewer than 8 digits. "Renew Now" button only renders when `waLink()` returns a valid string.
**Rule:** Placeholder values in DEFAULT_SETTINGS must be `null`, not fake strings. UI must guard against null links.

---

## BUG #128 — LOW: ForgotPassword.jsx didn't detect rate limit — showed generic error
**File:** src/pages/owner/ForgotPassword.jsx
**Symptom:** When an owner requested too many password reset emails in a short time, Supabase returned a rate limit error, but the UI showed the generic "Something went wrong" message — no guidance to wait.
**Root cause:** Error handling was `if (err) { setError(t.errGeneric) }` — no pattern matching.
**Fix:** Added pattern check: if `err.message` contains 'rate limit', 'too many', 'security purposes', or 'after ', show bilingual "Too many requests. Please wait a few minutes before trying again." message.
**Rule:** Auth operations with rate limits (resetPasswordForEmail, signIn) MUST detect and surface rate limit errors with clear bilingual "wait a few minutes" guidance.

---

## BUG #129 — LOW: upload.js filenames used timestamp only — collision risk
**File:** src/lib/upload.js
**Symptom:** Two managers uploading a photo at the same millisecond for the same task would produce the same storage path `{branchId}/{taskId}/{timestamp}.ext`, and `upsert:true` would silently overwrite the first photo.
**Root cause:** Path was `${Date.now()}.${ext}` — timestamp alone is not unique.
**Fix:** Changed to `${Date.now()}-${crypto.randomUUID()}.${ext}` — timestamp + UUID guarantees uniqueness.
**Rule:** Storage upload paths must include a UUID component. `Date.now()` alone is not sufficient for uniqueness.

---

## BUG #130 — CRITICAL: Branch managers cannot read owner subscription — missing RLS policy
**File:** Supabase SQL (RLS policies on `public.subscriptions`)
**Symptom:** All branch managers see the "subscription expired" banner incorrectly, even when the owner's subscription is active. Tasks and food safety records cannot be submitted.
**Root cause:** The `subscriptions` table has no RLS policy allowing branch managers to read their owner's subscription row. `supabaseBranchManager` gets 0 rows back → `fetchOwnerSubscription` returns `null` → `ownerSubscription = null` → `ownerHasAccess = false` → expired banner shows incorrectly on every BM page.
**Fix:** Add RLS policy:
```sql
CREATE POLICY "manager_read_owner_subscription" ON public.subscriptions
  FOR SELECT USING (
    owner_id IN (
      SELECT owner_id FROM public.branches
      WHERE manager_id = auth.uid()
    )
  );
```
**Rule:** Any time branch managers need to read owner-scoped data (subscriptions, owner profile, etc.), add an explicit RLS policy scoped via the `branches` table join (`WHERE manager_id = auth.uid()`). Never assume a manager can read an owner's rows by default — Supabase RLS denies all access unless a policy explicitly grants it.

---

## Bug count: #038 – #130 (93 bugs total)
