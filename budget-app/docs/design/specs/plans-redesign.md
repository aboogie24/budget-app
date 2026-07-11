# Financial Plans Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Route / file:** `plans` → `budget-app/app/plans.tsx`
**Archetype:** list (mirrors `bills.tsx` / `calendar.tsx` / `dashboard.tsx` conventions)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Sibling references:** `bills-redesign.md`, `calendar-redesign.md`, `dashboard-redesign.md`

---

## 1. Why this redesign exists

`plans.tsx` is a **standalone visual island**. Like the pre-redesign bills/calendar
screens, it hardcodes its own palette, gradient, and surfaces instead of consuming the
design system:

- Its own gradient background — `<LinearGradient colors={['#0b1021','#2b0f50','#1b1039']}>`
  — which is **not** any `gradients.*` entry, so it reads as a slightly different app from
  its siblings. (It isn't even the same three-stop gradient the old bills/calendar used.)
- Its own status/type palettes — `PLAN_TYPE_CONFIG` and `STATUS_CONFIG` hand-mix
  `#ef4444 / #22c55e / #a855f7 / #94a3b8 / #eab308 / #3b82f6`. These are *near* but not
  guaranteed-equal to `colors.error / success / primary2 / textMuted / warning / info`,
  and they're duplicated again inline for milestones (`MILESTONE_ICONS`) and approvals
  (inline ternaries at lines 566–567). Four copies of "the status color logic," none
  tokenized.
- Ad-hoc surfaces everywhere: `rgba(255,255,255,0.06)` cards, `rgba(255,255,255,0.08)`
  borders, raw `borderRadius: 16 / 14 / 12 / 10 / 8`, raw paddings `24 / 16 / 14 / 12 /
  10 / 8`, and inline font sizes/weights (`fontSize: 20/800`, `18/700`, `15/700`, `14/600`,
  `13`, `12`, `11/700`) — none tokenized.
- A **spinner-only** loading state in *both* views — list (`<ActivityIndicator
  color="#c084fc">`, line 883) and detail (line 418) — where the rest of the app now uses
  `Skeleton` placeholders that hold layout.
- The detail view rolls its **own** back button (`iconButton` + inline `arrow-back`,
  line 424) instead of the shared `BackButton`, and its header title uses a bespoke
  `fontSize:20/800` instead of `typography.h3`.
- Three near-identical bottom-sheet modals (create / edit-plan / edit-milestone / reject)
  each re-declare the same input, label, cancel, and gradient-save styling **inline**, on
  a hardcoded `#1a1a2e` sheet — four copies of a form sheet that should share one recipe.

Everything below swaps those hardcoded values for design-system tokens and shared
components, and tightens the information architecture — **without changing what the screen
does**. Every current capability is preserved: the summary (active plans + monthly
contributions), the plan list with type/status badges, the plan detail (overview grid,
AI analysis, milestones with tap-to-toggle + tap-to-edit, allocations with progress bars,
partner approvals with approve/reject), status transitions (activate / pause / resume),
delete, and the create/edit/reject modals.

### The IA problems we also fix

1. **The summary is under-selling.** The list's top summary is a flat two-number card
   (`Active Plans` / `Monthly Contributions`). The dashboard/bills siblings lead with a
   single elevated "headline" card. We promote this to a **`glassFloating` summary hero**
   that leads with the money — total monthly commitment — plus a compact plan-mix
   breakdown, so the couple's headline answer ("how much are we committing, and to what")
   is the first thing on screen.

2. **The detail view is a wall of equal-weight cards.** Overview, AI, milestones,
   allocations, approvals, and actions all render as the same flat `card`. We keep every
   section but establish a clear hierarchy: a **plan header hero** (name + status +
   money), then **progress** (milestones as a completion track), then **allocations**,
   then **collaboration** (approvals), with a **sticky-feeling action bar** at the bottom.

3. **Status is color-only in three places.** List badge, milestone badge, and approval
   row all lean on color to convey state. We adopt the sibling convention: **icon + word +
   color together, never color alone** (per `bills-redesign.md` §1 and `calendar-redesign.md`
   §8). The "active/paused/completed/draft" status and "pending/reached/skipped" milestone
   state each get a leading icon and a readable word.

4. **Milestone completion is invisible.** There's a list of milestones but no sense of
   "how far along is this plan." We add a lightweight **completion count + track**
   ("2 of 5 reached") at the top of the Milestones section — free from data already present.

### The "draft vs. active" plan reality (borrowed from the calendar/bills split)

A plan has a committed/tentative duality that maps cleanly onto the app's established
**solid-vs-ghosted** metaphor:

- An **active** plan is committed money — real monthly contribution flowing now → **solid**.
- A **draft** plan is a proposal — it *will* commit money once approved/activated, but
  hasn't yet → **ghosted** (dashed accent, muted contribution, "DRAFT" label).
- **Paused** is an active plan temporarily halted → solid surface, `warning` status.
- **Completed** is done → solid surface, `info` status, celebratory check.

We reuse the sibling rule so the screens read identically: **committed = solid,
tentative = outlined/ghosted with a word-label**, applied to the summary split and each
plan row, and it is **never color-only** (icon + word + color together).

---

## 2. Token & convention mapping (no magic numbers)

Every hardcoded value in `plans.tsx` → its design-system replacement.

| Old hardcoded value | Replace with token |
|---|---|
| `<LinearGradient colors={['#0b1021','#2b0f50','#1b1039']}>` (both views) | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `PLAN_TYPE_CONFIG.debt_payoff.color '#ef4444'` | `colors.error` |
| `PLAN_TYPE_CONFIG.savings.color '#22c55e'` | `colors.success` |
| `PLAN_TYPE_CONFIG.combined.color '#a855f7'` | `colors.primary2` |
| `STATUS_CONFIG.draft '#94a3b8'` | `colors.textMuted` |
| `STATUS_CONFIG.active '#22c55e'` | `colors.success` |
| `STATUS_CONFIG.paused '#eab308'` | `colors.warning` |
| `STATUS_CONFIG.completed '#3b82f6'` | `colors.info` |
| `*.bg 'rgba(239,68,68,0.15)'` etc. | semantic color at 12% — `rgba(239,68,68,0.12)` / `rgba(34,197,94,0.12)` / `rgba(168,85,247,0.12)` / `rgba(148,163,184,0.12)` / `rgba(234,179,8,0.12)` / `rgba(59,130,246,0.12)`. Same 12%-tint recipe as `bills-redesign.md` §2 / `CalendarEventRow.json`. (Old code used 0.15; standardize to 0.12.) |
| `MILESTONE_ICONS.pending '#94a3b8'` | `colors.textMuted` |
| `MILESTONE_ICONS.reached '#22c55e'` | `colors.success` |
| `MILESTONE_ICONS.skipped '#ef4444'` | `colors.error` |
| approval inline `'#22c55e'/'#ef4444'/'#94a3b8'` (lines 566) | `colors.success` / `colors.error` / `colors.textMuted` |
| approval feedback bg `rgba(239,68,68,0.08)`, text `#f87171` | `rgba(239,68,68,0.08)` (semantic tint), `colors.error` |
| approve button `['#22c55e','#15803d']` | `gradients.successGradient` |
| reject button `['#ef4444','#b91c1c']` | `gradients.errorGradient` |
| activate button `['#22c55e','#15803d']` | `gradients.successGradient` |
| save buttons `['#a855f7','#7c3aed']` | `gradients.primaryGradient` |
| allocation progress fill `['#a855f7','#7c3aed']` | `gradients.primaryGradient` |
| allocation amount `#c084fc` | `colors.accent` |
| AI analysis accent `#c084fc` (`sparkles`, `analysisKey`) | `colors.accent` |
| `iconButton` custom back (line 424) + `#e5e7eb` | shared `<BackButton />` (already tokenized) |
| edit-pencil icon `#c084fc` | `colors.accent` |
| add-circle icon `#c084fc` (line 850) | `colors.accent` |
| header refresh spinner `#c084fc` | `colors.primary2` |
| `summaryCard` fill `rgba(255,255,255,0.06)` + border `rgba(255,255,255,0.08)` | `glassEffects.glassFloating` (hero earns elevation, matches bills/dashboard headline) |
| `card` fill `rgba(255,255,255,0.06)` + border `rgba(255,255,255,0.08)` | `glassEffects.glass` (`colors.glassLight`) |
| all `divider` `rgba(255,255,255,0.04–0.06)` | `colors.borderLight` |
| all borders `rgba(255,255,255,0.1/0.2)` | `colors.borderGlass` / `colors.borderLight` |
| `borderRadius: 16` (cards) / `14`(buttons) / `12`(chips/inputs/sheet) / `10`(badge) / `8`(small) | `radius.lg` / `radius.lg` / `radius.md` / `radius.sm` / `radius.sm` |
| paddings `24 / 16 / 14 / 12 / 10 / 8 / 6 / 4` | `spacing.xl / lg / md / sm / xs` |
| `headerTitle 20/800` | `typography.h3` |
| `summaryValue 18/800` / `detailValue 14/600` | `typography.h2` (hero total) / `typography.smallBold` |
| `cardTitle 15/700` / `sectionTitle 16/700` | `typography.bodyBold` |
| `badgeText 11/700` / `milestoneBadgeText 10/700` | `typography.caption` (fontWeight 700, `letterSpacing 0.4`) |
| detail/meta `13 / 12 / 11` | `typography.small` / `typography.caption` |
| section group labels (uppercase) | `typography.caption`, `letterSpacing 0.6`, `colors.textMuted`, `fontWeight 700` — matches `RecentActivity` `groupLabel` |
| modal sheet bg `#1a1a2e` (all four modals) | `colors.surface2` (`#1e293b`) |
| modal backdrop `rgba(0,0,0,0.6)` | keep (`rgba(0,0,0,0.6)` is the app's standard scrim) |
| input bg `rgba(255,255,255,0.06)` + border `rgba(255,255,255,0.1)` | `glassEffects.glass` fill + `colors.borderGlass` |
| input/label text `#f8fafc / #e5e7eb / #94a3b8`, placeholder `#475569` | `colors.text` / `colors.text` / `colors.textMuted`, placeholder `colors.textDark` |
| type-picker active `rgba(*,0.15)` + colored border | 12%-semantic tint + semantic-color border (same recipe as bills picker) |
| progress bar track `rgba(255,255,255,0.06)` | `colors.glassMedium` |
| `ActivityIndicator` loading (both views) | `components/Skeleton.tsx` (see §6 loading) |
| `EmptyState` / `ErrorState` components | keep as-is (already shared & tokenized) |
| `Alert.alert` confirmations (delete, validation) | keep (native confirm is correct for destructive/validation) |

**Rule:** after this pass there are **no** literal hex/rgba/px in `plans.tsx` except the
12%/8%-tint status backgrounds, which are the documented semantic-tint recipe.

---

## 3. Redesigned layout — LIST VIEW (populated)

Ordered top→bottom, each block a tokenized glass section with `spacing.lg` between.
Header is a fixed row (outside the `ScrollView`, matching bills/dashboard); everything
below scrolls.

```
┌──────────────────────────────────────────────────────────┐
│  [‹]   Financial Plans                              [ + ] │  ← BackButton · h3 · add
├──────────────────────────────────────────────────────────┤  (scroll starts)
│ ┌──────────────────────────────────────────────────────┐ │
│ │  MONTHLY COMMITMENT                        ◐ shared   │ │  glassFloating hero
│ │  $1,450.00 /mo                                        │ │  ← h2, colors.text
│ │                                                       │ │
│ │  ● Savings $900   ● Debt $400   ● Combined $150       │ │  ← plan-mix legend (solid dots)
│ │  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁    │ │  ← proportion bar (segmented)
│ │                                                       │ │
│ │  3 active   ·   1 draft (ghosted)   ·   1 completed   │ │  ← status counts, caption
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│  YOUR PLANS                                                │  ← group label (caption/muted)
│ ┌──────────────────────────────────────────────────────┐ │
│ │ [◆savings] Emergency Fund 2027      ✓ Active         │ │  PlanListRow — solid
│ │            Savings · ends Dec 2027                    │ │
│ │            ────────────────────────────────────────  │ │
│ │            Monthly $900.00        2 of 4 milestones ▸ │ │
│ └──────────────────────────────────────────────────────┘ │
│ ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐ │
│ ╎ [◇debt]   Payoff Sprint            ◷ Draft          ╎ │  PlanListRow — DRAFT ghosted
│ ╎            Debt Payoff · awaiting partner            ╎ │  (dashed border, ~ amount)
│ ╎            ────────────────────────────────────────  ╎ │
│ ╎            Monthly ~$400.00       needs approval  ▸  ╎ │
│ └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘ │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ [◈combined] House + Debt Blend      ⏸ Paused         │ │  PlanListRow — solid, warning
│ │            Combined · ends Aug 2028                   │ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
   (FAB-free; the header `+` is the single create affordance — unchanged)
```

**Why the hero leads with money:** the old summary put "Active Plans: 3" first (a count)
and the money second. The sibling screens all lead with the number that matters. For a
couples planning tool, "how much are we committing per month, and to what" is the headline,
so total monthly commitment gets `typography.h2`, and the plan-mix legend + proportion bar
answer "to what" at a glance without opening any plan.

---

## 4. Section & component specs — LIST VIEW

### 4.1 Header row (`plans-header`)
- Fixed row **outside** the `ScrollView` (so it doesn't scroll away), matching
  `dashboard.tsx` / `bills.tsx`.
- Left: shared `<BackButton fallback="/(tabs)/goals" />` (preserves current fallback).
- Center: `Financial Plans`, `typography.h3`, `colors.text`, `numberOfLines={1}`.
- Right: `add-circle` `Ionicons`, `colors.accent`, 28px, in a ≥44×44 touch target with
  `hitSlop`. `accessibilityLabel="Create plan"`. Opens the create sheet (unchanged).
- Optional trailing `ActivityIndicator` (`colors.primary2`, small) during background
  refresh, mirroring dashboard.
- Layout: `paddingHorizontal: spacing.lg`, `paddingTop: spacing.sm`,
  `paddingBottom: spacing.md`.

### 4.2 Summary hero (`plans-summary-hero`) — see `plans-summary-hero.json`
- `glassEffects.glassFloating`, `radius.xl`, `padding: spacing.xl`. The **only** floating
  card on the list view (matches the "one hero floats" rule from
  `StatusHeadlineCard`/bills hero).
- **Row 1** — group label `MONTHLY COMMITMENT` (`typography.caption`, uppercase,
  `letterSpacing 0.6`, `colors.textMuted`); optional right-aligned partner glyphs
  (`◑`/`◐`) if the household has 2 members, else omitted.
- **Row 2** — hero total: sum of **active** plans' `monthly_contribution`, formatted
  `$1,450.00 /mo`, `typography.h2`, `colors.text`. (Matches current `totalContributions`
  math — active only.)
- **Row 3** — plan-mix legend: one solid dot + label + amount per plan type that has an
  active plan, dot colored by type token (`success`/`error`/`primary2`). `typography.caption`.
- **Row 4** — **proportion bar**: a single 6px-tall segmented bar (`radius.full`,
  track `colors.glassMedium`) whose segments are the type totals as % of the whole,
  filled with the matching type color. Reuses the calendar/allocation progress-bar idiom.
  Skip if only one type is present (show a single solid fill).
- **Row 5** — status counts: `N active · N draft · N completed`, `typography.caption`,
  `colors.textMuted`. The **draft** count word is rendered in `colors.warning` to echo the
  ghosted motif (but the word "draft" carries the meaning, not the color alone).
- States: `loading` → skeleton (see §6); `empty` → hero is **not** rendered (the empty
  state replaces the whole body, see §6).

### 4.3 Plan list row (`PlanListRow`) — see `plans-list-row.json`
Replaces the current `card` block (lines 897–923). One row per plan.

- Container: `glassEffects.glass`, `radius.lg`, `padding: spacing.lg`,
  `marginBottom: spacing.md`. Tappable (`activeOpacity 0.7`) → `loadPlanDetail(p.id)`
  (unchanged). Min height ≥ 44 (comfortably met).
- **Committed vs tentative treatment** (the core sibling metaphor):
  - **Active / Paused / Completed** plans → **solid** glass, full-opacity text,
    exact `$` amount.
  - **Draft** plans → **dashed 1px border** (`borderStyle: 'dashed'`,
    `colors.borderGlass`), contribution rendered at ~70% opacity with a `~` prefix
    (`~$400.00`) to signal "not yet committed," and status word `DRAFT`.
- **Header line**: a **type chip** (leading icon + short label, see chip spec below) on
  the left; a **status chip** (icon + word + color) on the right.
- **Title**: plan `name`, `typography.bodyBold`, `colors.text`, `numberOfLines={1}`.
- **Subtitle**: `{Type} · {ends {projected_end_date}}` OR, for draft awaiting approval,
  `{Type} · awaiting partner`. `typography.caption`, `colors.textMuted`.
- **Divider**: `colors.borderLight`, `marginVertical: spacing.md`.
- **Footer line** (two columns):
  - Left: `Monthly` label (`caption`/muted) + amount (`smallBold`; `colors.text` solid,
    or ~70% + `~` for draft).
  - Right: contextual progress hint — `{reached} of {total} milestones` when milestones
    exist, else `needs approval` (draft) / blank. Trailing `chevron-forward` (`textDark`).
- **Overflow**: long `name` → ellipsis; amount is `flexShrink: 0` and never truncates.

**Type chip** (`plans-type-chip`): pill, semantic 12%-tint background + semantic-color
text, leading `Ionicons`:
| type | token | icon | label |
|---|---|---|---|
| `savings` | `colors.success` | `trending-up` | Savings |
| `debt_payoff` | `colors.error` | `card-outline` | Debt Payoff |
| `combined` | `colors.primary2` | `git-merge-outline` | Combined |

**Status chip** (`plans-status-chip`): pill, semantic 12%-tint background + semantic-color
text + **leading icon** (this is what makes status non-color-only):
| status | token | icon | word |
|---|---|---|---|
| `active` | `colors.success` | `checkmark-circle` | Active |
| `draft` | `colors.textMuted` | `time-outline` | Draft |
| `paused` | `colors.warning` | `pause-circle` | Paused |
| `completed` | `colors.info` | `ribbon-outline` | Completed |

---

## 5. Redesigned layout — DETAIL VIEW

Same tokenized glass rhythm; sections re-ordered into a clear hierarchy. Header is a fixed
row; body scrolls; the action bar sits at the end of the scroll (as today) with generous
bottom padding.

```
┌──────────────────────────────────────────────────────────┐
│  [‹]   Emergency Fund 2027                     [✎]  ✓Active│  ← BackButton · name · edit · status
├──────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────┐ │
│ │  MONTHLY CONTRIBUTION                    [◆ Savings]  │ │  glassFloating overview hero
│ │  $900.00 /mo                                          │ │  ← h2
│ │                                                       │ │
│ │  Start  Jul 1, 2026        Projected end  Dec 1, 2027 │ │  ← two-col meta, smallBold
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ✦ AI ANALYSIS                                             │  ← group label (accent sparkle)
│ ┌──────────────────────────────────────────────────────┐ │
│ │  Key: value rows, or prose paragraph                 │ │  glass card (only if present)
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│  MILESTONES                              2 of 4 reached    │  ← group label + completion
│ ┌──────────────────────────────────────────────────────┐ │
│ │  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │ │  ← completion track (50%)
│ │  ✓  Build $5,000 cushion         $5,000   ✓ Reached  │ │  MilestoneRow — reached
│ │  ○  Hit $10,000            $10,000 · Mar 2027  Pending│ │  MilestoneRow — pending (tap ○)
│ │  ✕  Old target                            Skipped     │ │  MilestoneRow — skipped
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ALLOCATIONS                                               │
│ ┌──────────────────────────────────────────────────────┐ │
│ │  High-yield savings                     $600.00/mo   │ │  AllocationRow
│ │  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁     │ │  ← primaryGradient fill
│ │  Roth IRA                               $300.00/mo   │ │
│ │  ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁                              │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│  PARTNER APPROVALS                                         │  ← (only if approvals exist)
│ ┌──────────────────────────────────────────────────────┐ │
│ │  (◐) Jordan            ✓ Approved · Jun 20            │ │  ApprovalRow
│ │  (◷) Alex              ◷ Awaiting review              │ │  ApprovalRow — pending
│ │  ┌────────────────────┐ ┌────────────────────┐       │ │
│ │  │  ✓  Approve (green) │ │  ✕  Reject (outline)│      │ │  ← only if draft + pending
│ │  └────────────────────┘ └────────────────────┘       │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌──────────────────────────────────────────────────────┐ │
│ │  ✓  Activate Plan  (green gradient)                  │ │  primary action (draft)
│ └──────────────────────────────────────────────────────┘ │
│  ⏸ Pause Plan (outline warning)   🗑 Delete (outline red) │  secondary/destructive
└──────────────────────────────────────────────────────────┘
```

### 5.1 Detail header (`plans-detail-header`)
- Fixed row outside scroll. Left: shared `<BackButton onPress={() => setSelectedPlan(null)} />`
  (custom handler returns to list without navigating — matches current behavior, but via
  the shared component so styling/hitSlop/a11y are consistent).
- Center: plan `name`, `typography.h3`, `numberOfLines={1}`, `flex: 1`.
- Right: `create-outline` edit icon (`colors.accent`, ≥44 target, `accessibilityLabel="Edit plan"`)
  → opens edit-plan sheet; then the **status chip** (`plans-status-chip`, §4.3).

### 5.2 Overview hero (`plans-overview-hero`)
- `glassEffects.glassFloating`, `radius.xl`, `padding: spacing.xl` (the one floating card
  in detail).
- Group label `MONTHLY CONTRIBUTION` + right-aligned type chip.
- Hero value: `$900.00 /mo`, `typography.h2`.
- Two-column meta grid (reuse current `detailGrid` structure, tokenized): `Start` and
  `Projected end`, each label `caption`/muted + value `smallBold`/`colors.text`, via
  `formatDate`. Drop the redundant "Monthly Contribution" and "Plan Type" grid cells —
  they're now the hero value + chip.

### 5.3 AI Analysis (`plans-ai-card`)
- Rendered **only** when `plan.ai_analysis` is present (unchanged conditional).
- Group label `AI ANALYSIS` with a leading `sparkles` icon in `colors.accent` (label
  outside the card, matching the new section rhythm).
- `glassEffects.glass` card. Keeps both render modes from `renderAiAnalysis`:
  - **string** → paragraph, `typography.body`, `colors.textMuted`, comfortable line height.
  - **object** → key/value rows: key `typography.smallBold` `colors.accent`, value
    `typography.small` `colors.textMuted`. (Same behavior as today, retokenized.)

### 5.4 Milestones (`MilestoneRow` + completion track) — see `plans-milestone-row.json`
- Group label `MILESTONES` on the left; **completion summary** `{reached} of {total} reached`
  on the right (`typography.caption`, `colors.textMuted`). Derived from
  `milestones.filter(m => m.status === 'reached').length`.
- **Completion track**: a 6px `radius.full` bar (track `colors.glassMedium`) filled
  `reached/total` with `gradients.primaryGradient`. Reuses the allocation-bar idiom. Omit
  if `total === 0`.
- Empty: `No milestones set for this plan.` centered, `typography.small`, `colors.textMuted`
  (retokenized `emptySubtext`).
- **MilestoneRow** (preserves both interactions):
  - Whole row tappable → `openEditMilestone(m)` (edit sheet). `activeOpacity 0.7`.
  - Leading **status toggle** (`hitSlop` ≥8, its own ≥44 tap zone) → cycles reached↔pending
    (`handleMilestoneStatus`). Icon + color by state:
    | status | icon | token |
    |---|---|---|
    | `reached` | `checkmark-circle` | `colors.success` |
    | `pending` | `ellipse-outline` | `colors.textMuted` |
    | `skipped` | `close-circle` | `colors.error` |
  - Title `typography.smallBold` `colors.text` (`numberOfLines={1}`); optional
    `target_amount` (`caption`/muted, `fmt`) and `target_date` (`caption`/muted,
    `Target: {formatDate}`).
  - Trailing **status word chip** (icon-less is acceptable here since the leading icon
    already encodes state, but include the **word** — `Reached`/`Pending`/`Skipped` — in
    the state color at 12% tint). `numberOfLines={1}`.
  - Divider between rows: `colors.borderLight`.

### 5.5 Allocations (`AllocationRow`)
- Group label `ALLOCATIONS`. `glassEffects.glass` card.
- Empty: `No allocations configured.` (retokenized `emptySubtext`).
- Per row (retokenize current markup): label = `target_name || target_type` (capitalized),
  `typography.smallBold` `colors.text`; amount `{fmt}/mo`, `typography.smallBold`
  `colors.accent`; progress bar height 6, track `colors.glassMedium`, `radius.full`, fill
  `gradients.primaryGradient` at `width = monthly_amount / maxAllocation`. `marginBottom:
  spacing.md`.

### 5.6 Partner approvals (`ApprovalRow`) — see `plans-approval-row.json`
- Rendered only when `plan.approvals?.length > 0` (unchanged).
- Group label `PARTNER APPROVALS` with leading `people` icon (`colors.accent`).
  `glassEffects.glass` card.
- Per approval row (retokenize current inline markup):
  - Leading 36px circle, semantic 12%-tint bg + semantic icon:
    | status | icon | token |
    |---|---|---|
    | `approved` | `checkmark-circle` | `colors.success` |
    | `rejected` | `close-circle` | `colors.error` |
    | `pending` | `time-outline` | `colors.textMuted` |
  - Name `typography.smallBold` `colors.text`; sub-line `{word}{· date?}`,
    `typography.caption` `colors.textMuted` — the **word** ("Approved"/"Rejected"/"Awaiting
    review") makes status non-color-only.
  - Optional feedback quote in a `rgba(239,68,68,0.08)` box, `radius.sm`,
    `typography.small` `colors.error`.
  - Row separator `colors.borderLight`.
- **Approve / Reject buttons** (only when `plan.status === 'draft'` and some approval is
  `pending` — unchanged condition):
  - Approve: `gradients.successGradient`, `checkmark-circle` + `Approve`, white text,
    `radius.md`. → `handleApprove`.
  - Reject: **outline** button, `colors.error` border at 12%-tint, `close-circle` + `Reject`.
    → opens reject sheet. Reads as secondary/destructive (outline), matching the app's
    "destructive = outline red" convention (bills/delete).

### 5.7 Action bar (`plans-action-bar`)
- End-of-scroll block, `gap: spacing.md`, generous `paddingBottom` (≥ `spacing.xxxl`) so
  it clears the home indicator. Buttons rendered by `plan.status` (unchanged logic):
  - `draft` → **Activate Plan**, `gradients.successGradient`, `checkmark-circle-outline`
    + white `typography.button`, `radius.lg` — the single primary action.
  - `active` → **Pause Plan**, outline (`colors.warning` border 12%-tint), `pause-circle-outline`.
  - `paused` → **Resume Plan**, outline (`colors.success`), `play-circle-outline`.
  - Always → **Delete Plan**, outline (`colors.error` border 12%-tint), `trash-outline`
    → `handleDelete` (native `Alert` confirm, unchanged).
- Outline button recipe (`plans-action-outline`): `flexDirection row`, centered,
  `gap: spacing.sm`, `paddingVertical: spacing.md`, `radius.lg`, `borderWidth 1`,
  `backgroundColor: colors.glassLight`, `borderColor` = semantic-at-30% or `colors.borderGlass`,
  label `typography.smallBold` in the semantic color.

---

## 6. States

| State | Treatment |
|---|---|
| **Default / populated** | As wireframed (§3, §5). |
| **List loading** | **Skeleton**, not spinner. Reuse `components/Skeleton.tsx`: a floating-card-shaped hero skeleton (title bar + big number bar + two legend bars + proportion bar), then 3 `PlanListRow` skeletons (a 40px chip block + two text lines + a right amount bar), mirroring the dashboard skeleton recipe. Keep a small header `ActivityIndicator` (`colors.primary2`) for background refresh only. |
| **List empty** | Keep the shared `EmptyState` (already tokenized): `icon="map-outline"`, title "No financial plans", description unchanged, `actionLabel="Create Plan"` → opens create sheet. The summary hero is **not** rendered in empty state. |
| **List error** | Keep the shared `ErrorState` inline (glass card with retry), rendered in place of the list body. Don't blank the whole screen. Preserve current retry wiring (`setError(null); setLoading(true); loadPlans()`). |
| **Detail loading** | Skeleton, not spinner: overview-hero skeleton (label + big number + two meta bars) + one section-card skeleton (label bar + 3 rows). |
| **Detail — no milestones / no allocations** | Section renders with its group label + the tokenized `emptySubtext` copy (unchanged copy). |
| **Draft plan (tentative)** | List row: dashed border + `~` amount + `DRAFT` chip (§4.3). Detail: overview + approvals surfaced; primary action is **Activate**. |
| **Overflow — long plan/milestone/allocation names** | `numberOfLines={1}` + ellipsis; amounts `flexShrink: 0`, never truncate. |
| **Overflow — many plans / milestones** | List and detail scroll normally; no cap. Milestone completion summary keeps the "how far along" answer visible without scrolling the whole list. |
| **Disabled (in-flight actions)** | While `actionLoading`/`creating`, action buttons set `disabled` and show an inline `ActivityIndicator` in place of the label (as today), plus `opacity 0.6` on the button — a visible disabled cue, not color-only. |
| **Create / edit / reject sheets** | See §7. Loading: gradient save button swaps label → `ActivityIndicator`. |

---

## 7. Modal sheets (create / edit-plan / edit-milestone / reject)

All four collapse onto **one shared form-sheet recipe** so they stop re-declaring styling:

- Presentation: bottom sheet, backdrop `rgba(0,0,0,0.6)`, sheet `colors.surface2`,
  `borderTopLeftRadius/RightRadius: radius.xl`, `padding: spacing.xl`, `maxHeight: '85%'`,
  scrollable content, `animationType="slide"`.
- **Sheet header**: title `typography.h3` `colors.text` + a `close` icon (`colors.textMuted`,
  ≥44 target) where present (create sheet has one today; add one to edit/reject for
  consistency, or keep Cancel button — either is fine, but be consistent).
- **Field label**: `typography.smallBold` `colors.text`, `marginBottom: spacing.xs`,
  `marginTop: spacing.md`.
- **Text input** (`plans-form-input`): `glassEffects.glass` fill, `colors.borderGlass`
  border, `radius.md`, `paddingHorizontal: spacing.md`, `paddingVertical: spacing.md`,
  `typography.body`, `color: colors.text`, `placeholderTextColor: colors.textDark`.
  Multiline (reject feedback) adds `minHeight: 80`, `textAlignVertical: 'top'`.
- **Type picker** (create): three segmented buttons; inactive = `glassEffects.glass` +
  `colors.borderGlass`; active = semantic 12%-tint bg + semantic-color border + semantic
  text, `fontWeight 700`. (Retokenized `typeRow`/`typeBtn`.)
- **Primary sheet button**: full-width, `radius.lg`, `gradients.primaryGradient`
  (or `gradients.errorGradient` for the reject sheet), `paddingVertical: spacing.md`,
  white `typography.button`. Swaps to `ActivityIndicator` while submitting.
- **Cancel button**: outline, `colors.borderGlass`, `typography.smallBold` `colors.textMuted`.
- Keyboard: sheets should avoid the keyboard (`KeyboardAvoidingView` on iOS) — noted for
  the numeric contribution/amount and multiline feedback fields.

---

## 8. Accessibility

- **Touch targets:** every icon-only control (header `+`, edit pencil, back, milestone
  status toggle, sheet close) sits in a ≥44×44 zone with `hitSlop`. `PlanListRow`,
  `MilestoneRow`, and sheet buttons all clear 44 height.
- **Color independence:** plan status, milestone status, and approval status are each
  encoded by **icon + word + color together** (§4.3, §5.4, §5.6) — never color alone.
  Draft-vs-committed is additionally encoded by **fill style** (solid vs dashed border)
  and a `~` amount prefix, so it survives color-blindness and grayscale.
- **Contrast:** all text on dark glass uses `colors.text` / `colors.textMuted`. The
  ~70%-opacity draft amount must still clear 4.5:1 — verify `colors.text` at 0.7 over
  `colors.glassLight`; if it fails, use `colors.textMuted` at full opacity instead of
  dimming `colors.text` (same guard as `calendar-redesign.md` §8).
- **Screen-reader order & labels:**
  - `PlanListRow`: `accessibilityRole="button"`, label
    `"{name}, {type}, {status}, monthly {amount}{, N of M milestones}."` (draft appends
    "draft, awaiting approval").
  - `MilestoneRow`: the leading toggle is its own button —
    `"Mark {title} {reached|not reached}"`; the row is
    `"{title}, {status}{, target {amount}}{, target date {date}}. Double tap to edit."`
  - `ApprovalRow`: `"{name}, {approved|rejected|awaiting review}{, {date}}."`
  - Summary hero: `"Monthly commitment {total}. {N} active, {N} draft, {N} completed."`
- **Reduced motion:** status-toggle and press transitions use `animation.fast`; under
  reduce-motion, swap scale/opacity transitions for instant state change. The `Skeleton`
  pulse is already subtle; honor the OS reduce-motion setting if surfaced.

---

## 9. Developer notes

- **Preserve all data flow and handlers verbatim** — `loadPlans`, `loadPlanDetail`,
  `handleCreate`, `handleStatusChange`, `handleDelete`, `handleApprove`, `handleReject`,
  `handleEditPlan`, `handleEditMilestone`, `handleMilestoneStatus`, and the create/edit
  form state. This is a styling + IA pass, not a logic change.
- **Single source for status/type visuals:** replace the four scattered config maps
  (`PLAN_TYPE_CONFIG`, `STATUS_CONFIG`, `MILESTONE_ICONS`, the inline approval ternaries)
  with **one** tokenized module of `{ token, icon, word }` per state, imported by the list
  row, detail header, milestone row, and approval row. This is the regression guard against
  "four copies of the status color drift."
- **Derived helpers to add (pure, from data already present):**
  - `isDraft(p) = p.status === 'draft'` → drives dashed-border + `~` amount + ghosted text.
  - `activeTotal = plans.filter(p => p.status === 'active').reduce(...monthly_contribution)`
    (matches current `totalContributions`).
  - `typeTotals = groupBy(active plans, plan_type)` → hero legend + proportion bar.
  - `milestoneProgress(plan) = reached / total` → completion track + row footer hint.
- **Reuse, don't re-implement:** `GradientBackground` (variant `bgDarkPurple`),
  `Skeleton` / `SkeletonStack`, `BackButton`, `EmptyState`, `ErrorState`. The allocation +
  completion + proportion bars are all the same 6px `radius.full` track + gradient-fill
  idiom already used in allocations/`ThisWeekProof`; factor one `<ProgressBar>` if
  convenient, but it's optional.
- **Sparkline** is available but there's no time-series on this screen; skip it unless a
  future contribution-history endpoint appears.
- The 12%/8% semantic tints and the `~` estimate prefix + `DRAFT` word are intentional and
  match the sibling specs; keep them.

---

## 10. Handoff checklist

- [x] All states designed (default, list loading/empty/error, detail loading, draft, disabled, overflow)
- [x] Committed-vs-tentative (active vs draft) visual treatment defined (solid vs dashed + `~` + word)
- [x] Summary hero promoted to `glassFloating`, leads with money + plan-mix + status counts
- [x] Detail IA re-tiered (overview hero → AI → milestones w/ completion track → allocations → approvals → actions)
- [x] Status is icon + word + color everywhere (list, milestone, approval) — never color-only
- [x] Every old hardcoded value mapped to a design-system token (§2)
- [x] Four modals collapsed onto one shared form-sheet recipe on `colors.surface2`
- [x] Shared components reused (`GradientBackground`, `Skeleton`, `BackButton`, `EmptyState`, `ErrorState`)
- [x] Accessibility: 44pt targets, color-independent status, SR labels, reduced motion
- [x] Component specs written (`docs/design/components/plans-*.json`)
```
