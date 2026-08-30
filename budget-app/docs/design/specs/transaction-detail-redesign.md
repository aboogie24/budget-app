# Transaction Detail Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Archetype:** detail
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** the bespoke styling in `budget-app/app/transaction/[id].tsx`

---

## 1. Why this redesign exists

The current transaction-detail screen is a different app from the rest of CoupleFlow.
Concretely, it:

- **Hardcodes its own gradient** — `['#0b1021','#1b0d30','#2d0c53']` — which is a third,
  distinct purple that matches neither `gradients.bgDarkPurple` (the calendar/dashboard
  standard) nor any token. This is the single biggest "feels off" tell.
- **Hardcodes its own palette** — `#34d399`/`#f87171` for amounts (not `colors.success`/
  `colors.error`), `#a855f7` for the edit icon, `#cbd5e1`/`#e5e7eb` for text (not
  `colors.textMuted`/`colors.text`), and `rgba(255,255,255,0.06/0.08)` surfaces (not
  `glassEffects`).
- **Has no header title** — just a lone `BackButton` and a floating pencil, so the screen
  doesn't read as a titled detail page like every other redesigned screen.
- **Has one flat card doing everything** — the hero amount, the category, the note, and
  the metadata are all crammed into a single `rgba(255,255,255,0.06)` box with no
  hierarchy. The amount (the one thing the user opened this screen to see) has no more
  visual weight than the timestamp.
- **Has no loading, empty, or error states.** The screen assumes every field arrived via
  route params. If it's ever opened by id alone (deep link, notification, split-result
  navigation) with missing params, it silently renders `$0.00 / Uncategorized / now` —
  a wrong-but-confident detail page. There is no skeleton and no "couldn't load."
- **Buries the one real interaction.** Edit is gated to manual transactions, but the gate
  is invisible: a bank transaction simply has no pencil, with no explanation of *why* it
  can't be edited.

This redesign makes it a first-class **detail archetype** screen — fully tokenized, with a
titled header, a floating hero, a flat metadata card, the solid-vs-ghosted money metaphor,
graceful states, and the couples-attribution glyph — visually identical in language to
`calendar-redesign.md` and `dashboard-redesign.md`.

### What this screen is (information architecture)

A read-first detail page for **one** transaction. Its job, top to bottom:

1. **What & how much** — the signed amount and whether it's income or expense (the hero).
2. **What it was for** — category + note.
3. **Where it came from & when** — source (manual vs linked bank), date/time, and — for a
   couples app — **whose** transaction it is.
4. **What you can do with it** — Edit (manual only), and Split (for a shared expense).

We keep every existing field and interaction; we add structure, states, attribution, and
the split affordance the app already supports (`components/SplitTransactionModal.tsx`).

---

## 2. The detail-archetype conventions this screen adopts

Matching the settled list/detail conventions (`bills`, `calendar`, `dashboard`):

- **Background:** `<GradientBackground variant="bgDarkPurple">` — never a raw
  `LinearGradient`.
- **Header:** a fixed row OUTSIDE the ScrollView = shared `<BackButton fallback="…">`
  + `typography.h3` title ("Transaction") + a trailing action slot (the Edit icon, ≥ 44pt
  target, or an empty 40pt spacer to keep the title centered when edit is unavailable).
- **One elevated headline card:** the amount hero uses `glassEffects.glassFloating` and
  leads with the money number in `typography.h1`/`h2`. Everything below is flat
  `glassEffects.glass`.
- **Solid vs. ghosted money:** a normal posted transaction is **committed** → solid fill,
  exact amount. A **pending** bank transaction (amount not yet final) is **tentative** →
  dashed-border hero, `~`-prefixed amount, and the WORD "Pending" (see §5.1).
- **Status is always icon + word + color** — the source badge, the pending badge, and the
  type are never conveyed by color alone.
- **Semantic tint recipe:** chip/badge backgrounds = the semantic color at 12% opacity
  (`` `${token}1f` ``).
