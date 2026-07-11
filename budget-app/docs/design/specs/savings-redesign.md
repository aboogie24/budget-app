# Savings Goals Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Route:** `savings` — file `budget-app/app/savings.tsx`
**Archetype:** list (header + summary hero + list of rows + add/edit modal)
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Sibling references (match these exactly):** `app/(tabs)/dashboard.tsx`,
`app/(tabs)/calendar.tsx`, and their specs `dashboard-redesign.md`,
`calendar-redesign.md`. List-row conventions mirror `bills-BillRow.json` and
`debts-row.json`.

---

## 1. Why this redesign exists

The savings screen is a **different app from the rest of CoupleFlow**. It is the
last screen still running its own bespoke styling, and it collides with the
design system in three ways:

1. **Wrong background gradient.** It hardcodes
   `['#0b1021', '#2b0f50', '#1b1039']` inline via `LinearGradient`. Every other
   screen now uses `<GradientBackground variant="bgDarkPurple">`
   (`['#0f172a', '#1a0a40', '#0f172a']`). The savings purple is visibly
   different — it is *the* reason the screen "feels off."
2. **Local color + surface constants.** `#34d399` (green), `#c084fc` (accent),
   `#1a1a2e` (modal), `rgba(255,255,255,0.06)` (cards), `rgba(255,255,255,0.08)`
   (borders), and raw `16 / 12 / 8` spacing / `borderRadius: 16` are all
   hardcoded. None come from `design-system.ts`. The green in particular
   (`#34d399`) is *not* `colors.success` (`#22c55e`) — a subtle inconsistency the
   eye catches.
3. **No loading skeleton, no error-aware layout.** Loading is a bare
   `ActivityIndicator`; the reference screens use `components/Skeleton.tsx`
   layout-matched placeholders. (An `ErrorState` and `EmptyState` already exist —
   keep them, just tokenize their surroundings.)

The redesign is a **re-skin + light IA improvement**, not a rebuild. It is the
same screen: a summary of overall savings progress on top, a tappable list of
goals below, an add/edit form, and a quick "update progress" action. Every color,
gradient, space, radius, and font is swapped to a token. The one IA improvement:
give each goal row a **status** (`On track` / `Behind` / `Funded`) so a couple can
tell at a glance which goals need attention — encoded with icon + word + color,
never color alone.

---

## 2. The core visual idea — "hero summary, then status-aware goal rows"

Two consistent ideas borrowed from the sibling screens:

| Concept | Visual language | Tokens |
|---|---|---|
| **Overall progress** (top) | one **floating** hero card — the only card that floats and uses the largest number | `glassEffects.glassFloating`, `typography.h1`/`h2`, `radius.xl` |
| **Each goal** (list) | flat `glass` row with a **progress bar** + a **status chip** (icon + word + color) | `glassEffects.glass`, `radius.lg`, semantic status color |

Rule of thumb (same as dashboard): **only the summary hero floats.** If a goal
row ever competes for "biggest thing on screen," the hierarchy has broken.

### Goal status model (the IA improvement)

Each goal gets a derived status so the list is scannable. Status is conveyed by
**icon + word + color together** (accessibility — never color alone):

| Status | When | Token | Icon (Ionicons) | Chip word |
|---|---|---|---|---|
| **Funded** | `current >= target` (`pct >= 100`) | `colors.success` | `checkmark-circle` | `FUNDED` |
| **On track** | has no `target_date`, OR projected to hit target by date | `colors.info` | `trending-up` | `ON TRACK` |
| **Behind** | `target_date` exists and required run-rate exceeds current pace | `colors.warning` | `alert-circle` (outline) | `BEHIND` |

The progress-bar fill color follows the status (`success` / `info` / `warning`)
so the bar itself carries the same signal as the chip. "Behind" is the only
status that needs a data-derived pace check; if `target_date` is empty the goal
is simply **On track** (there is no deadline to miss). See §9 for the math.

---

## 3. Full-screen wireframe (top to bottom)

