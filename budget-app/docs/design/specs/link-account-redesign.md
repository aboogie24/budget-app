# Link Account Screen — Redesign Specification

**Product:** CoupleFlow (React Native / Expo, dark theme, glassmorphic)
**Status:** Design handoff — implementation by frontend agent
**Route / file:** `link-account` → `budget-app/app/link-account.tsx`
**Archetype:** form / flow (provider-selection → connect → linked-list management)
**Source of truth for tokens:** `budget-app/utils/design-system.ts`
**Replaces:** the bespoke, locally-styled screen currently in `link-account.tsx`

---

## 1. Why this redesign exists

The link-account screen works, but it is visually a **different app** from the two
reference screens (`dashboard.tsx`, `calendar.tsx`). It never touches the design system —
it re-invents every color, gradient, surface, radius, and font as a local literal. Placed
next to Accounts or Dashboard, its purple is subtly wrong and its cards don't match.

Concrete offenders in the current file:

- **Its own background gradient** `['#0b1021','#2b0f50','#1b1039']` via a raw
  `LinearGradient` (used in five places: main render, native flow, both WebView modals,
  loading state), instead of the shared `<GradientBackground variant="bgDarkPurple">`
  (`gradients.bgDarkPurple = ['#0f172a','#1a0a40','#0f172a']`). This is the #1 reason the
  screen reads off-brand next to its siblings.
- **A private provider color palette** — Plaid `#60a5fa`, Flinks `#34d399`, Teller
  `#f59e0b`, plus `#a855f7` for the selected check and `#c084fc` sprinkled everywhere —
  that duplicates and drifts from `colors.info / success / warning / primary2 / accent`.
- **Hardcoded status colors** — reauth `#f59e0b`, unlink `#f87171`, error text `#f87171` —
  instead of `colors.warning` / `colors.error`.
- **Magic numbers everywhere** — `borderRadius: 14/16/20`, `padding: 16`, `fontSize:
  26/17/13/12`, `fontWeight: '800'`, ad-hoc `rgba(255,255,255,0.0x)` glass fills,
  `marginHorizontal: 16` on buttons — none tokenized.
- **A raw full-screen `ActivityIndicator`** loading state and **no dedicated error state**
  (errors are a lone red `Text` line, and connection failures are `Alert.alert`), while the
  reference screens use `components/Skeleton.tsx` and inline glass error cards.
- **A hand-rolled `centered` hero layout** (`scrollContent: { justifyContent: 'center' }`)
  that centers the whole page vertically — which fights the standard top-aligned header +
  scroll layout every other screen uses, and breaks the moment the linked list grows.
- **Two provider WebView modals** with a duplicated bespoke header (`webViewHeader`,
  `webViewCloseBtn`, `webViewTitle`) that is close to — but not — the standard header.

This redesign changes **skin, not skeleton**. Every capability is preserved: fetch
providers, choose a provider, connect (Plaid browser / native SDK, Flinks WebView, Teller
WebView), list linked accounts, reconnect a disconnected Teller enrollment, unlink, and
sync-all. We keep it recognizably the same screen and make three small
information-architecture improvements that clearly help (§3).

---

## 2. Shared conventions this screen must obey (from dashboard / calendar / accounts)

Because this is one screen in a unified app, it adopts the exact patterns the reference
screens established. This screen is the **form/flow** sibling of the **summary+list**
Accounts screen, so its header, list rows, group labels, empty/error/loading states, and
CTA styling are lifted verbatim from that family.

