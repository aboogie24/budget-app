# Framework (CoupleFlow Method) Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** ad-hoc styling in `budget-app/app/framework.tsx`
**Archetype:** summary / analytics (progress + milestones) — sibling to `dashboard.tsx` (the Trajectory strip deep-links here). Header, cards, states, and partner attribution follow the same conventions as the calendar and dashboard redesigns.

---

## 1. Why this redesign exists

The framework screen is where a couple sees *how far up the CoupleFlow ladder they've
climbed* — their current level, the criteria that unlock the next one, what to do next, and
the milestones on their active plans. It's a good screen conceptually, but visually it is a
**different app** from the calendar and dashboard we already brought onto the design system.

Two problems, fixed together:

**Problem 1 — it fights the design system.** Like the old calendar and dashboard, this
screen hardcodes everything:

- Its own background gradient `['#0b1021', '#2b0f50', '#1b1039']` — a *third* purple that
  matches neither `gradients.bgDarkPurple` nor `bgDark`.
- Its own card surface (`rgba(255,255,255,0.05)` + `borderRadius: 16` + `rgba(255,255,255,0.1)`
  border) re-declared inline instead of `glassEffects.glass` / `commonStyles.card`.
- Its own color constants (`LEVEL_COLORS`, `PLAN_TYPE_CONFIG` with raw `#ef4444`, `#22c55e`,
  `#a855f7`, `rgba(...)` fills), its own text colors (`#fff`, `#94a3b8`, `#475569`, `#e5e7eb`,
  `#cbd5e1`), its own font sizes/weights everywhere.
- A raw `LinearGradient` for both the background **and** the "Ask AI" button instead of
  `GradientBackground` + `gradients.primaryGradient`.

**Problem 2 — no proper loading, empty, or error state parity.** The screen has:

- A **full-screen spinner** on load (the calendar/dashboard redesigns replaced this with a
  **layout-matched skeleton**).
- An **inline empty state** only for plans (a small map icon) — but **no empty state for the
  hero itself** (a brand-new couple with no framework level yet), and the empty-plans card
  re-hardcodes its own styling.
- An error state that *is* already using `ErrorState` + `BackButton` (good) but under the
  wrong hardcoded gradient and header styles.

This redesign is a **re-layout of existing data** onto the design system — same screen, same
functionality (level ring, journey stepper, criteria checklist, next steps, active plans with
tappable milestones, pull-to-refresh, "Ask AI for Help", "Create a Plan"), but tokenized and
brought to the same quality bar as its siblings.

### What we deliberately keep (this is recognizably the same screen)

- The **level progress ring** hero (it's the screen's signature — the one thing that earns
  elevation, like the dashboard headline).
- The **5-step journey stepper** (Foundation → Attack Debt → Build Security → Grow Wealth →
  Dream Big).
- The **criteria checklist** with met/unmet rows and an overall progress bar.
- The **"What to Do Next"** guidance list + the **Ask AI for Help** CTA.
- The **Active Plans** cards with per-plan milestone progress and **tappable milestones**
  (toggle reached/pending — with the optimistic in-flight spinner preserved).

### What improves (information architecture)