- **Loading:** `Skeleton` placeholders that hold the layout, not an `ActivityIndicator`.
- **Reuse shared components:** `GradientBackground`, `BackButton`, `Skeleton`,
  `EmptyState`, `ErrorState`, `SplitTransactionModal`, and the partner-attribution glyph
  from the calendar/dashboard specs.

---

## 3. Full-screen wireframe — default / populated

Expense, posted, manual entry, attributed to a partner. iPhone 15 Pro (390×844).

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]        Transaction                              [ ✎ ]     │  ← fixed header
│                                                                │     BackButton + title
│  ┌──────────────────────────────────────────────────────────┐ │        + Edit action
│  │                    ⌄ EXPENSE                              │ │  ┐
│  │                                                          │ │  │ HERO
│  │                   − $84.20                               │ │  │ glassFloating
│  │                                                          │ │  │ amount in h1,
│  │            [🛒]  Groceries                               │ │  │ colors.error
│  │                                                          │ │  │ category chip
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.xl gap
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │  Note                                                    │ │  │ DETAILS card
│  │  Weekly grocery run at Whole Foods                       │ │  │ glass
│  │  ────────────────────────────────────────────────────    │ │  │ (labelled rows,
│  │  🕑  Date            Tue, Jun 17 2026 · 2:14 PM          │ │  │  divider between)
│  │  ────────────────────────────────────────────────────    │ │  │
│  │  🛡  Source          ● Entered manually                  │ │  │  source = icon+word
│  │  ────────────────────────────────────────────────────    │ │  │
│  │  👤  Added by        ◑ Alex                              │ │  │  partner glyph
│  │  ────────────────────────────────────────────────────    │ │  │
│  │  🔁  Recurring       Monthly · due day 17                │ │  │  only if recurring
│  └──────────────────────────────────────────────────────────┘ │  ┘
│                                                                │  ← spacing.lg gap
│  ┌──────────────────────────────────────────────────────────┐ │  ┐
│  │  [ ✎  Edit ]                    [ ⑃  Split ]             │ │  │ ACTIONS row
│  └──────────────────────────────────────────────────────────┘ │  ┘ (see §6)
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

Layout tokens: screen padding `spacing.lg` (16) horizontal, `spacing.lg` top under the
header. Hero → details gap `spacing.xl` (24). Details → actions gap `spacing.lg` (16).
The hero is the only card that floats and the only text at `h1`.

### Income variant (posted, from a linked bank account)

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]        Transaction                              [   ]     │  ← no Edit (bank tx)
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    ⌃ INCOME                              │ │
│  │                   + $2,600.00                            │ │  colors.success
│  │            [💵]  Paycheck                                │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  🕑  Date            Fri, Jun 13 2026 · 9:02 AM          │ │
│  │  🛡  Source          ⛁ From Chase ••4021 (linked)        │ │  linked = info tint
│  │  👤  Added by        ◐ Sam                               │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  🔒 Synced from your bank — edit in the app that owns it  │ │  ← why-no-edit note
│  └──────────────────────────────────────────────────────────┘ │     (replaces actions)
└──────────────────────────────────────────────────────────────┘
```

---

## 4. States — wireframes

### 4.1 Loading (skeleton)

Reuse `components/Skeleton.tsx`. Layout-matched so nothing jumps when data arrives. The
header renders immediately (BackButton + static "Transaction" title; the Edit slot stays an
empty 40pt spacer until source is known).

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]        Transaction                              [   ]     │
│  ┌──────────────────────────────────────────────────────────┐ │  glassFloating shell
│  │              ▒▒▒▒▒▒▒                                     │ │  chip skeleton (72×20)
│  │              ▒▒▒▒▒▒▒▒▒▒▒▒▒                               │ │  hero bar (180×36)
│  │              ▒▒▒▒  ▒▒▒▒▒▒▒▒                              │ │  chip skeleton
│  └──────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐ │  glass shell
│  │  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒                       │ │  4 rows:
│  │  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒                             │ │  label+value bars
│  │  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒                         │ │  (SkeletonStack, 4)
│  │  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒                                   │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

- Hero skeleton: three stacked `Skeleton` blocks inside a `glassFloating` shell —
  chip (`height 20`, `width 72`, `radius.full`), hero (`height 36`, `width 180`,
  `radius.md`), category chip (`height 20`, `width 120`, `radius.full`), centered.
- Details skeleton: `SkeletonStack count={4}` (label + value pairs) inside a `glass` shell.
- No spinner. (A small header `ActivityIndicator` is allowed only for a background refresh
  of an already-rendered transaction.)

### 4.2 Empty — "transaction not found"

Only reachable when the id resolves to nothing (deleted, wrong id, expired deep link).
Reuse the shared `EmptyState` component.

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]        Transaction                              [   ]     │
│                                                                │
│              ┌────────────────────────────────┐                │
│              │            (  🧾  )             │                │  receipt-outline icon
│              │                                │                │
│              │     Transaction not found      │                │  title
│              │  It may have been deleted or    │                │  description
│              │  moved. Head back to your        │                │
│              │  activity to find it.           │                │
│              │                                │                │
│              │        [   Back to activity  ]  │                │  action → activity/list
│              └────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

`<EmptyState icon="receipt-outline" title="Transaction not found" description="It may have
been deleted or moved. Head back to your activity to find it." actionLabel="Back to
activity" onAction={…} />`.