| Convention | Rule |
|---|---|
| **Background** | `<GradientBackground variant="bgDarkPurple">` wrapping `SafeAreaView`. Never a local `LinearGradient` — including inside the two WebView modals and the native-Plaid flow. |
| **Header row** | `flexDirection:'row'`, `alignItems:'center'`, `paddingHorizontal: spacing.lg`, `paddingTop: spacing.sm`, `paddingBottom: spacing.md`; `<BackButton fallback="/(tabs)/accounts" color={colors.primary2} />` at left; title `Link Account` in `typography.bodyBold` `colors.text`; right = background-refresh `ActivityIndicator` (`colors.primary2`) shown only during a silent providers/accounts refetch. |
| **Scroll padding** | `paddingHorizontal: spacing.lg`, `paddingTop: spacing.sm`, `paddingBottom: 120` (clears tab bar). Content is **top-aligned**, not vertically centered. |
| **Cards** | `glassEffects.glass` (flat, `radius.lg`) for normal cards (provider cards, account rows container). `glassEffects.glassFloating` (`radius.xl` + shadow) reserved for the ONE hero/intro card at top — same "only the headline floats" rule. |
| **Group labels** | Uppercase `typography.caption`, `colors.textMuted`, `letterSpacing: 0.6`, `fontWeight:'700'` (e.g. `CHOOSE A PROVIDER`, `LINKED ACCOUNTS`). Replaces the current `providerSectionTitle`. |
| **List rows** | icon chip 40×40 `radius.md` tinted `${color}1f` (12% hex-alpha); name `typography.smallBold` `colors.text`; subtitle `typography.caption` `colors.textMuted`; right-aligned trailing action `flexShrink:0`; row `minHeight: 44`. Same contract as Accounts' `AccountRow`. |
| **Primary CTA** | full-width, `gradients.primaryGradient` fill, `radius.lg`, `paddingVertical: spacing.md`, `minHeight: 48`, label `typography.button` `colors.text`. |
| **Secondary CTA** | `${colors.primary2}0a` fill + `colors.primary2` border, same metrics — used for Sync Now and Link-Another. |
| **Loading** | `Skeleton` / `SkeletonStack` matching final layout; no full-screen spinner. |
| **Error** | inline `glassEffects.glass` card with `alert-circle-outline` (`colors.error`) + Retry text button; never a blank screen or bare red line. |
| **Trust footer** | keep `lock-closed-outline` + "Bank-level encryption · Read-only access", retokenized to `colors.textMuted` / `typography.caption`. |

---

## 3. Information-architecture improvements (kept minimal, each justified)

The screen keeps every existing capability. Three small IA changes make it read better
without making it a different screen:

1. **Always show the linked accounts first, then the "add" affordance below.** Today the
   layout centers a hero and the intent (link vs. manage) flips the title. Reframe as a
   stable top-to-bottom flow: **(intro card) → LINKED ACCOUNTS list → CHOOSE A PROVIDER /
   Connect → trust footer**. When there are zero accounts, the list section is replaced by
   the empty state; the provider chooser stays put. *Why:* one predictable scroll order
   whether the user has 0 or 5 accounts, instead of a layout that reflows around emptiness.

2. **Provider selection is a radio-group of glass rows, not free-floating bordered cards.**
   Wrap the provider options in a single `CHOOSE A PROVIDER` group (glass card), each option
   a selectable row using the shared list-row contract with a trailing radio/check. This
   collapses the three near-identical bespoke `providerCard` blocks into one row component
   driven by a data array. *Why:* removes ~120 lines of duplicated JSX, and makes the picker
   match every other list on the screen. Selected state = `colors.primary2` ring + filled
   `checkmark-circle`; feature bullets stay as a caption row.

3. **Reconnect / needs-attention gets promoted to the shared `AttentionCard` pattern.**
   When any Teller enrollment is `login_required`, surface it as an `AttentionCard`-style
   banner at the very top of the list (icon + word + Reconnect CTA), instead of only an
   inline amber Reconnect button buried in the row. The per-row Reconnect button stays too
   (in-context), but the banner guarantees the user sees it. *Why:* reconnect is the single
   highest-value action on this screen and currently hides inside a list row. This mirrors
   how `AttentionCard` already routes `reconnect` back to `/link-account`.

Everything else (Plaid browser + native SDK paths, Flinks WebView, Teller WebView + message
handling, unlink confirm, sync-all summary alert, provider-availability gating) is preserved.

---

## 4. Full-screen wireframes

### 4a. Default / populated — has linked accounts + provider choice

iPhone 15 Pro (390×844). Top-aligned, scrolls.

