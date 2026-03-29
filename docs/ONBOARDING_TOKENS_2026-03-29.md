# Onboarding Tokens — 2026-03-29

Ce document verrouille les tokens/design rules ajoutés aujourd'hui pour l'onboarding Exotic V1.

## 1) Modals de sélection (Ville / Nationalité / Date)

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
  - `max-height: max-h-[80dvh..84dvh]`
- `onboarding.selector.list.item`
  - `radius: rounded-[18px]`
  - `inactive: border-white/10 + bg-white/5`
  - `active: border-pink-500/45 + gradient pink->sky (20%)`

## 2) Drapeaux (anti-régression caractères)

- `onboarding.flags.source`
  - stockage en `flagCode` ISO-2 (`RU`, `NG`, `BJ`, etc.)
- `onboarding.flags.renderer`
  - conversion runtime via `flagFromCode(code)`
  - évite les caractères corrompus/mojibake.

## 3) Calendrier custom (même langage que sélecteurs dynamiques)

- `onboarding.date.selector`
  - modal dédié, même skin que Ville/Nationalité
  - 3 colonnes scrollables: `Jour`, `Mois`, `Annee`
  - preview de date + CTA `Confirmer la date`
- `onboarding.date.limits`
  - années générées: `currentYear - 18` à `currentYear - 100` (83 valeurs)
- `onboarding.date.format`
  - affichage: `DD/MM/YYYY`
  - stockage: `YYYY-MM-DD`

## 4) Étape 5 Photo (Bento)

- `onboarding.photo.slots`
  - `PHOTO_SLOTS = 5`
  - layout bento `3x3`:
    - slot 1: `col-span-2 row-span-2` (photo principale)
    - slots 2/3: colonne droite (haut/milieu)
    - slots 4/5: bas gauche / bas centre
- `onboarding.photo.card`
  - `radius: rounded-[20px]`
  - `border: dashed`
  - `empty: border-white/20 + bg-white/[0.02]`
  - `filled: border-pink-500/45 + gradient pink->sky (20%)`

## 5) Étape 6 Préférences âge

- `onboarding.age.max = 65`
- sliders:
  - `ageMin: min 18, max 65`
  - `ageMax: min 19, max 65`

## 6) Fichiers impactés

- `src/components/OnboardingScreen.tsx`

