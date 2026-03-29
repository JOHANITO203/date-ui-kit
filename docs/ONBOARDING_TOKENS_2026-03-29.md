# Onboarding Tokens - 2026-03-29

Ce document verrouille les tokens design de l'onboarding Exotic V1.

## 1) Selection Modals (Ville / Nationalite / Date)

- `onboarding.selector.overlay`
  - `background: bg-black/80`
  - `backdrop: backdrop-blur-md`
  - `z-index: z-[120]`
- `onboarding.selector.sheet`
  - `radius-mobile: rounded-t-[30px]`
  - `radius-desktop: sm:rounded-[30px]`
  - `surface: bg-[#0e0f13]/90`
  - `border: border-white/10`
  - `blur: backdrop-blur-2xl`
  - `max-height: max-h-[84dvh]`
- `onboarding.selector.list.item`
  - `radius: rounded-[18px]`
  - `inactive: border-white/10 + bg-white/5`
  - `active: border-pink-500/45 + gradient pink->sky (20%)`

## 2) Flags (anti-mojibake)

- `onboarding.flags.source`
  - stockage par `flagCode` ISO2 (`RU`, `NG`, `BJ`, etc.)
- `onboarding.flags.renderer`
  - helper `flagFromCode(code)`
  - pas d'emoji drapeau en dur dans les donnees

## 3) Date Picker (Step 4)

- `onboarding.date.selector`
  - meme langage visuel que les selecteurs dynamiques
  - 3 colonnes scrollables: jour / mois / annee
  - preview + CTA `Confirmer la date`
- `onboarding.date.format`
  - UI: `DD/MM/YYYY`
  - storage: `YYYY-MM-DD`
- `onboarding.date.years`
  - plage: `currentYear - 18` a `currentYear - 100`

## 4) Photos Bento (Step 5)

- `onboarding.photo.slots`
  - `PHOTO_SLOTS = 5`
  - composition bento:
    - slot 1: `col-span-2 row-span-2`
    - slot 2: `col-start-3 row-start-1`
    - slot 3: `col-start-3 row-start-2`
    - slot 4: `col-start-1 row-start-3`
    - slot 5: `col-start-2 row-start-3`
- `onboarding.photo.grid`
  - `grid-cols-3`
  - `auto-rows-[88px] sm:auto-rows-[96px] md:auto-rows-[110px]`
  - `max-w-[32rem]`
- `onboarding.photo.card`
  - `radius: rounded-[20px]`
  - `height-guard: h-full + min-h-[88px]`
  - `empty: border-white/20 + bg-white/[0.02]`
  - `filled: border-pink-500/45 + gradient pink->sky (20%)`

## 5) Age Range (Step 6)

- `onboarding.age.max = 65`
- `onboarding.age.min.min = 18`
- `onboarding.age.range.constraint = ageMin < ageMax`
- sliders separes:
  - slider 1: `Age minimum`
  - slider 2: `Age maximum`
- affichage verrouille:
  - label `Tranche d'age`
  - valeur live `${ageMin} - ${ageMax} ans`

## 6) Intent Block (Step 7)

- options concises verrouillees:
  - `Relation serieuse`
  - `Flirt`
  - `Exotic`
  - `Open`
- mapping data conserve:
  - `serieuse`, `connexion`, `decouverte`, `verrai`

## 7) Translation Block (Step 9)

- suppression des selects de langue
- `autoDetectLanguage` demandee a l'utilisateur (toggle)
- `autoTranslate` affiche en `ON` par defaut
- style: glass card + gradient status card

## 8) Data Tokens (Step 4)

- villes launch:
  - `Voronej`, `Moscou`, `Saint-Petersbourg`, `Sotchi`
- nationalite:
  - `Russe` toujours en premier
  - `Beninois` present

## 9) Fichiers Impactes

- `src/components/OnboardingScreen.tsx`