Default / populated. iPhone 15 Pro (390×844). Household context.

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]        Savings Goals                            [ + ]     │  ← header row
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │  OVERALL PROGRESS                                         │ │  │ HERO
│  │                                                          │ │  │ glassFloating
│  │  $12,480          saved of $30,000 target               │ │  │ (the only card
│  │  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔░░░░░░░░░░░░░░░░░░░░░░  42%           │ │  │  that floats)
│  │                                                          │ │  │
│  │  ● 4 goals   ·   ✓ 1 funded   ·   ⚠ 1 behind            │ │  │  ← summary chips
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.xl gap
│  YOUR GOALS                                                    │  ← group label
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │  Emergency Fund                    ✓ FUNDED    $10,000   │ │  │ GOAL ROW (funded)
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  100%          │ │  │ glass, success bar
│  │  of $10,000                          [ ↑ Update ]        │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │  Down Payment                    ↗ ON TRACK    $2,000    │ │  │ GOAL ROW (on track)
│  │  ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  10%           │ │  │ glass, info bar
│  │  of $20,000 · by 2027-06-01          [ ↑ Update ]        │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │  Vacation                          ⚠ BEHIND      $480    │ │  │ GOAL ROW (behind)
│  │  ▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  24%           │ │  │ glass, warning bar
│  │  of $2,000 · by 2026-08-01           [ ↑ Update ]        │ │  │
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