```
┌──────────────────────────────────────────────────────────────┐
│  (‹)   Link Account                              (◐ refresh)   │  ← BackButton + title + silent-refresh
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  ← INTRO card (glassFloating, radius.xl)
│  │            ╭──────────╮                                    │ │
│  │            │    🔗     │   ← 64×64 circle, ${primary2}1a   │ │
│  │            ╰──────────╯                                    │ │
│  │        Link your bank                    ← typography.h3   │ │
│  │  Securely sync transactions across your household.        │ │  ← typography.small textMuted
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐ │  ← ATTENTION banner (only if reauth)
│  │ ⚠  1 account needs reconnecting        [ ⟳ Reconnect ]   │ │    warning tint, icon+word+CTA
│  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘ │
│                                                                │
│  LINKED ACCOUNTS · 2                                           │  ← group label (uppercase caption)
│  ┌──────────────────────────────────────────────────────────┐ │  ← glass card, rows + dividers
│  │ [🏦] Chase                    [PLAID]            (🗑)      │ │  ← LinkedAccountRow (actual)
│  │      Linked Jun 12, 2026                                   │ │    subtitle: linked date
│  │ ────────────────────────────────────────────────────────  │ │
│  │ [⚠] Wells Fargo               [TELLER]  [⟳]     (🗑)      │ │  ← reauth row: warning icon + Reconnect
│  │      Reconnect needed — login expired                     │ │    subtitle = warning word, not color-only
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  ← Secondary CTA (primary2 outline)
│  │            ⟳  Sync Now                                     │ │    spinner + "Syncing…" while busy
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  CHOOSE A PROVIDER                                             │  ← group label
│  ┌──────────────────────────────────────────────────────────┐ │  ← glass card, provider radio rows
│  │ [🛡] Plaid                                        ( ◉ )   │ │  ← selected: filled check, primary2 ring
│  │      12,000+ US institutions                              │ │
│  │      ✓ Instant verification   ✓ Real-time updates         │ │  ← feature caption row
│  │ ────────────────────────────────────────────────────────  │ │
│  │ [🌐] Flinks                                       ( ○ )   │ │  ← unselected radio
│  │      15,000+ North American institutions                  │ │
│  │      ✓ Strong Canadian coverage  ✓ OAuth + scraping       │ │
│  │ ────────────────────────────────────────────────────────  │ │
│  │ [🏢] Teller                                       ( ○ )   │ │
│  │      US banks & credit unions                             │ │
│  │      ✓ Fast US coverage   ✓ Read-only access              │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  ← Primary CTA (primaryGradient)
│  │            🛡  Connect with Plaid                          │ │    disabled until a provider is picked
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│         🔒  Bank-level encryption · Read-only access          │  ← trust footer (caption, textMuted)
└──────────────────────────────────────────────────────────────┘
```

When only Plaid is available (`showProviderSelection === false`), the `CHOOSE A PROVIDER`
group is omitted and the primary CTA is a direct **Connect with Plaid** (or **Link Another
Account** when accounts already exist) — exactly the current fallback behavior, retokenized.

### 4b. Empty (no linked accounts yet)

The intro card + provider chooser stay; the `LINKED ACCOUNTS` section is replaced by a
friendly empty block. (Native-Plaid-SDK path shows the same intro + single Connect CTA.)

```
┌──────────────────────────────────────────────────────────────┐
│  (‹)   Link Account                                           │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  intro card (glassFloating)
│  │            ╭──────────╮                                    │ │
│  │            │    🔗     │                                   │ │
│  │            ╰──────────╯                                    │ │
│  │        Link your bank                                     │ │
│  │  Securely sync transactions across your household.        │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  CHOOSE A PROVIDER                                             │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ [🛡] Plaid                                        ( ○ )   │ │
│  │ [🌐] Flinks                                       ( ○ )   │ │
│  │ [🏢] Teller                                       ( ○ )   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │            🛡  Select a provider                          │ │  disabled until picked
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│         🔒  Bank-level encryption · Read-only access          │
└──────────────────────────────────────────────────────────────┘
```

### 4c. Loading (skeleton — reuse `components/Skeleton.tsx`)

Header renders immediately (static). The intro card renders immediately (static copy).
Body below is a skeleton matching the final layout so nothing jumps when providers +
accounts land. Replaces the current centered full-screen `ActivityIndicator`.

```
┌──────────────────────────────────────────────────────────────┐
│  (‹)   Link Account                              (◐ refresh)   │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  intro card (static)
│  │            🔗   Link your bank …                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ▨▨▨▨▨▨▨▨▨▨   (group label skel, w120 h10)                    │
│  ┌──────────────────────────────────────────────────────────┐ │  glass shell
│  │ [▨▨] ▨▨▨▨▨▨▨▨▨▨              ▨▨▨▨      ← linked row skel×2 │ │  chip 40 + name 60% + trailing
│  │      ▨▨▨▨▨▨                                                │ │
│  │ ──────────────────────────────────────────────────────    │ │
│  │ [▨▨] ▨▨▨▨▨▨                  ▨▨▨▨                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ▨▨▨▨▨▨▨▨▨▨   (CHOOSE A PROVIDER skel)                        │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ [▨▨] ▨▨▨▨▨▨▨▨              ( ▨ )   ← provider row skel×3   │ │
│  │ [▨▨] ▨▨▨▨▨▨                ( ▨ )                          │ │
│  │ [▨▨] ▨▨▨▨▨▨▨▨              ( ▨ )                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│  ▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨   (CTA skel, h48)      │
└──────────────────────────────────────────────────────────────┘
```

Skeleton row shape (reuse the Accounts skel-row): `Skeleton 40×40 radius.md` chip ·
`Skeleton 60% h12` name over `Skeleton 40% h10` sub · trailing `Skeleton 24 h24 radius.full`
(radio) or `Skeleton 60 h14` (linked-date), inside a `flexDirection:'row'`, `gap: spacing.md`
row. The CTA is a `Skeleton height={48} borderRadius={radius.lg}`.

