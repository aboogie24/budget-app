---
name: design-system
description: CoupleFlow's design system location, theme character, and the canonical token set to use when designing any screen
metadata:
  type: project
---

CoupleFlow's design system is the single source of truth at
`budget-app/utils/design-system.ts`. Always read it before designing and reference its
tokens — never hardcode colors/spacing.

**Why:** Several screens (the old Calendar especially) drifted into ad-hoc inline styles
and hardcoded gradients, which made them look like a different app and feel dated.

**How to apply:** Map every value to a token. Exports: `colors`, `gradients`,
`glassEffects`, `spacing`, `radius`, `typography`, `commonStyles`, plus helpers
(`getTheme`, `formatCurrency`, `getValueColor`). There is a `GradientBackground` component
(`budget-app/components/GradientBackground.tsx`, takes a `variant` keyof gradients) and a
reusable `Skeleton` component (`budget-app/components/Skeleton.tsx`) — reuse both rather
than reimplementing.

Character: dark theme, deep navy/purple gradient backgrounds (`gradients.bgDarkPurple`),
translucent "glass" cards (`glassEffects.glass/glassEnhanced/glassFloating`), purple
accents (`colors.primary #7c3aed`, `primary2 #a855f7`, `accent #c084fc`). Semantic:
`success #22c55e`, `error #ef4444`, `warning #eab308`, `info #3b82f6`. Dark mode only for
now but structured for light-mode expansion.

Related: [[actual-vs-projected-pattern]], [[design-artifact-locations]]
