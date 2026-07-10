# Scop Hard Reset — Rebuild Tracker

Started: hard reset of `src/` on branch `cursor/hard-reset-rebuild-2a8a`.

## Done
- [x] Wipe and rescaffold `src/`
- [x] `lib/` — supabase (3+temp), stats, cache, platformSettings, upload, weekUtils
- [x] Auth contexts with Path-B signOut + BM fail-closed subscription
- [x] ProtectedRoute (user+profile, 8s, no storage clear)
- [x] PanelShell + AuthShell + design tokens
- [x] Owner/BM/Admin login
- [x] Owner register + email verify (restaurant fields in user_metadata)
- [x] Forgot/reset password (restored)
- [x] Landing + legal pages (restored)
- [x] All routes wired; feature pages = placeholders

## Next slices
- [ ] Owner Branches (CRUD + limits from platform_settings)
- [ ] Owner Managers (create-manager Edge Function only)
- [ ] Owner Task Management + BM task submit flows
- [ ] Food Safety both panels
- [ ] Schedule both panels
- [ ] Reports (stats.js only)
- [ ] Subscription UI + Moyasar
- [ ] Admin panel pages
- [ ] Version create-manager Edge Function into repo