### 4.3 Error — load failed

Distinct from empty: the id is valid but the fetch failed (network/500). Reuse
`ErrorState`; keep the header so the user can still go back.

```
┌──────────────────────────────────────────────────────────────┐
│  [‹]        Transaction                              [   ]     │
│              ┌────────────────────────────────┐                │
│              │            (  ⚠  )              │                │  alert-circle-outline
│              │   Couldn't load this transaction│                │  title
│              │   Check your connection and try  │                │  message
│              │   again.                        │                │
│              │     [ ↻ Try again ]  [ Dismiss ] │                │  retry / dismiss
│              └────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

`<ErrorState title="Couldn't load this transaction" message="Check your connection and try
again." retryLabel="Try again" onRetry={refetch} dismissLabel="Go back" onDismiss={back}
/>`.

### 4.4 Pending bank transaction (tentative money)

A bank transaction that hasn't settled — amount may still change. Apply the solid-vs-ghosted
metaphor to the hero (see §5.1).

```
┌──────────────────────────────────────────────────────────────┐
│  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐ │  DASHED border
│  ╎                 ⌄ EXPENSE   ◔ PENDING                    ╎ │  pending badge (warning)
│  ╎                 ~ $52.00                                 ╎ │  ~ prefix, 70% opacity
│  ╎          [🍽]  Dining                                    ╎ │
│  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘ │
│   Amount may change until it clears.                          │  caption, textMuted
└──────────────────────────────────────────────────────────────┘
```

### 4.5 Edge cases / overflow

| Case | Treatment |
|---|---|
| **Long note** | Note value wraps freely (no `numberOfLines` cap) — it's the one field that should show in full. Card grows; screen scrolls. |
| **Long category name** | Category chip in the hero `numberOfLines={1}` + ellipsis; the chip max-width is the card minus `spacing.xl` each side. |
| **Very large amount** | Hero uses `adjustsFontSizeToFit` down to `typography.h2` min so 7-figure amounts don't clip; never truncate the currency. |
| **No note** | The "Note" row is omitted entirely (not shown empty) — details card starts at Date. |
| **No category** | Category chip shows `Uncategorized` in `colors.textMuted` with a neutral `pricetag-outline` icon (no color tint). |
| **Not recurring** | The "Recurring" row is omitted. |
| **Unknown owner / solo household** | The "Added by" row is omitted (no glyph); nothing else changes. |
| **Missing date** | Fall back to "Date unavailable" in `colors.textMuted` rather than silently rendering `now`. |

---

## 5. Section / component specs

### 5.1 TransactionAmountHero (`glassFloating`)

The centerpiece. One floating card, centered content.

| Element | Spec |
|---|---|
| **Type pill** (top) | `radius.full` chip, `spacing.sm`×`spacing.xs` padding. Expense → `caret-down` icon + word `EXPENSE`, tint `colors.error` on `` `${error}1f` ``. Income → `caret-up` + `INCOME`, `colors.success` on `` `${success}1f` ``. Icon + word + color (color-independent). |
| **Amount** | `typography.h1` (32/700), sign-colored via `getValueColor`: `+`/`colors.success` for income, `-`/`colors.error` for expense. `adjustsFontSizeToFit`, `minimumFontScale` ≈ h2/h1. |
| **Category chip** (bottom) | Icon chip (`radius.md`, category color at 12%, or neutral `pricetag-outline` if uncategorized) + category name in `typography.bodyBold` `colors.text`, `numberOfLines={1}`. |
| **Pending variant** | Card border becomes `borderStyle: 'dashed'`, `colors.borderGlass`. A second pill `◔ PENDING` (`hourglass-outline` + word, `colors.warning` on `` `${warning}1f` ``). Amount prefixed `~`, rendered at ~70% opacity (or `colors.textMuted` if 70% fails contrast — see §7). Caption below card: "Amount may change until it clears." |
| Surface | `glassEffects.glassFloating`, `radius.xl`, padding `spacing.xl`, `alignItems: 'center'`. |

### 5.2 TransactionDetailsCard (`glass`)

A flat card of labelled rows, each separated by `commonStyles.divider`. Every row:
leading Ionicon (18, `colors.textMuted`) + label (`typography.caption`, `colors.textMuted`,
uppercase-ish) on the left, value (`typography.small`/`smallBold`, `colors.text`) on the
right, `minHeight: 44`, `alignItems: 'center'`.

| Row | Icon | Value | Notes |
|---|---|---|---|
| **Note** | `create-outline` | note text, `colors.text`, wraps | Omitted if empty. Full-width value under the label (not right-aligned) since notes are long. |
| **Date** | `time-outline` | `Tue, Jun 17 2026 · 2:14 PM` | Formatted, not `toLocaleString()`. "Date unavailable" fallback. |
| **Source** | `shield-checkmark-outline` | See §5.3 SourceBadge | icon + word + color. |
| **Added by** | `person-outline` | partner glyph + name (§5.4) | Omitted if unknown/solo. |
| **Recurring** | `repeat-outline` | `Monthly · due day 17` | Only if `frequency && frequency !== 'one-time'`. |

Surface `glassEffects.glass`, `radius.lg`, padding `spacing.lg`, `marginBottom` handled by
the parent gap.

### 5.3 SourceBadge (inline, color-independent)

Encodes provenance with icon + word + color — never color alone.

| Source | Icon | Word | Tint |
|---|---|---|---|
| **Manual** | `pencil` (solid dot `●` motif) | `Entered manually` | `colors.textMuted` (neutral — manual is the baseline) |
| **Linked bank** | `card` / `business-outline` | `From {bankName} ••{last4} (linked)` | `colors.info` |

Rendered as text + a leading 8px dot/icon in the tint; the whole value stays in
`colors.text` so it's legible, with the tint only on the icon/dot and the word "linked".

### 5.4 Partner attribution (Added by) — same rule as calendar/dashboard

Lightweight, additive, graceful-degrade. Match `tx.user_id` against `householdMembers`:

- Partner A → `◑` glyph tinted `colors.primary2`, then name in `colors.text`.
- Partner B → `◐` glyph tinted `colors.info`, then name.
- Household/shared or unknown owner, **or** solo household → omit the row entirely.
- No amount is ever re-colored by owner; amounts stay on the income/expense palette.

---

## 6. Actions row

A single `glass` card holding the available actions as full-width-ish buttons, ≥ 44pt tall.

### 6.1 Edit (manual transactions only)

- **Available when** `source === 'manual'` (i.e. not a linked-bank transaction) — preserves
  the current gating logic exactly.
- Button: `pencil` icon + "Edit", `typography.button`. Style: outlined glass
  (`glassEffects.glass`, `colors.borderGlass`, text `colors.primary2`). On press →
  `router.push('/transaction/edit/[id]', {…params})` (unchanged navigation).
- **Also mirrored in the header** as the trailing `✎` icon action (44pt target,
  `colors.primary2`) so the primary edit affordance is reachable at the top too. When edit
  is unavailable, the header trailing slot is an empty 40pt spacer (keeps the title
  centered) and the actions card explains why (§6.3).

### 6.2 Split (shared expense) — additive, reuses existing modal

CoupleFlow already ships `components/SplitTransactionModal.tsx`; the detail page is the
natural place to launch it. Show a **Split** action for **expense** transactions:

- Button: `git-branch-outline` (or `people-outline`) + "Split", outlined glass, text
  `colors.primary2`. Opens `SplitTransactionModal` as a bottom sheet on `colors.surface2`
  (the shared modal recipe). Hidden for income.
- If splitting isn't wired for a given transaction type/source, degrade by hiding the
  button — nothing else changes.

### 6.3 Why-no-edit note (bank transactions)

When the transaction is bank-linked (edit unavailable), the actions card is replaced by a
single info row so the absence is explained, not mysterious:

```
🔒  Synced from your bank — edit in the app that owns it.
```

`lock-closed-outline` (`colors.textMuted`), text `typography.small` `colors.textMuted`,
`glassEffects.glass` card. (Split may still appear above it for shared bank expenses if
supported.)

---

## 7. Accessibility

- **Touch targets:** header BackButton + Edit icon, and every actions-row button, are
  ≥ 44×44pt (hit-slop where visual height is smaller). Detail rows are display-only unless
  tappable; if the Source row deep-links to the linked account, it too is ≥ 44pt.
- **Color independence:** every colored signal pairs with an icon + word —
  type (`EXPENSE`/`INCOME` + caret + sign prefix), pending (`PENDING` + hourglass + `~`),
  source (`manually`/`linked` + icon), partner (glyph + name). A green number is never the
  only cue that it's income.
- **Contrast:** all text on `colors.text`/`colors.textMuted` over dark glass clears WCAG AA.
  The pending 70%-opacity amount must still clear 4.5:1; if `colors.text` @ 0.7 over the
  card fails, use `colors.textMuted` at full opacity instead of dimming `colors.text`.
  Semantic tints are backgrounds only (12%); the word/icon on them stays full-opacity
  semantic color.
- **Screen-reader order & labels:**
  - Hero reads as one node: `"Expense, 84 dollars 20 cents, Groceries."` (Pending →
    prepend `"Pending. "` and say `"about 52 dollars"`.)
  - Details rows read label → value: `"Date, Tuesday June 17 2026 at 2:14 PM."`,
    `"Source, from Chase, linked account."`, `"Added by Alex."`
  - Edit button: `label "Edit transaction"`, `hint "Opens the edit form."` Split:
    `label "Split transaction", hint "Divide this expense between you."`
  - Bank why-no-edit note is exposed as static text, not a button.
- **Reduced motion:** header/button press-scales and the hero mount use `animation.fast`;
  under reduce-motion they become instant state changes. Skeleton pulse respects the OS
  reduce-motion setting (falls back to a static muted block).

---

## 8. Mapping to design-system tokens (no magic numbers)

| Old hardcoded value (current `[id].tsx`) | Replace with token |
|---|---|
| gradient `['#0b1021','#1b0d30','#2d0c53']` | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `income` amount `#34d399` | `colors.success` (via `getValueColor`) |
| `expense` amount `#f87171` | `colors.error` (via `getValueColor`) |
| edit icon `#a855f7` | `colors.primary2` |
| meta/label text `#cbd5e1` | `colors.textMuted` |
| category text `#e5e7eb` | `colors.text` |
| label text `#cbd5e1` | `colors.textMuted` |
| card `rgba(255,255,255,0.06)` + `borderRadius:16` | hero → `glassEffects.glassFloating`; details/actions → `glassEffects.glass` (`radius.lg`) |
| card border `rgba(255,255,255,0.08)` | `colors.borderGlass` |
| iconBtn border `rgba(255,255,255,0.2)` | reuse shared `BackButton`/header icon recipe (already tokenized) |
| `amount` `fontSize:28 / fontWeight:800` | `typography.h1` (hero) |
| `category` `fontSize:16 / fontWeight:700` | `typography.bodyBold` |
| `label` `fontWeight:700` | `typography.caption` (`colors.textMuted`) |
| `note` / `meta` inline text | `typography.small` (`colors.text` / `colors.textMuted`) |
| ad-hoc paddings `20 / 16 / 10 / 8 / 6` | `spacing.xl / lg / md / sm / xs` |
| ad-hoc `borderRadius: 12 / 16` | `radius.md / lg`; pills/chips `radius.full` |
| `SafeAreaView padding:20` | `spacing.lg` horizontal + safe area (match calendar/dashboard) |
| badge/chip fills (new) | `` `${semanticToken}1f` `` (12% tint) |
| `date.toLocaleString()` | formatted `Tue, Jun 17 2026 · 2:14 PM` |

