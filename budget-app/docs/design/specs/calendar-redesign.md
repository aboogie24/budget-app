# Calendar Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** ad-hoc styling in `budget-app/app/(tabs)/calendar.tsx`

---

## 1. Why this redesign exists

The current calendar does **not** use the app's design system. It hardcodes its own
colors (`INCOME_COLOR = '#34d399'`, `BILL_COLOR = '#60a5fa'`, `ACCENT = '#a855f7'`),
its own gradient (`['#0f0a1e','#1a1035','#0f0a1e']`), and its own surface/border values.
That is *the* reason it "feels dated and cluttered" — it is visually a different app from
the rest of CoupleFlow.

This redesign does two things at once:

1. **Adopts the design system** — every color, radius, space, font, gradient, and card
   surface comes from `design-system.ts`. No magic numbers, no local color constants.
2. **Expresses the new bill/transaction data model** — actual money vs. projected
   (unpaid) bills are now visually first-class and *never blended into one number*.

### The data-model problem we are solving visually

Previously a bill was counted **and** its paid transaction was counted → double counting.
New model:

- A **bill** is a recurring obligation. While **UNPAID** for the period it is a
  **projection** (it *will* leave the account but hasn't yet).
- Once **PAID**, the bill is replaced by its **real transaction** — the scheduled bill
  disappears and the actual money-out transaction stands in its place.
- Therefore each day/period has two conceptually distinct buckets:
  - **Actual money** = real income + real expenses (paid bills are already in here as
    transactions).
  - **Upcoming / projected** = unpaid bills not yet paid.

The redesign's single most important job: make **"actual"** and **"projected"** look
and read differently everywhere — totals, day cells, and event rows.

---

## 2. The core visual idea — "Actual is solid, Projected is ghosted"

One rule applied consistently across all three surfaces (month grid, day list, header):

| Concept | Visual language | Tokens |
|---|---|---|
| **Actual** money (real income & expenses, incl. paid bills) | **Solid** fill, full-opacity text, filled icon chip | `colors.success` (income), `colors.error` (expense), solid glass card |
| **Projected** unpaid bills (upcoming) | **Outlined / ghosted** — dashed or 1px border, transparent fill, reduced-opacity text, **outline icon** | `colors.warning` for "due", `colors.info` accent ring, `borderGlass`, text at ~70% opacity |

This is the same metaphor a designer would reach for instinctively: *committed money is
filled in; money that hasn't happened yet is sketched in outline*. It is also
accessibility-safe — projected vs actual is conveyed by **fill style + icon style +
a text label**, never by color alone.

---

## 3. Month-level Summary Header — the "Spent so far / Still due / Income" split

This is the headline of the screen. It must **never** show one blended expense number.

### Wireframe — Summary Header (glass floating card)

```
┌──────────────────────────────────────────────────────────┐
│  JUNE 2026                                    ‹  Today  ›  │  ← month nav + Today pill
│                                                            │
│   Spent so far        Still due          Income            │
│   ▆ $2,140.00         ▢ $865.00          ▲ $5,200.00       │
│   ───────────         ─ ─ ─ ─ ─          ───────────       │
│   12 transactions     3 bills unpaid     2 paychecks       │
│                                                            │
│   ┌────────────────────────────────────────────────────┐  │
│   │ Net so far  +$3,060.00   ·   Projected net +$2,195 │  │  ← dual net line
│   └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

Visual encoding:

- **Spent so far** — `▆` solid bar, value in `colors.error`, **solid** weight. This is
  real money already gone (transactions + paid bills).
- **Still due** — `▢` outlined/dashed bar, value in `colors.warning`, text at reduced
  opacity. This is the sum of **unpaid** bills remaining this month. The dashed underline
  is the projected motif.
- **Income** — `▲` solid, `colors.success`. Income is correct today; shown solid.
- **Dual net line** — two nets so the couple sees both realities:
  - **Net so far** = Income received − Spent so far (what's true right now).
  - **Projected net** = Income − (Spent so far + Still due) (where the month lands if
    everything gets paid). Rendered in muted text to read as a forecast.

Why three columns and not the old `+income / -expense / net` bar: the old bar blended
paid + unpaid expenses into one `-$X`. The split is the entire point of the redesign, so
it earns the most prominent, top-of-screen position in a `glassFloating` card.

---

## 4. Month Overview — the day grid

The grid must answer two questions at a single glance per day:
**"Did real money move?"** and **"Is a bill coming due?"**

### Wireframe — Month Grid

```
┌──────────────────────────────────────────────────────────┐
│   S     M     T     W     T     F     S                    │
│                                                            │
│              1     2     3     4     5     6               │
│                          ●           ◌                     │  ● actual  ◌ projected
│                                                            │
│   7     8     9    10    11    12    13                    │
│   ▲●                ◌          ●▲                          │
│                                                            │
│  14    15    16   (17)   18    19    20                    │  (17) = selected: filled
│  ◌     ●●          ▣      ◌◌                                │       purple circle
│                                                            │
│  21    22    23    24    25   ·26·   27                    │  ·26· = today: purple ring
│        ●           ◌◌◌+                                     │
│                                                            │
│  28    29    30                                            │
│  ◌●                                                        │
│                                                            │
│  ─────────────────────────────────────────────────────    │
│  ● Spent   ▲ Income   ◌ Upcoming bill   + more             │  ← legend
└──────────────────────────────────────────────────────────┘
```

### Per-day indicators (the key distinction)

Each day cell shows up to a small **row of markers** under the date number:

| Marker | Meaning | Shape | Token |
|---|---|---|---|
| `●` solid dot | day **had real spending** (actual expense transaction / paid bill) | filled circle 5px | `colors.error` |
| `▲` solid up-tick | day **had income** | filled triangle/dot | `colors.success` |
| `◌` hollow ring | day **has an upcoming/unpaid bill** (projection) | **outlined** ring 5px, 1.5px stroke, transparent center | `colors.warning` stroke |
| `+` | overflow — more than 3 markers | tiny `+` glyph | `colors.textMuted` |

The **hollow ring vs. filled dot** is the at-a-glance "upcoming bill vs. real spending"
distinction the brief demands. Solid = it happened. Hollow = it's coming. A day with both
a paid expense and an unpaid bill shows `● ◌` side by side, which is exactly the truth.

### Day cell states

- **Default:** date number in `colors.text`, markers below.
- **Today:** 1.5px ring in `colors.primary2` around the day circle (matches existing
  pattern, now tokenized).
- **Selected:** filled `colors.primary` circle, white number, subtle
  `rgba(124,58,237,0.18)` cell background with `radius.md`.
- **Has upcoming bill due / overdue this day:** if any bill on the day is `overdue`, the
  hollow ring uses `colors.error` stroke instead of `colors.warning` (still hollow — it's
  still unpaid, just late).
- **Empty day:** number only, no markers.

> Note: the current code only renders a compact week strip + an expand toggle to the
> month grid. **Keep the expand/collapse affordance** (week strip default, month grid
> expanded) — it's a good progressive-disclosure pattern. Both views use the same marker
> system described here.

---

## 5. Selected-Day Detail View

Shows the per-day split totals, then the day's events grouped **Actual** then **Upcoming**.

### Wireframe — Day Detail

```
┌──────────────────────────────────────────────────────────┐
│  Tuesday, June 17                                          │  ← sectionTitle
│                                                            │
│   ▲ Received $0.00   ·   ▆ Spent $84.20   ·   ▢ Due $120  │  ← per-day split chips
│                                                            │
│  ── ACTUAL ───────────────────────────────────────────    │  group label (muted)
│  ┌──────────────────────────────────────────────────┐     │
│  │ [🛒] Whole Foods                       -$84.20    │     │  solid card, error amt
│  │      Groceries · 2:14 PM · ◑ Alex                 │     │  optional partner dot
│  └──────────────────────────────────────────────────┘     │
│                                                            │
│  ── UPCOMING ─────────────────────────────────────────    │  group label (muted)
│  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐     │
│  ╎ [🧾] Internet — Xfinity      [DUE] [AUTO] ~$120  ╎     │  DASHED border, ghosted
│  ╎      Bill · projected · autopay June 17           ╎     │  ~ prefix = estimate
│  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘     │
└──────────────────────────────────────────────────────────┘
```

### Per-day split chips

Same three-bucket logic as the header, scoped to the selected day:
`▲ Received` (income, `colors.success`), `▆ Spent` (actual expenses, `colors.error`),
`▢ Due` (unpaid bills, `colors.warning`, dashed border chip). Only render a chip if its
value > 0.

### Event rows — Actual vs Projected treatment

**Actual rows** (income, real expenses, paid bills):
- Solid glass row (`glassEffects.glass`, `colors.glassLight` fill).
- Filled icon chip tinted with the semantic color at ~12% opacity.
- Full-opacity name + amount. Amount prefixed `+` (income) / `-` (expense).
- No `~` on the amount — it's exact.

**Projected rows** (unpaid/upcoming bills):
- **Dashed 1px border** (`borderStyle: 'dashed'`, `colors.borderGlass`), transparent or
  near-transparent fill — the row reads as a "ghost".
- **Outline icon** (e.g. `receipt-outline`) in `colors.warning`.
- Name + amount at **~70% opacity**; amount prefixed `~` to signal "estimated/not yet
  final" (e.g. `~$120.00`).
- Status chip **[DUE]** (`colors.warning`) or **[OVERDUE]** (`colors.error`), plus
  **[AUTO]** pill (`colors.primary2`) when `isAutoPay`.
- Subtitle includes the literal word **"projected"** so the state is never color-only.

This mapping comes straight from the event flags already on `EventItem`:
`source === 'bill' && billStatus !== 'paid'` → **projected**; everything else (including
`billStatus === 'paid'` bills, which arrive as transactions) → **actual**.

---

## 6. Couples nuance — whose transaction is it (optional, recommended)

CoupleFlow is a two-partner household app, so attribution is genuinely useful — but it
must stay **lightweight** so it doesn't re-clutter the screen we just cleaned up.

Recommendation: a small **partner glyph** on each actual transaction row only.

- A 14px circle with the partner's initial, or a `◑`/`◐` half-moon glyph, tinted:
  - Partner A → `colors.primary2` (`#a855f7`)
  - Partner B → `colors.info` (`#3b82f6`)
- Placed inline in the subtitle: `Groceries · 2:14 PM · ◑ Alex`.
- **Shared / household** items (e.g. a joint bill) → no glyph, or a small `house` outline
  icon. Most bills are household-level, so they stay neutral.
- Do **not** color-code whose-money by changing the amount color — keep amounts on the
  income/expense semantic palette. Attribution is a secondary glyph only.

If partner identity isn't available from the API yet, this degrades gracefully: omit the
glyph and nothing else changes. That's why it's proposed as additive, not structural.

---

## 7. States

| State | Treatment |
|---|---|
| **Default / populated** | As wireframed above. |
| **Empty day** | Centered `sunny-outline` icon (`colors.textDark`) + "Nothing scheduled" in `colors.textMuted`. Keep current friendly copy. |
| **Empty month** (new household, no data) | Full glass card: calendar icon, "No money flow yet", subcopy "Link an account or add a transaction to see your month come to life", and a primary CTA button (`gradients.primaryGradient`). |
| **Loading** | **Skeleton**, not just the spinner. Use the existing `components/Skeleton.tsx`: skeleton day grid (greyed circles) + 3 skeleton event rows. Keep the small `ActivityIndicator` in the header for background refresh. |
| **Error** | Inline glass card: `alert-circle-outline` (`colors.error`), "Couldn't load your calendar", `Retry` text button. Don't blank the whole screen. |
| **Overflow — many events on a day** | Day list scrolls within the day section; grid cell caps at 3 markers + `+`. |
| **Overflow — long names** | `numberOfLines={1}` + ellipsis on event name; amount never truncates (it's `flexShrink: 0`). |
| **Disabled** | Future-month projected income/bills are still shown but Today pill hides when already on today (existing behavior, keep). |

---

## 8. Accessibility

- **Touch targets:** day cells and event rows ≥ 44×44pt. Current grid cells are ~32px
  circle in a 44px+ tappable cell — keep the tappable area padded to 44.
- **Color independence:** actual vs projected is encoded by **fill style (solid vs
  dashed) + icon style (filled vs outline) + a text label** ("projected", "DUE"), so it
  passes for color-blind users. Never rely on the warning-yellow alone.
- **Contrast:** all text uses `colors.text` / `colors.textMuted` on dark glass; the
  70%-opacity projected text must still clear 4.5:1 — verify `colors.text` at 0.7 over the
  card background; if it fails, use `colors.textMuted` at full opacity instead of dimming
  `colors.text`.
- **Screen reader order:** date number → markers summary ("2 transactions, 1 bill due")
  → event rows top to bottom. Each event row label: `"{name}, {actual|upcoming bill},
  {amount}, {status}"`.
- **Reduced motion:** marker/selection transitions use `animation.fast`; under
  reduce-motion, swap scale/opacity transitions for instant state change.

---

## 9. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value | Replace with token |
|---|---|
| `'#0f0a1e','#1a1035','#0f0a1e'` background | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `INCOME_COLOR '#34d399'` | `colors.success` |
| `EXPENSE_COLOR '#f87171'` | `colors.error` |
| `BILL_COLOR '#60a5fa'` | `colors.info` (paid-bill context) / `colors.warning` (unpaid-bill projection) |
| `ACCENT '#a855f7'` | `colors.primary2` |
| `PINK '#ec4899'` (partner) | partner A `colors.primary2`, partner B `colors.info` |
| `SURFACE 'rgba(255,255,255,0.06)'` cards | `glassEffects.glass` / `commonStyles.card` |
| `BORDER 'rgba(255,255,255,0.08)'` | `colors.borderGlass` |
| ad-hoc `borderRadius: 16` | `radius.lg` |
| ad-hoc paddings (16, 12, 8) | `spacing.lg / md / sm` |
| inline font sizes/weights | `typography.h3 / bodyBold / small / caption` |
| header card | `glassEffects.glassFloating` (summary header earns elevation) |

---

## 10. Developer notes

- Data classification is already available on `EventItem`; add one derived helper:
  `isProjected(e) = e.source === 'bill' && e.billStatus !== 'paid'`. Drive **all**
  projected styling off this single predicate.
- Split math:
  - `spentSoFar` = sum of `actual expense` events (transactions + bills where
    `billStatus === 'paid'`, which already arrive as transactions — so effectively just
    `type === 'expense' && source !== 'bill'` once paid bills become transactions).
  - `stillDue` = sum of projected bills (`isProjected(e)`).
  - `income` = sum of `type === 'income'`.
  - Keep `spentSoFar` and `stillDue` as **separate fields end to end** — never add them
    before display. This is the regression guard against the double-count bug.
- Reuse existing `components/Skeleton.tsx` for the loading state and the
  `GradientBackground` component for the background — do not re-implement either.
- The `~` estimate prefix and "projected" label are intentional copy; keep them.

---

## 11. Handoff checklist

- [x] All states designed (default, empty day, empty month, loading, error, overflow)
- [x] Projected-vs-actual visual treatment defined (solid vs dashed/outline + label)
- [x] Split totals defined for header **and** per day ("Spent so far / Still due / Income")
- [x] Every old hardcoded value mapped to a design-system token
- [x] Accessibility: 44pt targets, color-independent encoding, SR order, reduced motion
- [x] Couples attribution proposed as additive, graceful-degrade glyph
- [x] Component specs written (`docs/design/components/*.json`)
- [x] Tokens extracted (`docs/design/tokens/calendar-tokens.json`)
