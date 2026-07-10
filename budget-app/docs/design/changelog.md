# Design Changelog

## 2026-06-22 — Calendar screen full redesign

**What changed**
- Redesigned the Calendar tab (`app/(tabs)/calendar.tsx`) to adopt the app design system
  (`utils/design-system.ts`). The previous version used ad-hoc inline styles, hardcoded
  colors, and its own gradient — making it look like a different app.
- Introduced the **actual-vs-projected** visual model to express the bill double-count
  fix: actual money = solid; upcoming/unpaid bills = ghosted/dashed/outline.
- Replaced the old `+income / -expense / net` summary bar with a three-column
  **"Spent so far / Still due / Income"** split header + dual net line.
- Per-day grid markers now distinguish solid (real spending/income) from hollow ring
  (upcoming bill due).
- Per-day detail groups events into ACTUAL and UPCOMING with per-day split chips.
- Proposed optional, graceful-degrade partner attribution glyph for couples.

**Why**
- Bills were being double-counted; the data model now separates actual money from
  projected unpaid bills. The UI had to stop blending expenses into one number.

**Artifacts**
- Spec: `docs/design/specs/calendar-redesign.md`
- Components: `docs/design/components/CalendarSummaryHeader.json`,
  `CalendarDayCell.json`, `CalendarEventRow.json`, `CalendarDayDetail.json`
- Tokens: `docs/design/tokens/calendar-tokens.json`
- Flow: `docs/design/flows/calendar.mermaid`

## 2026-07-10 — Dashboard (Home) full redesign

**What changed**
- Redesigned the Dashboard tab (`app/(tabs)/dashboard.tsx`, a 1,685-line monolith) to
  adopt the design system fully. The old screen hardcoded colors, spacing, and a
  slightly-wrong gradient (`#0f0a1e`), and had no loading/empty/error states.
- Imposed a strict **5-tier hierarchy** around one north-star question ("How are we doing
  right now?"): (1) Status Headline, (2) Attention, (3) This-week proof, (4) Trajectory
  strip, (5) Recent activity.
- **Status Headline** (new centerpiece): a synthesized worst-signal-wins verdict in 3
  states (good/watch/alert) + one AI-authored warm sentence + one hero number (this
  month's cash flow). Replaces the old arbitrary mood-emoji. Only card that floats
  (`glassFloating`) and only one using `typography.h1` — the hierarchy enforcer.
- **This-week proof**: weekly bar chart + Budget/Savings/Bills mini-row grouped into ONE
  evidence card.
- **Trajectory strip**: net worth + framework progress condensed from two full cards into
  one compact horizontal row.
- **ScopeToggle** (Household | Me): compact header segmented control, default Household,
  hidden for solo users, re-scopes the whole screen.
- Added **loading (skeleton), empty (new household + CTA), error, and partial-error**
  states the old screen lacked. Partner-attribution glyph reused from the calendar.

**Cut (relocated/deleted, not designed)**: achievements badge row (→ progress screen),
Sun/Mon weekly recap card (deleted), standalone AI-nudge card (merged into headline +
attention).

**Why**
- The old dashboard was a flat pile of ~equal cards with no clear top; the redesign makes
  the right-now verdict unmistakably primary and tokenizes everything.

**Artifacts**
- Spec: `docs/design/specs/dashboard-redesign.md`
- Components: `docs/design/components/StatusHeadlineCard.json`, `TrajectoryStrip.json`,
  `ScopeToggle.json`, `ThisWeekProof.json`
- Tokens: `docs/design/tokens/dashboard-tokens.json`
- Flow: `docs/design/flows/dashboard.mermaid`