Hard rule (from the redesign convention): after redesign, no literal hex/rgba/px remain
except the documented 12% (`1f`) semantic tints.

---

## 9. Developer notes

- **Prefer fetching by id over trusting route params.** The current screen reconstructs the
  transaction purely from params, which is why it can render a wrong-but-confident
  `$0.00 / Uncategorized / now`. Fetch the transaction by `id` (as `edit/[id].tsx` already
  does via `/auth/transactions` filtered client-side) to drive the real
  loading/empty/error states in §4. Route params may still be used as an **optimistic
  first paint** (render the hero instantly from params, then reconcile) — but the states
  and "not found" must key off the fetch, not the params.
- **Preserve the edit gate exactly:** edit is available iff `source === 'manual'` (the
  current code's `source === 'manual' || source !== 'bank'` is equivalent to "not bank" —
  keep that behavior). Bank transactions show the why-no-edit note (§6.3) instead.
- **Reuse, don't reimplement:** `GradientBackground` (bg), `BackButton` (header),
  `Skeleton` + `SkeletonStack` (loading), `EmptyState` (not-found), `ErrorState`
  (load-failed), `SplitTransactionModal` (split). Do not build new one-off versions.
- **Partner glyph mapping mirrors the calendar/dashboard specs exactly** (A → `primary2`/
  `◑`, B → `info`/`◐`, shared/unknown/solo → omit) for cross-screen consistency. If
  `user_id`/`householdMembers` aren't available yet, the "Added by" row simply doesn't
  render — additive, graceful.
