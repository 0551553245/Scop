# Scop

Restaurant operations SaaS for Saudi Arabia — Owner, Branch Manager, and Super Admin panels.

## Hard reset (in progress)

This branch rebuilds the frontend from a clean `src/` while keeping:

- `.claude/skills/` + `CLAUDE.md` (rules + bug log)
- `supabase/migrations/`
- Existing Supabase project + data

### Live now
- Three isolated Supabase clients + auth contexts
- Protected routes (user + profile, 8s timeout)
- Owner / BM / Admin login
- Owner register + email verify (user_metadata survives cross-browser)
- Panel shells with mobile sidebar
- Feature pages as rebuild placeholders

### Rebuild order
1. Owner Branches + Managers (`create-manager` Edge Function)
2. Owner Tasks → BM Daily/Weekly/Monthly submit
3. Food Safety (owner standards → BM submit)
4. Schedule
5. Reports (via `src/lib/stats.js`)
6. Subscription + Moyasar
7. Admin panel

## Run locally

```bash
npm install
npm run dev
```

```bash
npm run build   # required before done — 0 errors
```

## Panels

| Panel | Path | Client | Session |
|---|---|---|---|
| Owner | `/owner/*` | `supabaseOwner` | `scop-owner-session` |
| Branch Manager | `/branch-manager/*` | `supabaseBranchManager` | `scop-bm-session` |
| Admin | `/admin/*` | `supabaseAdmin` | `scop-admin-session` |

Never mix clients or auth contexts across panels.