### 4d. Error (link-token / providers fetch failed)

Inline glass card; the screen is not blanked. Replaces the current bare red `Text` line and
the `Alert.alert` for token failures. Connection-in-progress failures (Flinks/Teller
`failure` events) can remain `Alert.alert` since they're transient and modal-scoped, but the
**link-token / providers** load error becomes this card so the user can retry inline.

```
┌──────────────────────────────────────────────────────────────┐
│  (‹)   Link Account                                           │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │  glass card
│  │                       ⚠  (colors.error)                    │ │
│  │              Couldn't start bank linking                   │ │  typography.bodyBold
│  │        Check your connection and try again.                │ │  typography.small textMuted
│  │                   [  ⟳  Retry  ]                           │ │  text button, colors.primary2, 44 target
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 4e. Connecting (provider handoff in progress)

While `linking` / `flinksLoading` / `tellerLoading` is true, the primary CTA shows an inline
spinner + `Connecting via {Provider}…`; the provider rows are dimmed and non-interactive
(`opacity: 0.5`, `pointerEvents: 'none'`). This is the existing `busy` behavior, retokenized.

### 4f. Provider WebView modal (Flinks / Teller)

Both modals share one component. The bespoke `webViewHeader` is replaced by the **standard
header**: `<GradientBackground variant="bgDarkPurple">` → `SafeAreaView` → header row with a
`BackButton`-style close (`iconName="close"`, `color={colors.primary2}`) + title
`Connect with {Provider}` in `typography.bodyBold`. The WebView loading overlay uses the
tokenized copy + `colors.primary2` spinner over a `colors.surfaceDark` scrim.

```
┌──────────────────────────────────────────────────────────────┐
│  (✕)   Connect with Teller                                    │  ← standard header, close = primary2
│  ────────────────────────────────────────────────────────────│  ← border: colors.borderLight
│                                                                │
│                      [  provider web content  ]                │
│                                                                │
│              (loading overlay: ◐ + "Loading Teller Connect…")  │
└──────────────────────────────────────────────────────────────┘
```

### 4g. Overflow / edge cases

- **Long institution name** → `numberOfLines={1}` + ellipsis on the account name; the
  provider badge and trailing icons never truncate (`flexShrink: 0`).
- **Long reauth subtitle** → single line ellipsized; the amber word "Reconnect needed" stays.
- **Many linked accounts** → the `LINKED ACCOUNTS` glass card grows; the whole screen scrolls
  (no inner `FlatList maxHeight` — drop the current `list: { maxHeight: 280 }`).
- **Provider unavailable** → row simply not rendered (unchanged availability gating); if only
  Plaid remains, the chooser group is omitted entirely.
- **No provider selected** → primary CTA label `Select a provider`, `disabled`, `opacity 0.5`.

---

## 5. Token mapping — every hardcoded value → design-system token

| Old hardcoded value (in `link-account.tsx`) | Replace with token |
|---|---|
| `<LinearGradient colors={['#0b1021','#2b0f50','#1b1039']}>` (×5: main, native, 2 modals, loading) | `<GradientBackground variant="bgDarkPurple">` (`gradients.bgDarkPurple`) |
| `BackButton color="#c084fc"` | `colors.primary2` |
| hero `iconCircle` `'rgba(192,132,252,0.15)'` + icon `#c084fc` | `${colors.primary2}1a` fill + `colors.primary2` icon |
| `title '#fff' 26/800` | `typography.h3` + `colors.text` |
| `subtitle '#94a3b8' 14` | `typography.small` + `colors.textMuted` |
| `error '#f87171'` text line | inline error card: `alert-circle-outline` `colors.error` + Retry |
| `accountCard 'rgba(255,255,255,0.06)'` fill + `'rgba(192,132,252,0.15)'` border | plain row inside one `glassEffects.glass` card; divider = `colors.borderLight` (no per-row fill) |
| `accountIcon 'rgba(192,132,252,0.12)'` + icon `#c084fc` | chip 40×40 `radius.md`, `${colors.primary2}1f` fill, `colors.primary2` icon (`business-outline`) |
| reauth icon `#f59e0b` (`warning-outline`) | `colors.warning` |
| `accountName '#fff' 16/600` | `typography.smallBold` + `colors.text` |
| `accountMeta '#94a3b8' 12` | `typography.caption` + `colors.textMuted` |
| `accountReauth '#f59e0b' 12/600` | `typography.caption` `fontWeight:'700'` + `colors.warning` |
| `reconnectBtn 'rgba(245,158,11,0.15)'` fill + `'rgba(245,158,11,0.4)'` border + `#f59e0b` text | `${colors.warning}26` fill + `${colors.warning}66` border + `colors.warning` text, `radius.md` |
| `unlinkBtn 'rgba(248,113,113,0.1)'` + icon `#f87171` | `${colors.error}1a` fill + `colors.error` icon (`trash-outline`) |
| `button '#7c3aed'` fill, `marginHorizontal:16`, `borderRadius:14`, `paddingVertical:16` | `gradients.primaryGradient` fill (use `LinearGradient`/`GlassCard`-style), full width, `radius.lg`, `paddingVertical: spacing.md`, `minHeight:48` |
| `buttonText '#fff' 16/700` | `typography.button` + `colors.text` |
| `buttonDisabled { opacity: 0.5 }` | keep, but express as `opacity: 0.5` on the token'd button |
| `syncButton 'rgba(192,132,252,0.12)'` fill + `'rgba(192,132,252,0.25)'` border | `${colors.primary2}1f` fill + `${colors.primary2}40` border, `radius.lg` |
| `syncButtonText '#c084fc' 15/600` | `typography.smallBold` + `colors.primary2` |
| `trustRow` / `trustText '#94a3b8' 12` + icon `#94a3b8` | `typography.caption` + `colors.textMuted` icon & text |
| `providerSectionTitle '#94a3b8' 13/600 uppercase ls0.8 mL20` | group label: uppercase `typography.caption`, `colors.textMuted`, `letterSpacing:0.6`, `fontWeight:'700'` |
| `providerCard 'rgba(255,255,255,0.04)'` fill + `'rgba(255,255,255,0.06)'` border, `borderRadius:16`, `mH:16` | rows inside one `glassEffects.glass` card; per-row divider `colors.borderLight` |
| `providerCardSelected` `#a855f7` 2px border + `'rgba(168,85,247,0.06)'` fill | selected row: `colors.primary2` and `${colors.primary2}0f` row tint |
| `providerIconWrap` `'rgba(96,165,250,0.12)'`/`'rgba(52,211,153,0.12)'`/`'rgba(245,158,11,0.12)'` + icons `#60a5fa`/`#34d399`/`#f59e0b` | chip `${providerColor}1f`; Plaid → `colors.info`, Flinks → `colors.success`, Teller → `colors.warning` |
| `providerName '#fff' 17/700` | `typography.smallBold` (or `typography.bodyBold`) + `colors.text` |
| `providerDesc '#94a3b8' 13` | `typography.caption` + `colors.textMuted` |
| `providerCheck` icon `#a855f7` (`checkmark-circle`) | `colors.primary2` |
| `featureText '#94a3b8' 12` + `checkmark` `#94a3b8` | `typography.caption` + `colors.textMuted` |
| `providerBadge` `${color}20` fill / `providerBadgeText 10/700 uppercase` | `${providerColor}1f` fill + `providerColor` text, uppercase `typography.caption` (fontSize 10) |
| provider badge colors flinks `#34d399` / teller `#f59e0b` / plaid `#60a5fa` | `colors.success` / `colors.warning` / `colors.info` |
| `webViewHeader` `'rgba(255,255,255,0.08)'` border | standard header + `colors.borderLight` bottom border |
| `webViewCloseBtn 'rgba(255,255,255,0.08)'` + icon `#c084fc` | `BackButton`-style close, `colors.primary2` |
| `webViewTitle '#fff' 17/700` | `typography.bodyBold` + `colors.text` |
| `webViewLoading` bg `#0b1021` + spinner `#c084fc` | `colors.surfaceDark` scrim + `colors.primary2` spinner |
| `webViewLoadingText '#94a3b8' 14` | `typography.small` + `colors.textMuted` |
| `safeArea { paddingHorizontal: 24 }` | `spacing.lg` on the scroll content, not the safe area |
| `heroWrap marginBottom:24` / `iconCircle 80×80 mb:20` | `spacing.xl` / 64×64 circle + `spacing.lg` |
| all `borderRadius: 14/16/18/20/22` | `radius.md`(12) / `radius.lg`(16) / `radius.xl`(20) |
| all ad-hoc `padding/margin 8/10/12/14/16/24` | `spacing.sm / md / lg / xl` |
| `scrollContent { justifyContent: 'center' }` | top-aligned; remove centering |