- **Pending detection:** if the API exposes a pending/settled flag on bank transactions,
  drive §5.1's dashed/`~`/`PENDING` treatment off it. If not yet available, ship the hero
  in its solid form only — the pending variant is additive and can land later without a
  re-layout.
- **Split visibility:** show Split for `type === 'expense'` only; hide for income and where
  the modal isn't wired. Keep the modal on the shared bottom-sheet recipe
  (`colors.surface2`, `gradients.primaryGradient` primary button).
- **Date formatting** should use a shared formatter (weekday, short month, day, year · time)
  rather than `toLocaleString()` so it reads consistently with the calendar's day labels.

---

## 10. Handoff checklist

- [x] Background swapped to `<GradientBackground variant="bgDarkPurple">`
- [x] Titled header (BackButton + `typography.h3` "Transaction" + Edit action / spacer)
- [x] Amount hero defined as the only `glassFloating` / `h1` element, sign-colored
- [x] Details card defined as flat `glass` labelled rows with dividers
- [x] Solid-vs-ghosted metaphor applied (pending = dashed + `~` + "PENDING" word)
- [x] Source badge is icon + word + color (manual vs linked, color-independent)
- [x] Couples attribution ("Added by") as additive, graceful-degrade glyph
- [x] Edit gate preserved (manual only) + why-no-edit note for bank transactions
- [x] Split action added, reusing existing `SplitTransactionModal`
- [x] All states designed (default, income, pending, loading skeleton, empty/not-found, error, overflow)
- [x] Every old hardcoded value mapped to a design-system token (no magic numbers)
- [x] Accessibility: 44pt targets, color-independent status, SR order/labels, reduced motion
- [x] Component specs written (`docs/design/components/transaction-detail-*.json`)
```
