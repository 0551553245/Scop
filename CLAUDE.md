# Scop — Claude Code Instructions

> Read ALL of these skill files before writing ANY code in this project.
> No exceptions. Every bug in the bug log was caused by skipping this step.

## STEP 1 — Read skills in this exact order:

1. .claude/skills/opspilot-context/SKILL.md   ← project overview, panels, schema
2. .claude/skills/opspilot-dev/SKILL.md       ← coding patterns, query templates
3. .claude/skills/opspilot-database/SKILL.md  ← database schema, RLS policies
4. .claude/skills/opspilot-auth/SKILL.md      ← auth contexts, session rules
5. .claude/skills/opspilot-design/SKILL.md    ← design system, colors, components
6. .claude/skills/scoop-bug-log/SKILL.md      ← MANDATORY: every bug ever fixed

## STEP 2 — Answer these 5 questions before touching any file:

1. Which panel? → Owner / Branch Manager / Admin (NEVER mix)
2. Which Supabase client? → supabaseOwner / supabaseBranchManager / supabaseAdmin
3. Which table columns? → Check scoop-bug-log for column name rules
4. Global tasks involved? → MUST use .or('branch_id.eq.X,branch_id.is.null')
5. Stats calculation needed? → MUST import from src/lib/stats.js

## STEP 3 — Critical rules (memorize these):

- food_safety_submissions → "result" NOT "status"
- task_submissions → "note" NOT "notes", "value_entered" NOT "numeric_value"
- task_submissions → "submitted_at" range filter, NEVER "submission_date"
- All rates → Math.min(100, Math.round((done / Math.max(expected,1)) * 100))
- All pending → Math.max(0, expected - done)
- Real-time callbacks → NEVER async → () => fetchData() not async () => {}
- Channel names → ALWAYS include profile.id → .channel('name-${profile.id}')
- Every channel → MUST return () => supabase.removeChannel(channel)
- Cache → ALWAYS invalidateCache(key) before fetchData() in real-time callback
- Delete operations → optimistic UI update + invalidateCache(), no window.confirm()
- ProtectedRoute → timeout 8000ms, NEVER localStorage.clear()
- supabaseTemp → persistSession: false + storageKey: 'scop-temp-signup'

## STEP 4 — Before finishing any task:

- Run: npm run build
- Fix ALL errors and warnings
- Confirm 0 errors before reporting done
- Add any new bugs found to .claude/skills/scoop-bug-log/SKILL.md

## Project structure:

src/
  pages/
    owner/          ← supabaseOwner + useOwnerAuth() ONLY
    branch-manager/ ← supabaseBranchManager + useBranchManagerAuth() ONLY
    admin/          ← supabaseAdmin + useAdminAuth() ONLY
  context/
    OwnerAuthContext.jsx
    BranchManagerAuthContext.jsx
    AdminAuthContext.jsx
  lib/
    supabase.js     ← exports 3 isolated clients
    stats.js        ← getExpectedForBranch, getTotalExpected, calcRate, calcPending
    cache.js        ← getCached, setCached, invalidateCache, invalidateAll
    prefetch.js     ← prefetchOwnerTasks, prefetchBMDailyTasks
  components/
    ProtectedRoute.jsx  ← timeout: 8000ms, never clear storage

## Three panels — NEVER mix:

Owner:          /owner/*          supabaseOwner          scop-owner-session
Branch Manager: /branch-manager/* supabaseBranchManager  scop-bm-session  
Admin:          /admin/*          supabaseAdmin          scop-admin-session