Layout tokens: screen padding `spacing.lg` (16) horizontal, `paddingTop`
`spacing.lg`, `paddingBottom` 120 (clears any tab/FAB). Gap under the hero is
`spacing.xl` (24); gap between goal rows is `spacing.md` (12). The `YOUR GOALS`
group label is `typography.caption` uppercase in `colors.textMuted` with
`spacing.sm` below (identical recipe to the dashboard's `RECENT ACTIVITY` label).

### 3.1 Loading (skeleton, not a spinner)

Replaces the bare `ActivityIndicator`. Reuse `components/Skeleton.tsx`,
layout-matched so nothing jumps when data arrives.

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]        Savings Goals                            [ + ]     │  ← header renders now
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  hero skeleton
│  │  ▁▁▁▁▁▁▁▁                                                 │ │  (glassFloating shell)
│  │  ▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇▇                                        │ │  label + big value
│  │  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  (bar)         │ │  track skeleton
│  └──────────────────────────────────────────────────────────┘ │
│  ▁▁▁▁▁▁▁▁  (group label skeleton)                             │
│  ┌──────────────────────────────────────────────────────────┐ │  3× row skeleton
│  │  ▇▇▇▇▇▇▇▇▇▇▇▇                        ▁▁▁▁      ▁▁▁▁▁      │ │  name + chip + amt
│  │  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔                │ │  bar
│  │  ▁▁▁▁▁▁▁▁                             ▁▁▁▁▁▁▁            │ │  sub + button
│  └──────────────────────────────────────────────────────────┘ │
│                    (× 3)                                       │
└──────────────────────────────────────────────────────────────┘
```

Each skeleton primitive uses `Skeleton` with token dims: hero label
`width={120} height={12}`, hero value `width={180} height={28}`, bar
`width="100%" height={8} borderRadius={radius.full}`; per row a `36×36`
`radius.md` block is **not** needed (no leading icon on goal rows — see §5), so a
row skeleton is: name `width="55%" height={14}`, chip `width={72} height={20}
borderRadius={radius.full}`, amount `width={64} height={16}`, bar full width
`height={8}`, sub `width="45%" height={10}`. Keep a small `ActivityIndicator`
(`colors.primary2`) in the header only for background refresh (matches dashboard).

### 3.2 Empty (no goals yet)

Reuse the existing `EmptyState` component (already imported), tokenized. Keep the
current friendly copy and the primary CTA.

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]        Savings Goals                            [ + ]     │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  hero still renders,
│  │  OVERALL PROGRESS                                        │ │  in a zero state:
│  │  $0                saved of $0 target                    │ │  value $0, empty track
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0%            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│                        ✨  (sparkles-outline)                  │  ← EmptyState
│                     No savings goals                          │    icon colors.textDark
│         Create your first savings goal to start               │    title colors.text
│                    building wealth                            │    body colors.textMuted
│                                                                │
│                    ┌────────────────────┐                     │
│                    │    Create Goal     │                     │  ← primary CTA
│                    └────────────────────┘                     │    gradients.primaryGradient
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

Decision: **keep the hero card visible in the zero state** (showing `$0 / $0`,
0%). It anchors the screen and, the moment the first goal is added, the number
animates up — the empty state doesn't feel like a dead-end. `EmptyState`'s
`onAction` opens the add-goal form (same handler as the header `+`).

### 3.3 Error

Reuse the existing `ErrorState` component, tokenized. It renders **inline**
(under the hero), not as a full-screen blank — matches calendar/dashboard.

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]        Savings Goals                            [ + ]     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ⓘ  (alert-circle-outline, colors.error)                 │ │
│  │  Something went wrong                                     │ │
│  │  Failed to load savings goals                            │ │
│  │              [ Retry ]                                    │ │  ← text button
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

When `error` is set, suppress the goals list and skeleton; the hero may still
render from any last-known totals (or `$0/$0`) so the screen isn't fully blank.

### 3.4 Overflow / edge cases

- **Long goal name:** `numberOfLines={1}` + ellipsis on the name; the status chip
  and amount never truncate (`flexShrink: 0`).
- **Many goals:** the list is the scroll content; no cap. Hero counts
  (`4 goals · 1 funded · 1 behind`) summarize so the user isn't forced to scroll
  to gauge the whole picture.
- **Over-funded goal** (`current > target`): bar caps at 100% (existing
  `Math.min` logic); status is **Funded**; the amount shows the true
  `current_amount` (e.g. `$10,400`) while the sub reads `of $10,000` so the
  over-save is visible without breaking the bar.
- **No target_date:** omit the `· by {date}` fragment from the sub; status can
  never be **Behind** (nothing to be late against) → **On track**.

---

## 4. Section — Overall Progress hero (`glassFloating`)

The headline of the screen. It replaces the current `summaryCard`.

- **Surface:** `glassEffects.glassFloating` — the only floating card here,
  `radius.xl`, `padding: spacing.xl`.
- **Label:** `OVERALL PROGRESS` — `typography.caption` uppercase, `colors.textMuted`.
- **Primary value line:** `$12,480` in `typography.h1` (32/700) `colors.text`,
  followed inline by `saved of $30,000 target` in `typography.small`
  `colors.textMuted`. (Current design put the whole `x / y` in one 18px value;
  promoting the *saved* number to `h1` makes the hero read like the dashboard's
  hero number.)
- **Progress track + fill:** the shared progress-bar recipe (§6). Track
  `colors.glassLight`, height 8, `radius.full`. Fill width = `overallPercent%`,
  color `colors.primary` (the overall bar is brand-primary, not status — it's an
  aggregate). Trailing `42%` label in `typography.smallBold` `colors.primary`.
- **Summary chips row:** small inline counts, `typography.caption`:
  `● {n} goals` (`colors.textMuted`) · `✓ {n} funded` (`colors.success`, only if
  > 0) · `⚠ {n} behind` (`colors.warning`, only if > 0). Each chip = icon + count
  + word (color-independent). This is the IA payoff: the couple sees "1 behind"
  without scrolling.

Currency uses the existing `fmt` helper (`toLocaleString` USD) — keep it.

---

## 5. Section — Goal row (`SavingsGoalRow`, flat `glass`)

The list item. Replaces the current `styles.card`. Tappable (opens the edit
modal via `openEdit(g)` — unchanged). Mirrors `bills-BillRow` / `debts-row`
proportions so the three list screens read identically.

```
┌──────────────────────────────────────────────────────────┐
│  Emergency Fund                    ✓ FUNDED    $10,000   │  row 1: name · chip · amount
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  100%          │  row 2: progress bar + pct
│  of $10,000 · by 2026-12-31          [ ↑ Update ]        │  row 3: sub · update action
└──────────────────────────────────────────────────────────┘
```

- **Surface:** `glassEffects.glass`, `radius.lg`, `padding: spacing.lg`,
  `marginBottom: spacing.md`. No leading icon chip (unlike transactions) — the
  status chip carries the semantics and the name is the primary anchor.
- **Row 1 — name / status chip / amount:**
  - Name `typography.bodyBold` `colors.text`, `numberOfLines={1}`.
  - **Status chip** (§2): pill, `radius.full`, `typography.caption` bold, icon +
    word, background = status color at 12% (`` `${statusColor}1f` ``), text/icon =
    full status color.
  - Amount `current_amount` `typography.bodyBold` `colors.text`,
    `flexShrink: 0`. (Current design colored the amount green; switch to
    `colors.text` — the *bar + chip* carry status, and neutral amounts match the
    bills/debts rows. Green is reserved for the Funded chip.)
- **Row 2 — progress bar:** shared recipe (§6). Fill color = **status color**
  (`success` / `info` / `warning`). Trailing `{pct}%` in `typography.caption`
  `colors.textMuted`.
- **Row 3 — sub-line + update action:**
  - Sub `typography.caption` `colors.textMuted`: `of {target} · by {target_date}`
    (the `· by …` fragment omitted when no date).
  - **Update button** — the existing "Update Progress" affordance, tokenized:
    `trending-up` icon + `Update`, `typography.caption` bold, `colors.success`
    text on `` `${colors.success}1f` `` fill (~12%), `radius.md`, min 44pt tap
    target (hit-slop if visually shorter). `onPress` calls
    `e.stopPropagation()` then opens the progress modal (`setProgressId(g.id)`) —
    behavior unchanged.

---

## 6. Shared progress-bar recipe

Used by the hero and every goal row (replaces `progressTrack` / `progressFill`).

- **Track:** height 8, `backgroundColor: colors.glassLight`,
  `borderRadius: radius.full`, `overflow: 'hidden'`.
- **Fill:** height `100%`, `width: \`${pct}%\``, `borderRadius: radius.full`,
  `backgroundColor:` hero → `colors.primary`; goal row → status color.
