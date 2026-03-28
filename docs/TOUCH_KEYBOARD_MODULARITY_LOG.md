# Touch Keyboard Modularity Log

Date: 2026-03-28  
Scope: Mobile, tablette et desktop tactile (coarse pointer)

## Objectif

Empêcher le clavier virtuel de masquer:
- les champs de saisie
- les CTA de progression/enregistrement
- les zones de fin de formulaire

Tout en conservant:
- la logique responsive existante
- les safe areas
- le comportement desktop non tactile inchangé

## Principe Technique

Nous utilisons:
- `useDevice()` pour détecter `isTouch`
- `useKeyboardInset(isTouch)` pour mesurer dynamiquement la hauteur clavier via `visualViewport`

Quand le clavier est ouvert (`isKeyboardOpen`):
- ajout d’un `paddingBottom` dynamique sur les conteneurs scrollables
- remontée des zones CTA fixes/sticky via `marginBottom`/`bottom` dynamique

---

## Fichiers Modifiés

### 1) `src/components/OnboardingScreen.tsx`

#### Ajouts
- Import `useDevice`
- Import `useKeyboardInset`
- Initialisation:
  - `const { isTouch } = useDevice();`
  - `const { keyboardInset, isKeyboardOpen } = useKeyboardInset(isTouch);`

#### Comportement ajouté
- Zone de contenu scrollable (`container-content`):
  - `paddingBottom` dynamique sur tactile
  - permet de garder les champs visibles au-dessus du clavier
- Bloc CTA bas (`Continuer/Terminer`):
  - `marginBottom` dynamique quand clavier ouvert
  - évite le chevauchement clavier/CTA

#### Impact UX
- Saisie plus fluide sur onboarding étapes identité/localisation
- Fin d’étape toujours actionnable même avec clavier ouvert

---

### 2) `src/components/EditProfileScreen.tsx`

#### Ajouts
- Import `useKeyboardInset`
- Extension de `useDevice()` avec `isTouch`
- Initialisation:
  - `const { keyboardInset, isKeyboardOpen } = useKeyboardInset(isTouch);`

#### Comportement ajouté
- Conteneur principal:
  - `paddingBottom` dynamique (`calc(7rem + keyboardInset)`) sur tactile quand clavier ouvert

#### Impact UX
- Les zones “À propos”, intérêts, détails restent accessibles pendant la saisie
- Réduction des cas où l’utilisateur tape “à l’aveugle” sous le clavier

---

### 3) `src/components/AccountSettingsScreen.tsx`

#### Ajouts
- Import `useKeyboardInset`
- Extension de `useDevice()` avec `isTouch`
- Initialisation:
  - `const { keyboardInset, isKeyboardOpen } = useKeyboardInset(isTouch);`

#### Comportement ajouté
- Vue mobile détail (`/settings/:category/:sub`):
  - `paddingBottom` dynamique quand clavier ouvert
- Vue mobile liste (`/settings`):
  - `paddingBottom` dynamique (`calc(7rem + keyboardInset)`) quand clavier ouvert

#### Impact UX
- Les champs texte/password restent visibles
- Les actions d’enregistrement ne sont plus masquées par le clavier

---

## Référence Hook Utilisé

### `src/hooks/useKeyboardInset.ts`
- Basé sur `window.visualViewport`
- Calcule: `window.innerHeight - (vv.height + vv.offsetTop)`
- Expose:
  - `keyboardInset`
  - `isKeyboardOpen`

Ce hook est la base commune pour toute future page avec input tactile.

---

## Écrans Déjà Couverts Avant Ce Lot

- `src/components/ChatScreen.tsx`
  - input bar et zone messages déjà adaptés clavier tactile

Ce document couvre le **complément** ajouté sur:
- Onboarding
- Edit Profile
- Account Settings

---

## Vérification Recommandée

Tester au minimum:
- 320x560
- 360x640
- 390x844
- 412x915
- 430x932

Cas à valider:
- focus champ bas de page
- ouverture/fermeture clavier
- scroll pendant clavier ouvert
- CTA toujours visible et cliquable

---

## Notes

- Le comportement desktop non tactile (pointer fine) est conservé.
- Les ajustements sont non destructifs et n’altèrent pas la logique des routes/flows.