**Rule:** after this pass, `link-account.tsx` imports `colors, gradients, glassEffects,
spacing, radius, typography` from `design-system.ts` and contains **zero** hex/rgba literals
and **zero** raw numeric spacing/radius/font values. Provider-specific colors come from a
small map onto `colors.info / success / warning`.

---

## 6. Section / component specs

Reuse shared components (`GradientBackground`, `Skeleton`/`SkeletonStack`, `BackButton`,
and the `AttentionCard` pattern). Three small new sub-components are proposed, all
filename-prefixed `link-account-` in `docs/design/components/`:
`link-account-provider-row`, `link-account-linked-row`, `link-account-connect-cta`.

### 6.1 Header (reuse pattern, not a new component)

- Row: `paddingHorizontal: spacing.lg`, `paddingTop: spacing.sm`, `paddingBottom: spacing.md`.
- Left: `<BackButton fallback="/(tabs)/accounts" color={colors.primary2} />`. (Current
  fallback is `/linked-accounts`; keep whatever the router history dictates — `accounts` is
  the canonical parent for this flow. Confirm at implementation.)
- Center: title `Link Account` in `typography.bodyBold`, `colors.text`.
- Right: background-refresh `ActivityIndicator` (`colors.primary2`, `size="small"`), visible
  only while a silent providers/accounts refetch runs (mirrors dashboard). 40×40 slot even
  when hidden, so the title stays centered.