- **Animation:** width transitions with `animation.medium` when progress updates
  (optimistic bump after "Update"); snap instantly under reduce-motion.

---

## 7. Add / Edit Goal modal (`SavingsGoalFormSheet`)

The bottom-sheet form (`showForm`). Keep all fields and validation
(`handleSave`) — this is a re-skin. Match the form-field tokens already used by
`add-transaction-form-field.json`.

```
┌──────────────────────────────────────────────────────────┐
│  New Savings Goal                                    [✕]  │  ← sheet header
│                                                            │
│  Name                                                      │  label caption bold
│  ┌──────────────────────────────────────────────────────┐ │
│  │  e.g. Emergency Fund                                 │ │  input (glass)
│  └──────────────────────────────────────────────────────┘ │
│  Target Amount                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  $0.00                                               │ │
│  └──────────────────────────────────────────────────────┘ │
│  Current Amount                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  $0.00                                               │ │
│  └──────────────────────────────────────────────────────┘ │
│  Target Date (optional)                                    │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  2026-12-31                                          │ │
│  └──────────────────────────────────────────────────────┘ │
│  Priority (1 = highest)                                    │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  1                                                   │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐ │
│  │                  Create Goal                         │ │  ← primary CTA
│  └──────────────────────────────────────────────────────┘ │    gradients.primaryGradient
└──────────────────────────────────────────────────────────┘
```

- **Sheet surface:** replace hardcoded `#1a1a2e` with `colors.surface2`
  (`#1e293b`) — the tokenized elevated surface; `borderTopLeftRadius` /
  `borderTopRightRadius` = `radius.xl`, `padding: spacing.xl`. Backdrop
  `rgba(0,0,0,0.6)` is fine as an overlay scrim (keep).
- **Title:** `typography.h3` `colors.text` (`New Savings Goal` / `Edit Goal`).
  Close `✕` = `Ionicons close`, 24, `colors.textMuted`, 44pt hit-slop.
- **Field label:** `typography.smallBold` `colors.textMuted`, `marginBottom:
  spacing.sm`.
- **Input:** `backgroundColor: colors.glassLight`, `borderWidth: 1`,
  `borderColor: colors.borderGlass`, `borderRadius: radius.md`,
  `paddingHorizontal: spacing.md`, `paddingVertical: spacing.md`, text
  `colors.text` `typography.body`, `placeholderTextColor: colors.textMuted`.
