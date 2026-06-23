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