1. **One clear hierarchy, top to bottom** (mirrors the dashboard's tiered approach): the hero
   ring is the only elevated/floating card; everything below is flat glass and visually
   subordinate.
2. **Level colour becomes a tokenized, accessibility-safe scale** (§3) instead of five raw
   hexes — and level status is never conveyed by colour alone (number + name + ring + label).
3. **Milestone rows adopt the calendar/dashboard row grammar** (icon chip + title + subtitle +
   trailing meta), so a milestone reads like a transaction/event row the user already knows.
4. **Skeleton loading + a real hero empty state + tokenized empty-plans + inline error**, at
   parity with the sibling screens.

---

## 2. Visual hierarchy — the ring is the top, like the dashboard headline

Same rule of thumb as the dashboard redesign: **only the hero floats, only the hero owns the
biggest number.** The eye must land on "what level are we, how close to the next" first.

| Signal | Level Hero (tier 1) | Everything below |
|---|---|---|
| **Surface** | `glassEffects.glassFloating` (shadow + `radius.xl`) | `glassEffects.glass` (flat, `radius.lg`) |
| **Type scale** | level number in `typography.h1` (32) inside the ring | section values in `bodyBold` / `small` / `caption` |
| **Vertical space** | `spacing.xl` (24) gap below it before the stepper | `spacing.lg` (16) between all lower sections |
| **Colour energy** | ring stroke in the level's accent colour, filled | neutral glass; semantic colour only on values/status |

**5-tier reading order** (top → bottom):

1. **Level Hero** — the progress ring + level name + % complete. Elevated (`glassFloating`).
2. **Journey stepper** — the 5-level ladder, current level highlighted.
3. **Level criteria** — the checklist that unlocks the next level + overall bar.
4. **What to do next** — guidance bullets + "Ask AI for Help" CTA.
5. **Active plans** — per-plan milestone cards (or the empty-plans CTA).

---

## 3. The level colour scale — tokenized and accessibility-safe

The current code hardcodes `LEVEL_COLORS = {1:'#ef4444', 2:'#f97316', 3:'#eab308',
4:'#22c55e', 5:'#7c3aed'}`. Only three of those five are design-system colours; `#f97316`
(orange, level 2) and the raw hexes are off-system.

Map the five levels onto **existing semantic + brand tokens**, so the ladder reads as a
"danger → safe → aspirational" gradient the palette already supports:

| Level | Name | Token | Value | Rationale |
|---|---|---|---|---|
| 1 | Foundation | `colors.error` | `#ef4444` | just starting / most fragile |
| 2 | Attack Debt | `colors.warning` | `#eab308` | active effort, caution |
| 3 | Build Security | `colors.info` | `#3b82f6` | stabilising |
| 4 | Grow Wealth | `colors.success` | `#22c55e` | healthy, growing |
| 5 | Dream Big | `colors.primary2` | `#a855f7` | aspirational / brand peak |

Expose this as a single `LEVEL_TOKENS: Record<number, keyof colors>` map in the component
(replacing `LEVEL_COLORS`). Level identity is **never colour-only**: it's always
number + name + ring fill + "LEVEL" label together, so it passes for colour-blind users.

Plan-type badges likewise move off raw hex (`PLAN_TYPE_CONFIG`):

| Plan type | Token (text) | Badge fill |
|---|---|---|
| `debt_payoff` | `colors.error` | `` `${colors.error}26` `` (~15%) |
| `savings` | `colors.success` | `` `${colors.success}26` `` |
| `combined` | `colors.primary2` | `` `${colors.primary2}26` `` |

---

## 4. Full-screen wireframe (default / populated)

iPhone 15 Pro (390×844). `GradientBackground variant="bgDarkPurple"`, standard header with
`BackButton` (fallback `/(tabs)/goals`), scroll body with pull-to-refresh.

```
┌──────────────────────────────────────────────────────────────┐
│  ‹   CoupleFlow Method                              (spin)     │  ← header: BackButton +
│                                                                │     title + refresh spinner
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │                       ╭───────────╮                       │ │  │ TIER 1
│  │                      ╱      68%    ╲                      │ │  │ Level Hero
│  │                     │      ┌───┐    │                     │ │  │ glassFloating
│  │                     │      │ 3 │    │  ← ring stroke =    │ │  │ (the centerpiece)
│  │                     │      └───┘    │    level colour     │ │  │
│  │                      ╲    LEVEL    ╱                       │ │  │
│  │                       ╰───────────╯                       │ │  │
│  │                   Build Security                          │ │  │  h3, colors.text
│  │                   68% complete                            │ │  │  small, textMuted
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.xl gap
│  ┌──────────────────────────────────────────────────────────┐ │  ┐ TIER 2
│  │  Your Journey                                             │ │  │ Journey stepper
│  │   ●───────●───────◉───────○───────○                       │ │  │ glass
│  │   ✓       ✓       3       ○       ○                       │ │  │
│  │  Founda  Attack  Build   Grow    Dream                    │ │  │
│  │  -tion   Debt    Secur.  Wealth  Big                      │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  ┌──────────────────────────────────────────────────────────┐ │  ┐ TIER 3
│  │  Level 3 Criteria                                         │ │  │ Criteria checklist
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░  68%                                │ │  │ glass
│  │  3 of 5 criteria met                                      │ │  │
│  │  ──────────────────────────────────────────────────      │ │  │
│  │  [✓] 3-month emergency fund                               │ │  │  met: success, text
│  │      $9,000 of $9,000 saved                               │ │  │  detail: textMuted
│  │  [✓] All high-interest debt paid                          │ │  │
│  │      $0 balance above 8% APR                              │ │  │
│  │  [○] Retirement contributions on track       Not yet     │ │  │  unmet: ghosted +
│  │      Contributing 6% of 15% target                       │ │  │  "Not yet" word
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  ┌──────────────────────────────────────────────────────────┐ │  ┐ TIER 4
│  │  💡 What to Do Next                                       │ │  │ Next steps
│  │   •  Bump retirement to 10% to clear the criterion        │ │  │ glass
│  │   •  Open a high-yield savings account for the surplus    │ │  │
│  │  ┌────────────────────────────────────────────────────┐  │ │  │
│  │  │   ✦  Ask AI for Help                               │  │ │  │  primaryGradient CTA
│  │  └────────────────────────────────────────────────────┘  │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg
│  ACTIVE PLANS                                                  │  ┐ tier 5 group label
│  ┌──────────────────────────────────────────────────────────┐ │  │ TIER 5
│  │  Emergency Fund Sprint                    [ Savings ]     │ │  │ Plan card
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  2 of 3 milestones reached          │ │  │ glass
│  │  ──────────────────────────────────────────────────      │ │  │
│  │  [✓] Save first $1,000            Reached Jun 12          │ │  │  reached: strikethrough
│  │  [✓] Hit $3,000 buffer            Reached Jul 2           │ │  │
│  │  [○] Reach $9,000 full fund       Target Aug 15           │ │  │  tappable → toggle
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

Layout tokens: screen padding `spacing.lg` (16) horizontal; header sits inside the safe area
(`edges={['top','left','right']}`); the gap under the hero is `spacing.xl`, all other section
gaps `spacing.lg`; the `ACTIVE PLANS` group label is `typography.caption` uppercase in
`colors.textMuted` with `spacing.sm` below (matches the dashboard's `RECENT ACTIVITY` label).

---

## 5. TIER 1 — Level Hero (the centerpiece)

The signature of the screen: a circular progress ring whose stroke is the current level's
colour, with the level number centred and the level name + % below.

- **Card:** `glassEffects.glassFloating`, `padding: spacing.xl`, `alignItems: 'center'`.
  This is the **only** floating card (parity with the dashboard headline).
- **Ring** (keep the existing SVG `ProgressRing`, tokenized):
  - `size` 160, `strokeWidth` 12 (`≈ spacing.md`).
  - Track stroke: `colors.glassLight` (was `rgba(255,255,255,0.08)`).
  - Progress stroke: the level's token colour (§3), `strokeLinecap="round"`, sweeps
    `level.completed_pct`.
  - **% inside the ring:** the completion percent (`68%`) in `typography.small`
    `colors.textMuted`, sitting just above the number — so the ring's fill has a readable
    value (today the % lives only *below* the ring).
  - **Level number:** `typography.h1` (32/700) in the level's token colour (the single
    biggest number on the screen). "LEVEL" label under it in `typography.caption`
    `colors.textMuted`, letter-spaced.
- **Below the ring:**
  - Level name (`level.level_name` || `LEVEL_NAMES[current-1]`) in `typography.h3`
    `colors.text`, `spacing.lg` above.
  - `{pct}% complete` in `typography.small` `colors.textMuted`, `spacing.xs` above.

Accessibility label: `"Level {n}, {name}, {pct} percent complete toward the next level."`

---

## 6. TIER 2 — Journey stepper

The 5-level ladder. Keep the horizontal stepper (connector line + dots + labels), tokenized.

- **Card:** `glassEffects.glass`, `padding: spacing.lg`. Section title `Your Journey` in
  `typography.smallBold` `colors.text`.
- **Dots** (26pt visual, but the whole `stepContainer` is the ≥44pt tap target — see A11y):
  - **Completed** (`stepLevel < current`): filled with that level's token colour, white
    `checkmark` icon (18–20pt).
  - **Current** (`stepLevel === current`): filled with the level colour + a glow
    (`shadowColor` = level colour, matches existing), the level number in white
    `typography.caption` bold. Add a **1.5px `colors.primary2` ring** around the current dot
    to reinforce "you are here" beyond colour.
  - **Future** (`stepLevel > current`): transparent fill, 2px `colors.borderGlass` border, no
    glyph.
- **Connector line** between dots: `colors.glassLight` default; the segment *behind* completed/
  current dots fills with the prior level's token colour (keep existing logic, tokenized).
- **Labels:** `typography.caption`, `numberOfLines={2}`, centred. Current →
  `colors.text` bold; past → `colors.textMuted`; future → `colors.textDark`.

Because "completed/current/future" is encoded by **fill + glyph (checkmark vs number vs
empty) + label weight**, not colour alone, it is colour-blind safe.

Optional tap affordance: tapping a **completed or current** step could scroll/anchor to that
level's criteria in future; for v1 the stepper is display-only (note in dev notes).

---

## 7. TIER 3 — Level criteria checklist

The list of requirements that unlock the next level, with an overall bar.

- **Card:** `glassEffects.glass`. Title `Level {n} Criteria` in `typography.smallBold`.
- **Overall progress bar** (reuse the shared bar pattern — see FrameworkProgressBar spec):
  height `spacing.sm/1.33 ≈ 6`, track `colors.glassLight`, fill the **level's token colour**,
  `radius.full`. Under it: `{met} of {total} criteria met` in `typography.caption`
  `colors.textMuted`, `spacing.md` below.
- **Divider:** `commonStyles.divider` between the bar and the first criterion.
- **Criterion row** (`FrameworkCriterionRow`, §12):
  - Leading **icon chip** (32pt, `radius.full`):
    - **Met:** `` `${colors.success}26` `` fill, `checkmark-circle` `colors.success`.
    - **Unmet:** `colors.glassLight` fill, `ellipse-outline` `colors.textDark`.
  - Title `typography.smallBold`: met → `colors.text`; unmet → `colors.textMuted`.
  - Detail (`criterion.detail`) `typography.caption` `colors.textMuted` below.
  - **Trailing status word** so state isn't colour-only: met rows show nothing extra (the
    filled check + full-opacity text is enough); **unmet rows show a small `Not yet` label**
    in `typography.caption` `colors.textMuted`, right-aligned. This is the color-independence
    guarantee for the checklist.
  - Row separator: 1px `colors.borderLight` bottom border, `spacing.sm` vertical padding.

---

## 8. TIER 4 — What to do next

Only rendered when `next_steps.length > 0`.

- **Card:** `glassEffects.glass`. Header row: `bulb-outline` icon in `colors.warning` +
  `What to Do Next` title in `typography.smallBold` `colors.text`, `gap: spacing.sm`.
- **Bullets:** each row is a 6pt `colors.primary2` dot (`bulletDot`) + the step text in
  `typography.small` `colors.textMuted`, `lineHeight` from `typography.small`,
  `spacing.xs` vertical padding.
- **Ask AI for Help CTA** (`spacing.lg` above): a `LinearGradient` button using
  `gradients.primaryGradient` (`[colors.primary, colors.primary2]`), `radius.md`,
  `paddingVertical: spacing.md`, centred `sparkles` icon (`colors.text`) + `Ask AI for Help`
  in `typography.button` `colors.text`. Tap → `router.push('/(tabs)/ai')`. ≥44pt tall,
  `activeOpacity 0.7`. Press feedback uses `animation.fast` scale (instant under
  reduce-motion).

---

## 9. TIER 5 — Active plans + milestones

`ACTIVE PLANS` group label (`typography.caption` uppercase `colors.textMuted`), then one
`glass` card per active plan.

**Plan card** (`FrameworkPlanCard`, §12):
- **Header row:** plan name in `typography.bodyBold` `colors.text` (left, `flex: 1`,
  `numberOfLines={1}`) + a **type badge** (right): `radius.sm`, fill = plan-type token at
  ~15%, label = plan-type token colour in `typography.caption` bold (§3).
- **Milestone progress:** a bar (fill `colors.success`, track `colors.glassLight`,
  `radius.full`) + `{reached} of {total} milestones reached` in `typography.caption`
  `colors.textMuted`.
- **Divider** (`commonStyles.divider`) before the milestone list.
- **Milestone row** (`FrameworkMilestoneRow`, §12) — tappable, toggles reached/pending:
  - Leading control: `checkmark-circle` (`colors.success`) when reached, `ellipse-outline`
    (`colors.textDark`) when pending, **22pt**. While an update is in flight (`togglingMilestone
    === ms.id`), swap for a small `ActivityIndicator` `colors.primary2` in the same 24pt slot
    (keep the existing optimistic pattern).
  - Title `typography.smallBold`; when reached → `colors.textMuted` +
    `textDecorationLine: 'line-through'`.
  - Subtitle `typography.caption` `colors.textMuted`:
    - reached → `Reached {reached_at | short date}` (add this — today only pending shows a
      date; reached milestones should show *when*).
    - pending → `Target {target_date | short date}` (omit if no `target_date`).
  - Optional trailing **partner glyph** (see §10) if the milestone/plan is attributable.
  - Row: top border 1px `colors.borderLight`, `spacing.md` vertical padding, ≥44pt tall.

**Toggle behaviour preserved:** `PUT /auth/plans/{planId}/milestones/{id}` with the flipped
status, optimistic in-flight spinner, `Alert` on failure, reload on success.

---

## 10. Couples attribution — partner glyph (additive, graceful-degrade)

Same rule as the calendar and dashboard redesigns, for cross-screen consistency. If a
milestone (or the plan) carries an owner (`user_id` matched against `householdMembers`), show
a lightweight 14px glyph in the milestone subtitle:

- Partner A (current user) → `◑` tinted `colors.primary2`.
- Partner B → `◐` tinted `colors.info`.
- Household / shared / unknown owner → **no glyph** (most plans are joint, so they stay
  neutral).
- If owner data isn't available from the API, omit silently — nothing else changes. This is
  why it's additive, not structural.

Do **not** re-colour the milestone title or amount by owner; attribution is a secondary glyph
only (identical constraint to the sibling specs).

---

## 11. States

| State | Treatment |
|---|---|
| **Default / populated** | As wireframed. |
| **Loading** | **Skeleton, not the full-screen spinner.** Reuse `components/Skeleton.tsx`, layout-matched: a `glassFloating` hero block (a 160pt circle skeleton + two centred text-line skeletons), then a stepper skeleton (5 small circles + connector), a criteria-card skeleton (a bar skeleton + 3 rows of `chip + 2 lines`), and one plan-card skeleton (title line + bar + 2 milestone rows). Header (BackButton + title) renders immediately. A small `ActivityIndicator` (`colors.primary2`) sits in the header for **background refresh** only (see wireframe §4 top-right). |
| **Empty — hero (brand-new couple, no framework level)** | If `level` is null/unavailable: the hero card still renders in an **onboarding voice** — a `compass-outline` icon (`colors.textDark`) in place of the ring, "Your journey hasn't started yet" in `typography.h3` `colors.text`, subcopy "Add your income, debts, and savings to see your CoupleFlow level" in `typography.small` `colors.textMuted`, and a primary CTA button (`gradients.primaryGradient`) "Get started" → the setup/dashboard. Lower tiers collapse (no stepper/criteria for a level that doesn't exist yet). |
| **Empty — no active plans** | Keep the plans empty card but **tokenized**: `glass` card, `map-outline` (`colors.textDark`), "No active plans yet" in `typography.small` `colors.textMuted`, and a `gradients.primaryGradient` "Create a Plan" CTA → `/plans`. (Replaces the current hardcoded version.) |
| **Empty — no next steps** | Section simply isn't rendered (existing behaviour, keep). |
| **Empty — no criteria** | Criteria card shows "No criteria for this level" in `typography.caption` `colors.textMuted` instead of an empty list. |
| **Error** | Keep the existing `ErrorState` + `BackButton` pattern, but under `GradientBackground variant="bgDarkPurple"` and the tokenized header. Title "Something went wrong", the API message, `Retry` → `loadData()`. (Currently correct in structure; just re-parent onto tokens.) |
| **Overflow — long plan/milestone names** | `numberOfLines={1}` + ellipsis on plan name and milestone title; the type badge and status control are `flexShrink: 0`. |
| **Overflow — many milestones** | The plan card grows; the whole screen scrolls (no inner scroll). |
| **Overflow — long level name / step label** | Level name `numberOfLines={1}`; step labels `numberOfLines={2}` (existing). |

---

## 12. Component inventory

| Component | Type | Reuse or new | Variants | States |
|---|---|---|---|---|
| `GradientBackground` | shared | reuse (`variant="bgDarkPurple"`) | — | — |
| `BackButton` | shared | reuse (`fallback="/(tabs)/goals"`, `color={colors.text}`) | — | default |
| `Skeleton` | shared | reuse (loading) | — | — |
| `ErrorState` | shared | reuse (error) | — | — |
| `Sparkline` | shared | reuse — **optional**, only if a per-plan or net-worth trend is added later; not required for v1 | — | — |
| `FrameworkLevelHero` | new | new | — | default, empty, loading |
| `ProgressRing` | local (keep) | tokenize | — | — |
| `FrameworkJourneyStepper` | new | new | — | default, loading |
| `FrameworkCriterionRow` | new | new | — | met, unmet |
| `FrameworkProgressBar` | new | new (shared bar used by hero-adjacent + criteria + plans) | level, success | default |
| `FrameworkPlanCard` | new | new | debt_payoff, savings, combined | default, empty-milestones |
| `FrameworkMilestoneRow` | new | new | — | reached, pending, toggling, disabled |

New component specs are written under `docs/design/components/framework-*.json`.

---

## 13. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value | Replace with token |
|---|---|
| `['#0b1021','#2b0f50','#1b1039']` background gradient | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `LEVEL_COLORS[1] '#ef4444'` | `colors.error` |
| `LEVEL_COLORS[2] '#f97316'` | `colors.warning` (`#eab308`) — off-system orange dropped |
| `LEVEL_COLORS[3] '#eab308'` | `colors.warning` → **remapped to** `colors.info` (see §3 scale) |
| `LEVEL_COLORS[4] '#22c55e'` | `colors.success` |
| `LEVEL_COLORS[5] '#7c3aed'` | `colors.primary` → **remapped to** `colors.primary2` (§3) |
| default `levelColor '#7c3aed'` | `colors.primary` |
| `PLAN_TYPE_CONFIG debt_payoff color '#ef4444'` / `bg 'rgba(239,68,68,0.15)'` | `colors.error` / `` `${colors.error}26` `` |
| `PLAN_TYPE_CONFIG savings color '#22c55e'` / `bg 'rgba(34,197,94,0.15)'` | `colors.success` / `` `${colors.success}26` `` |
| `PLAN_TYPE_CONFIG combined color '#a855f7'` / `bg 'rgba(168,85,247,0.15)'` | `colors.primary2` / `` `${colors.primary2}26` `` |
| loading `ActivityIndicator color '#c084fc'` | `colors.primary2` |
| `RefreshControl tintColor '#c084fc'` | `colors.primary2` |
| header title `'#fff'` / `fontSize 17 / '700'` | `colors.text` / `typography.bodyBold` |
| `BackButton color="#fff"` | `colors.text` |
| card `rgba(255,255,255,0.05)` + `borderColor 'rgba(255,255,255,0.1)'` + `borderRadius 16` | `glassEffects.glass` / `commonStyles.card` |
| hero card | `glassEffects.glassFloating` (only it floats) |
| `sectionTitle '#e5e7eb'` / `fontSize 15 / '700'` | `colors.text` / `typography.smallBold` |
| ring track `stroke 'rgba(255,255,255,0.08)'` | `colors.glassLight` |
| ring number `'#fff'`… wait — level colour / `fontSize 42 / '800'` | level token colour / `typography.h1` |
| `'LEVEL'` label `'#94a3b8' / 11 / '600'` | `colors.textMuted` / `typography.caption` |
| level name `'#fff' / 22 / '700'` | `colors.text` / `typography.h3` |
| `% complete` / journey / criteria `'#94a3b8'` text | `colors.textMuted` |
| `criterionDetail '#475569'` / `milestoneDate '#475569'` | `colors.textMuted` (was `textDark` — bump for contrast, see §14) |
| unmet icon `'#475569'` / `stepLabel future '#475569'` | `colors.textDark` |
| criterion met icon bg `'rgba(34,197,94,0.15)'` | `` `${colors.success}26` `` |
| criterion unmet bg `'rgba(255,255,255,0.05)'` | `colors.glassLight` |
| `progressBarBg 'rgba(255,255,255,0.08)'` | `colors.glassLight` |
| criteria bar fill `levelColor` | the level's **token** colour (§3) |
| milestone bar fill `'#22c55e'` | `colors.success` |
| `bulletDot '#c084fc'` | `colors.primary2` |
| `nextStepText '#cbd5e1'` | `colors.textMuted` |
| bulb icon `'#eab308'` | `colors.warning` |
| AI button gradient `['#7c3aed','#a855f7']` | `gradients.primaryGradient` |
| `aiButtonText '#fff' / 14 / '700'` | `colors.text` / `typography.button` |
| connector `'rgba(255,255,255,0.1)'` | `colors.glassLight` |
| step future border `'rgba(255,255,255,0.2)'` | `colors.borderGlass` |
| current-dot glow `shadowColor: dotColor` | keep — level token colour |
| `milestoneTitle '#f8fafc' / 14 / '600'` | `colors.text` / `typography.smallBold` |
| row borders `'rgba(255,255,255,0.04)'` | `colors.borderLight` |
| ad-hoc `borderRadius 16 / 12 / 8` | `radius.lg / md / sm` |
| ad-hoc paddings `28 / 24 / 16 / 14 / 12 / 10 / 8` | `spacing.xl / lg / md / sm / xs` |
| ad-hoc `marginTop 14` between cards | `spacing.lg` |
| inline font sizes/weights everywhere | `typography.h1 / h3 / bodyBold / smallBold / small / caption / button` |

---

## 14. Accessibility

- **Touch targets ≥ 44×44pt:** milestone rows, the "Ask AI" and "Create a Plan" CTAs, the
  BackButton (already 40pt visual + hit-slop), and each stepper `stepContainer` (visual dot is
  26pt — pad the container's tappable area to ≥44 if it becomes interactive; display-only in
  v1 so no target needed, but keep the padding for future).
- **Colour independence — the core rule for this screen:**
  - **Level status** = ring fill + level **number** + level **name** + "LEVEL" label together
    (never the colour alone).
  - **Criteria** = filled `checkmark-circle` vs outline `ellipse-outline` **icon** + full- vs
    muted-**opacity title** + the literal word **"Not yet"** on unmet rows.
  - **Journey steps** = checkmark (done) vs number (current) vs empty (future) **glyph** +
    label weight, plus the `primary2` "you are here" ring on the current dot.
  - **Milestones** = filled vs outline **icon** + **strikethrough** on reached + the word
    **"Reached"** vs **"Target"** in the subtitle.
- **Contrast:** all text uses `colors.text` / `colors.textMuted` on dark glass (clears WCAG
  AA). **Note:** the current design uses `#475569` (`colors.textDark`, contrast ≈ 3.0:1 on the
  card) for criterion/milestone *detail text* — that **fails** AA for body text. This redesign
  bumps detail/subtitle text to `colors.textMuted` (`#94a3b8`, ≈ 5.9:1) and reserves
  `colors.textDark` for **non-text / decorative** use only (future step labels, empty-state
  icons, unmet-icon glyph — where it reads as "de-emphasised", not "unreadable body copy").
- **Screen-reader order:** header → hero (`"Level 3, Build Security, 68 percent complete"`) →
  journey (`"Journey: level 3 of 5, current level Build Security"`) → criteria (bar summary
  `"3 of 5 criteria met"` then each row `"{name}, {met|not yet}. {detail}"`) → next steps
  (each bullet) → each plan (`"{plan name}, {type}, {reached} of {total} milestones reached"`
  then each milestone `"{title}, {reached|pending}, {reached|target date}{, by {partner}}.
  Double tap to toggle."`).
- **Reduced motion:** the ring sweep, milestone toggle, and CTA press-scale use
  `animation.fast`; under reduce-motion they become instant state swaps (the ring renders at
  its final offset with no animated sweep).
- **Dynamic Type:** the level number, level name, and step labels reflow (no fixed heights that
  clip); the ring keeps a fixed size but the surrounding text stacks with min-heights, not
  fixed heights.

---

## 15. Developer notes

- **Re-layout, not new data.** Everything is already fetched: `GET /auth/ai/framework-level`
  (`level`, `level_name`, `criteria`, `completed_pct`, `next_steps`) and `GET /auth/plans`
  (+ `/auth/plans/{id}` and `/auth/plans/{id}/progress` for active plans' milestones).
  Preserve the existing `loadData` flow, `Promise.all` fan-out, pull-to-refresh, and the
  optimistic milestone toggle. The redesign is purely presentational + the state additions
  in §11.
- **Replace `LEVEL_COLORS` / `PLAN_TYPE_CONFIG` raw hex** with token-keyed maps (§3). Keep
  `LEVEL_NAMES` as the fallback names.
- **Reuse, don't reimplement:** `GradientBackground` (bg), `Skeleton` (loading), `BackButton`
  + `ErrorState` (header/error). Keep the local `ProgressRing` SVG — just tokenize its track
  and stroke colours. `Sparkline` is available if a plan/net-worth trend is added later; it's
  not needed for v1.
- **Milestone subtitle:** add the `reached_at` short-date on reached milestones (`Reached
  {date}`) — the data is already on the `Milestone` type (`reached_at?`), it's just not shown
  today.
- **Partner glyph** mirrors the calendar/dashboard mapping exactly (A → `primary2`/`◑`, B →
  `info`/`◐`, shared → none). Gate it on owner data being present; degrade silently otherwise.
- **Empty hero** triggers when `level` is null after a successful load (new couple with no
  computed level). Don't confuse it with the error state (load failed) — those are distinct.
- The `this month`-style forward-compat affordance from the dashboard has **no analogue here**;
  the framework screen has no period switch.

---

## 16. Handoff checklist

- [x] 5-tier hierarchy defined; only the level hero floats (`glassFloating`) + owns `h1`
- [x] Level colour scale remapped onto design-system tokens (error→warning→info→success→primary2)
- [x] Journey stepper, criteria checklist, next-steps + AI CTA, plan/milestone cards fully tokenized
- [x] Milestone toggle behaviour + optimistic spinner preserved
- [x] All states designed: default, loading (skeleton), empty-hero, empty-plans, empty-criteria, error, overflow
- [x] Every old hardcoded colour / gradient / spacing / font mapped to a token (§13)
- [x] Contrast fix flagged: `textDark` body copy → `textMuted` (AA); `textDark` reserved for decorative
- [x] Accessibility: 44pt targets, colour-independent status (icon+word+colour), SR order/labels, reduced motion, Dynamic Type
- [x] Couples attribution proposed as additive, graceful-degrade glyph (consistent with siblings)
- [x] Component specs written (`docs/design/components/framework-*.json`)