### 6.2 Intro card (the ONE `glassFloating` card)

- `glassEffects.glassFloating`, `padding: spacing.xl`, `radius.xl`, `alignItems:'center'`.
- 64×64 circle, `${colors.primary2}1a` fill, `link-outline` (`colors.primary2`, size 32),
  `marginBottom: spacing.lg`.
- Title `Link your bank` in `typography.h3`, `colors.text`.
- Body `Securely sync transactions across your household.` in `typography.small`,
  `colors.textMuted`, centered. (Couples-flavored copy; keep it warm and household-oriented.)
- Static in all states (renders during loading too). No title-flip logic — the list section
  below carries the "manage vs. link" distinction now.

### 6.3 Reconnect AttentionCard banner (reuse `AttentionCard` pattern)

- Rendered only when `accounts.some(a => a.item_status === 'login_required')`.
- Uses the existing `AttentionCard` visual contract: `${colors.warning}0d` fill,
  `${colors.warning}2e` border, `radius.lg`, `alert-circle` (`colors.warning`) + uppercase
  caption header `NEEDS YOUR ATTENTION`.
- One row per disconnected account: `warning-outline` chip + `{institution} needs
  reconnecting` (`typography.small` `colors.text`) + trailing CTA `Reconnect`
  (`${colors.warning}1f` fill, `${colors.warning}66` border, `colors.warning` text) →
  `openTellerConnect(item.item_id)`.