- **Primary CTA:** `LinearGradient` `gradients.primaryGradient`
  (`[colors.primary, colors.primary2]`) — replaces the ad-hoc
  `['#a855f7', '#7c3aed']`. `borderRadius: radius.lg`, `paddingVertical:
  spacing.lg`, label `typography.button` `colors.text`. Copy: `Create Goal` /
  `Update`.
- **Keyboard avoidance:** wrap in `KeyboardAvoidingView` (behavior `padding` on
  iOS) so the numeric fields aren't covered — the current sheet lacks this.

---

## 8. Update Progress modal (`SavingsProgressSheet`)

The quick fade-in sheet (`progressId !== null`). Keep `handleUpdateProgress`
and the tap-scrim-to-dismiss behavior.

```
┌──────────────────────────────────────────────────────────┐
│  Update Savings                                           │  h3
│  Enter the new total saved amount                         │  caption, muted
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Current amount saved                                │ │  input (same recipe as §7)
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │                 Save Progress                        │ │  ← success CTA
│  └──────────────────────────────────────────────────────┘ │    gradients.successGradient
└──────────────────────────────────────────────────────────┘
```

- **Sheet surface:** `colors.surface2`, `radius.xl` top corners, `padding:
  spacing.xl` — same as §7.
- **Title:** `typography.h3` `colors.text`. Body `typography.caption`
  `colors.textMuted`.
- **Input:** same recipe as §7.
- **CTA:** because this is a *progress / positive-money* action, use
  `gradients.successGradient` (`['#15803d', '#22c55e']`) — replaces the ad-hoc
  `['#34d399', '#059669']`. Label `Save Progress`, `typography.button`
  `colors.text`.
- **Optimistic update:** on save, bump the goal's bar (and possibly its status →
  Funded) with `animation.medium` before the refetch resolves; snap under
  reduce-motion.

---

## 9. Developer notes — status derivation

Add one derived helper; drive the chip, bar color, and hero counts off it:

```
getGoalStatus(g):
  pct = target > 0 ? min(current/target*100, 100) : 0
  if current >= target && target > 0        → 'funded'   (success, checkmark-circle, FUNDED)
  if !g.target_date                          → 'on_track' (info, trending-up, ON TRACK)
  // deadline exists → compare required pace to actual pace
  daysLeft   = daysBetween(today, target_date)      // clamp ≥ 0
  remaining  = target - current
  if daysLeft <= 0 && remaining > 0          → 'behind'   (warning, alert-circle, BEHIND)
  // simple run-rate: if you keep saving at the pace implied so far,
  // do you land by the date? If no historical pace is available, use a
  // linear-since-creation heuristic; absent that, treat >0 remaining with a
  // near date (< 30 days) and low pct (< 60%) as 'behind', else 'on_track'.
  → requiredPerDay = remaining / daysLeft
     'behind' if requiredPerDay implies missing the date, else 'on_track'
```

- The pace check is intentionally **conservative** — when in doubt, show
  **On track** (never nag the couple with a false "Behind"). "Behind" must be
  defensible, so it only fires when a real deadline is genuinely at risk.
- All the totals the hero needs (`totalCurrent`, `totalTarget`, `overallPercent`)
  are already computed in the screen — **reuse them**. Add
  `fundedCount = goals.filter(g => g.current >= g.target && g.target > 0).length`
  and `behindCount = goals.filter(g => getGoalStatus(g) === 'behind').length` for
  the hero chips.
- **Reuse, don't reimplement:** `GradientBackground` (bg), `Skeleton` (loading),
  `BackButton` (header), `EmptyState`, `ErrorState`. No `Sparkline` on this screen
  (no time-series per goal) — do not add one.
- `fmt` (currency) helper stays as-is.

---

