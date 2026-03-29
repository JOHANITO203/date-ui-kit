# Visual Language Tokens - Onboarding V1

Ce document verrouille le langage visuel utilise dans les ecrans onboarding.

## 1) Surfaces

- `vl.surface.base = bg-black`
- `vl.surface.glass = bg-white/5 + border-white/10 + backdrop-blur-xl`
- `vl.surface.glass-strong = bg-[#0e0f13]/90 + border-white/10 + backdrop-blur-2xl`

## 2) Hierarchie Typo

- `vl.typo.title`
  - `text-4xl`
  - `font-black`
  - `italic`
  - `uppercase`
  - `tracking-tight`
- `vl.typo.label-micro`
  - `text-[10px]`
  - `font-black`
  - `uppercase`
  - `tracking-[0.2em]`
  - `text-white/35..45`
- `vl.typo.body`
  - `text-white/60`

## 3) Interaction

- `vl.interaction.primary-cta`
  - `gradient-premium`
  - `rounded-[24px]`
  - `shadow pink glow`
- `vl.interaction.option-card`
  - `rounded-[18px]`
  - `inactive: border-white/10 + bg-white/5`
  - `active: border-pink-500/50 + bg-pink-500/10`

## 4) Color System

- `vl.color.accent.primary = pink`
- `vl.color.accent.secondary = sky`
- `vl.color.success = green`
- `vl.color.warning = amber`
- `vl.color.trust = blue`

## 5) Geometry

- `vl.radius.card = 18px..20px`
- `vl.radius.sheet = 30px`
- `vl.radius.cta = 24px`
- `vl.radius.pill = 9999px`

## 6) Motion

- `vl.motion.sheet.enter = spring(damping:24, stiffness:230)`
- `vl.motion.selector.item = subtle hover/active`
- `vl.motion.step.transition = soft fade + translateY`

## 7) Anti-Regression Rules

- pas de hardcoded emoji drapeau dans les donnees
- pas de texte encode corrompu (mojibake)
- pas de composant hors langage (cards non-glass, CTA sans gradient)
- pas de nouveaux presets visuels sans token associe