- Only Teller enrollments are reconnectable in-app today (`canReconnect = needsReauth &&
  provider === 'teller'`); non-Teller reauth rows show the banner copy but no CTA (or route
  to the provider's flow if/when supported).

### 6.4 `link-account-linked-row` (new — implements the shared list-row contract)

- Props: `institutionName`, `provider` (`plaid|flinks|teller`), `createdAt` (ISO),
  `itemStatus?` (`login_required|null`), `canReconnect:boolean`, `onReconnect?`, `onUnlink`.
- Layout: row `flexDirection:'row'`, `alignItems:'center'`, `gap: spacing.md`,
  `paddingVertical: spacing.md`, `minHeight: 44`. Inside one `glassEffects.glass` card,
  rows separated by `colors.borderLight` 1px dividers.
  - icon chip 40×40 `radius.md`: default `${colors.primary2}1f` fill + `business-outline`
    (`colors.primary2`); reauth `${colors.warning}1f` fill + `warning-outline`
    (`colors.warning`).
  - middle (`flex:1, minWidth:0`): name row = `{institution}` `typography.smallBold`
    `colors.text` `numberOfLines={1}` + provider badge (see 6.4a); subtitle
    `typography.caption` `colors.textMuted` = `Linked {localeDate}`, OR when reauth =
    `Reconnect needed — login expired` in `colors.warning` (word carries the status, not
    color alone).
  - right (`flexShrink:0`, row, `gap: spacing.sm`): optional Reconnect pill (when
    `canReconnect`) + unlink icon button (36×36, `${colors.error}1a`, `trash-outline`
    `colors.error`, `hitSlop` to 44).
- States: `default`, `reauth` (warning chip + warning subtitle + Reconnect pill), `pressed`.
- A11y: unlink button `accessibilityRole="button"`, label `Unlink {institution}`; Reconnect
  button label `Reconnect {institution}`.

#### 6.4a Provider badge (inline)

- Small pill: `${providerColor}1f` fill, `radius.sm`, `paddingHorizontal: spacing.sm`,
  `paddingVertical: 2`; text uppercase `typography.caption` (fontSize 10, `fontWeight:'700'`,
  `letterSpacing:0.5`) in `providerColor`.
- Colors: `plaid → colors.info`, `flinks → colors.success`, `teller → colors.warning`.
- Never the only signal — it's a label; the row is already identified by institution name.

### 6.5 `link-account-provider-row` (new — the radio-group option)

- Props: `provider` (`plaid|flinks|teller`), `title`, `description`, `features: string[]`
  (max 2), `selected:boolean`, `disabled:boolean`, `onPress`.
- Layout: `TouchableOpacity`, `activeOpacity:0.7`, `paddingVertical: spacing.md`,
  `minHeight: 44`. Inside one `CHOOSE A PROVIDER` `glassEffects.glass` card, rows separated
  by `colors.borderLight` dividers. Selected row gets a `${colors.primary2}0f` tint.
  - top row: icon chip 40×40 `radius.md` `${providerColor}1f` + provider icon
    (Plaid `shield-checkmark-outline`, Flinks `globe-outline`, Teller `business-outline`) in
    `providerColor`; title `typography.smallBold` `colors.text` + description
    `typography.caption` `colors.textMuted`; trailing radio (24×24): selected =
    `checkmark-circle` (`colors.primary2`), unselected = `ellipse-outline` (`colors.textMuted`).
  - feature caption row (indented under the text column): each feature = `checkmark` (14,
    `colors.textMuted`) + `typography.caption` `colors.textMuted`, `gap: spacing.md`.
- Provider colors: `plaid → colors.info`, `flinks → colors.success`, `teller → colors.warning`.
- States: `default`, `selected` (primary2 ring/check + row tint), `disabled` (opacity 0.5,
  non-interactive while a connection is in flight).
- A11y: `accessibilityRole="radio"`, `accessibilityState={{ selected, disabled }}`, label
  `{title}, {description}`.

### 6.6 `link-account-connect-cta` (new — primary + secondary connect buttons)

- Primary variant: `gradients.primaryGradient` fill (via `LinearGradient`), full width,
  `radius.lg`, `paddingVertical: spacing.md`, `minHeight: 48`, centered row = leading icon
  (24) + label `typography.button` `colors.text`. Disabled (`opacity 0.5`) when no provider
  selected or `busy`. Busy → inline `ActivityIndicator` (`colors.text`) + `Connecting via
  {Provider}…`. Label logic preserved: `Select a provider` / `Connect with {Provider}` /
  `Link Another Account` / `Connect with Plaid` / `Opening Plaid…`.
- Secondary variant (Sync Now): `${colors.primary2}1f` fill + `${colors.primary2}40` border,
  same metrics, `sync-outline` + `Sync Now` in `typography.smallBold` `colors.primary2`;
  busy → spinner + `Syncing…`.
- A11y: `accessibilityRole="button"`, `accessibilityState={{ disabled: !provider || busy }}`,
  label matches the visible text.

### 6.7 Provider WebView modal (retokenize the two existing modals into one)

- `<Modal presentationStyle="fullScreen">` → `<GradientBackground variant="bgDarkPurple">` →
  `SafeAreaView`.
- Header = standard header row: close button (`BackButton`-style, `iconName="close"`,
  `color={colors.primary2}`) + title `Connect with {Provider}` (`typography.bodyBold`
  `colors.text`) + 40px spacer; bottom border `colors.borderLight`.
- `WebView` fills the rest; loading overlay = `colors.surfaceDark` scrim + `colors.primary2`
  spinner + `Loading {Provider} Connect…` (`typography.small` `colors.textMuted`).
- Flinks uses `onNavigationStateChange` / `onShouldStartLoadWithRequest`; Teller uses
  `onMessage` — both handlers unchanged, only the chrome is retokenized.

### 6.8 Empty & Error states

- **Empty** (no accounts): the `LINKED ACCOUNTS` section is replaced by nothing (the intro
  card already sets context); the chooser + CTA carry the action. No separate empty
  illustration needed since the intro card is always present.
- **Error** (link-token / providers load failed): `glassEffects.glass` card,
  `alert-circle-outline` (`colors.error`), title `Couldn't start bank linking`
  (`typography.bodyBold`), body `Check your connection and try again.` (`typography.small`
  `colors.textMuted`), text `Retry` button (`colors.primary2`, `minHeight: 44`) →
  `fetchLinkToken()` + `fetchProviders()`.

---

## 7. Accessibility

- **Touch targets ≥ 44×44:** header icon slot 40×40 + `hitSlop`; provider rows, linked rows,
  and section headers use `minHeight: 44`; unlink/reconnect icon buttons 36×36 + `hitSlop` to
  44; primary CTA `minHeight: 48`.
- **Color-independent status:** every status is icon + word + color, never color alone —
  reauth row (`warning-outline` + "Reconnect needed" + amber), provider selection (filled
  `checkmark-circle` vs. `ellipse-outline`, not just tint), provider badges (uppercase text
  label, not a bare colored dot), Sync/Connect busy states (spinner + word). A red/green- or
  amber-blind user parses the whole screen.
- **Screen-reader order:** header → intro card → reconnect banner (if present) → LINKED
  ACCOUNTS group label → account rows top-to-bottom (each: `{institution}, {provider},
  {linked date OR reconnect needed}`) → Sync Now → CHOOSE A PROVIDER group label →
  provider radios (announced as a radio group with selected state) → Connect CTA →
  trust footer.
- **Radio semantics:** provider group exposed with `accessibilityRole="radiogroup"` (or
  each row `role="radio"` + `accessibilityState.selected`) so VoiceOver announces
  "selected / not selected, N of 3".
- **Contrast:** all text on `colors.text` / `colors.textMuted` over dark glass; muted
  captions must clear 4.5:1 — `colors.textMuted (#94a3b8)` over the glass surface passes.
  Do not dim `colors.text` below full opacity for meaningful text; use `textMuted` instead.
- **Reduced motion:** Skeleton pulse, sync-icon spin, and any selection transition respect
  reduce-motion — under it, Skeleton renders at fixed opacity, the sync icon shows a static
  in-progress state, and selection changes instantly (`animation.fast` otherwise).
- **WebView modals:** the close button has `accessibilityLabel="Close"`; the modal traps
  focus and returns focus to the Connect CTA on dismiss.

---

## 8. Developer notes

- Wrap the screen — and both WebView modals, and the native-Plaid flow — in
  `<GradientBackground variant="bgDarkPurple">` → `SafeAreaView`; delete every local
  `LinearGradient` and the unused `backBtn` style.
- Collapse the three bespoke `providerCard` JSX blocks into a single
  `link-account-provider-row` mapped over a `providers` array; derive provider color/icon
  from a small map onto `colors.info/success/warning`. Keep the availability gating
  (`isFlinksAvailable`, `isTellerAvailable`) and the `showProviderSelection` fallback.
- Reuse `components/Skeleton.tsx` (+ `SkeletonStack`) for §4c, `components/BackButton.tsx`
  for the header and modal-close, `<GradientBackground>` for all backgrounds, and the
  `AttentionCard` visual pattern for the reconnect banner — do not re-implement any of them.
- Drop `list: { maxHeight: 280 }` and the `FlatList` in favor of mapping rows inside one
  glass card; the outer `ScrollView` already scrolls the page.
- Keep all state and handlers as-is: `loadAccounts`, `fetchLinkToken`, `fetchProviders`,
  `exchangeToken`, `openPlaidBrowser`, `NativePlaidFlow`, `openFlinksConnect` +
  `handleFlinksNavigation`, `openTellerConnect` + `handleTellerMessage`, `handleUnlink`,
  `handleSync`. This is a skin change; the flow logic is correct.
- Errors: route link-token / providers load failures into the inline error card (new
  `error`-state render branch); leave transient in-flow failures (`Alert.alert` on Flinks/
  Teller `failure`, unlink failure, exchange failure) as alerts — they're modal-scoped.
- Currency/date: keep the existing `new Date(created_at).toLocaleDateString()`; no formatter
  change needed on this screen.

---

## 9. Handoff checklist

- [x] Background swapped to `<GradientBackground variant="bgDarkPurple">` (main + native + 2 modals + loading)
- [x] All states designed (default, empty, loading skeleton, error, connecting, overflow, WebView modal)
- [x] Every hardcoded color/gradient/spacing/font mapped to a design-system token (§5)
- [x] Header + list-row + group-label + CTA conventions match dashboard/calendar/accounts (archetype-consistent)
- [x] Shared components reused (GradientBackground, Skeleton, BackButton, AttentionCard pattern)
- [x] Intro card is the single `glassFloating` card ("only the headline floats")
- [x] Provider chooser reframed as a radio-group of shared list rows (dedupes 3 bespoke cards)
- [x] Reconnect promoted to an AttentionCard banner while keeping the in-row Reconnect action
- [x] Accessibility: 44pt targets, color-independent status (icon+word+color), radio semantics, SR order, reduced motion
- [x] Component specs written (`docs/design/components/link-account-*.json`)
- [x] Functionality preserved; screen stays recognizably the same