## 10. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value | Replace with token |
|---|---|
| `LinearGradient ['#0b1021','#2b0f50','#1b1039']` background | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `#34d399` (green progress / amount / update) | `colors.success` (`#22c55e`) |
| `#059669` (progress CTA end) | `gradients.successGradient` |
| `#c084fc` (add icon) | `colors.accent` (`#c084fc`) — already the token value; reference it |
| `#a855f7` / `#7c3aed` (save CTA) | `gradients.primaryGradient` (`[colors.primary, colors.primary2]`) |
| `#f8fafc` text | `colors.text` |
| `#cbd5e1` / `#e5e7eb` (labels/sub) | `colors.textMuted` |
| `#94a3b8` (placeholder / detail) | `colors.textMuted` |
| `#1a1a2e` (modal surface) | `colors.surface2` (`#1e293b`) |
| card `rgba(255,255,255,0.06)` fill | `colors.glassLight` / `glassEffects.glass` |
| border `rgba(255,255,255,0.08)` | `colors.borderGlass` |
| summary card | `glassEffects.glassFloating` (only the hero floats) |
| `updateBtn` bg `rgba(52,211,153,0.12)` | `` `${colors.success}1f` `` (12%) |
| progress track `rgba(255,255,255,0.08)` | `colors.glassLight` |
| header title `fontSize:20 fontWeight:800` | `typography.h3` (24/600) or `bodyBold` — match dashboard header weight |
| `borderRadius: 16` (cards) | `radius.lg` |
| `borderRadius: 20` (sheets) | `radius.xl` |
| `borderRadius: 12 / 14` (inputs / CTA) | `radius.md` / `radius.lg` |
| paddings `20 / 16 / 12 / 10 / 8 / 6` | `spacing.xl / lg / md / sm / xs` |
| `progressTrack` height 8 / `radius 4` | height 8, `radius.full` |
| inline font sizes/weights | `typography.h1 / h3 / bodyBold / small / smallBold / caption` |
| modal backdrop `rgba(0,0,0,0.6)` | keep (overlay scrim, not a themed surface) |
| `BackButton color` implicit | keep component default; or pass `colors.text` |

---

## 11. Accessibility

- **Touch targets:** header `+` and `BackButton` ≥ 44×44pt (BackButton is already
  40pt + 12 hit-slop — keep). Each goal row is a ≥ 44pt tappable card; the
  in-row **Update** button gets its own ≥ 44pt hit target (hit-slop if the pill is
  visually shorter). Modal close `✕` ≥ 44pt via hit-slop.
- **Color independence:** goal status is **never color alone** — every status is
  `icon + WORD + color` (`✓ FUNDED`, `↗ ON TRACK`, `⚠ BEHIND`), and the hero
  summary chips are `icon + count + word`. A color-blind user reads the word.
- **Contrast:** all text uses `colors.text` / `colors.textMuted` over dark glass
  (WCAG AA clear). Status tints are backgrounds only (12%); the chip text/icon
  stays full-opacity semantic color, verify ≥ 4.5:1 on the dark card.
- **Screen-reader order:** hero (`"Overall progress, $12,480 saved of $30,000, 42
  percent. 4 goals, 1 funded, 1 behind."`) → group label → each goal row top to
  bottom. Goal row label: `"{name}, {funded|on track|behind}, {current} saved of
  {target}, {pct} percent{, due {date}}."` The Update button is a nested action:
  `"Update {name} progress."`
- **Reduced motion:** progress-bar width tweens and the optimistic status flip
  use `animation.medium`; under reduce-motion they become instant. Sheet
  present/dismiss: keep the native `Modal` slide/fade; honor OS reduce-motion.
- **Keyboard:** form sheet wraps in `KeyboardAvoidingView`; numeric fields use
  `keyboardType="numeric"` (already set). Focus order top-to-bottom.

---

## 12. Handoff checklist

- [x] Why documented (wrong gradient + local colors/surfaces + no skeleton)
- [x] All states designed (default, loading skeleton, empty, error, overflow/over-funded)
- [x] Hero = the only floating card, `h1` value + primary bar + summary chips
- [x] Goal row spec'd with status chip (icon+word+color) + status-colored bar
- [x] Goal status model + conservative "Behind" derivation defined
- [x] Add/Edit + Update-Progress sheets tokenized (surface, inputs, gradient CTAs)
- [x] Every old hardcoded value mapped to a design-system token
- [x] Accessibility: 44pt targets, color-independent status, SR order/labels, reduced motion, keyboard
- [x] Reuses GradientBackground / Skeleton / BackButton / EmptyState / ErrorState (no reimpl)
- [x] Component specs written (`docs/design/components/savings-*.json`)
```
