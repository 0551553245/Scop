# QA Checklist — `src/pages/owner/Reports.jsx`

This page has the highest bug density in the app (9+ logged bugs). Run this checklist before any deploy that touches `Reports.jsx`, `lib/stats.js`, or `lib/weekUtils.js`.

## 1. Date range switching
Periods are `Today`, `This Week`, `This Month`, `Last 3 Months` (`Reports.jsx:15-20`).
- [ ] Switching between all 4 periods updates every KPI card, both charts, and the branch performance bars — not just some of them.
- [ ] The date/period label in the header updates to match the selected period.
- [ ] "This Week" uses the Saudi Saturday-start week (`getWeekStartStr()`), not a Monday-start week — check the number of bars shown matches the actual days elapsed since Saturday, not since Monday (regression check for BUG #090).

## 2. Branch data — combined + per-branch breakdown
**Correction: this page has no branch filter dropdown** — it always shows all branches combined, with a separate per-branch breakdown section (branch performance bars). Test accordingly:
- [ ] All of the owner's active branches appear in the branch performance section — none silently missing.
- [ ] KPI cards at the top reflect the sum across all branches, not just one.

## 3. Task completion chart
- [ ] Bars render correctly for all 4 periods, including the "Last 3 Months" weekly-grouped view.
- [ ] The "missed" (red) portion of each bar is non-zero when tasks were actually missed — this was BUG #087/#088 (missed was always 0 because it was computed from a `status='missed'` filter that never matches any real row; must be `expected - completed`, never a status filter).
- [ ] A branch/period combination with zero submissions renders an empty/flat chart with no console error, not a crash.

## 4. Food safety pass rate
- [ ] ⚠️ **Known issue, likely still broken:** `Reports.jsx:250-251` sets `fsTotal = fsFiltered.length` (submissions count) instead of the active standards count. Test by comparing the displayed pass rate against `(passed submissions) / (total active standards for that period)` by hand — if a branch has 5 standards and only submits 1 (which passes), this page will currently show 100% instead of 20%. This is the same bug class as #069/#073, already fixed on `Branches.jsx`/`Managers.jsx` but not here — expect this check to fail until it's fixed separately.
- [ ] The `X/Y passed` sub-label under the KPI matches whatever denominator is actually being used (confirm it says what the code does, even if the code is wrong per above).

## 5. Branch performance bars
- [ ] Every branch appears, including branches with 0% or no submissions today.
- [ ] No bar ever shows over 100% (regression check on `calcRate`'s `Math.min(100, ...)` guard).

## 6. Mobile layout
- [ ] Export button collapses to icon-only with no visible text label on a ≤375px viewport (regression check for BUG #133).
- [ ] Page padding drops to 16px, KPI grid collapses to 2 columns, and side-by-side chart rows stack to 1 column on mobile (regression check for BUG #138).
- [ ] The bar chart has no forced horizontal scroll / hardcoded `minWidth` floor on mobile — bars should fill the card width naturally, not overflow a 343px-wide card.

## 7. Arabic / RTL
- [ ] Page direction flips to RTL, sidebar/topbar mirror correctly.
- [ ] Dates and period labels display in Arabic (`هذا الأسبوع`, `آخر 3 أشهر`, etc.), not left in English.
- [ ] Numbers in charts/KPIs remain legible and correctly aligned in RTL mode (no mirrored digits or overlapping labels).

## 8. Export button
- [ ] `exportCSV()` runs without a console error on all 4 periods.
- [ ] The exported file's period label matches the currently selected period, not a stale one from a prior selection.
- [ ] Exporting with zero data (e.g. "Today" on a branch with no submissions yet) doesn't throw — produces an empty-but-valid file.

---

## Known bug history on this page

| Bug | Summary |
|---|---|
| #087 | Missed Tasks KPI was always 0 — filtered by `status === 'missed'`, a status branch managers never actually write. Fixed to use `expected - done`. |
| #088 | Same root cause as #087 — the bar chart's "missed" (red) segment was always empty for the same reason. |
| #090 | Weekly view used a Monday-based week length (`getDay()`) instead of the Saudi Saturday-start week from `getWeekStartStr()`, showing the wrong number of days/bars. |
| #102 | The 90-day food safety query had no `.limit()` — could silently truncate high-volume data at Supabase's default 1000-row cap. |
| #103 | Client-side date filtering had no UTC+3 offset — submissions made 00:00-03:00 Saudi time were excluded from "today." |
| #114 | Multi-page pagination for large date ranges ran sequentially (one page waits for the last), blocking the UI for seconds; fixed to fetch in parallel. |
| #121 | Submissions for deleted/inactive tasks were still counted, inflating the missed count; fixed to filter by currently-active task IDs. |
| #133 | Mobile topbar overflowed with 7 controls in one row; fixed to an icon-only 3-item mobile layout with period selector moved into page content. |
| #138 | Four simultaneous mobile layout failures at once: topbar overflow, KPI cards clipped, bar chart force-scrolled past card width, and side-by-side grids didn't stack. |
