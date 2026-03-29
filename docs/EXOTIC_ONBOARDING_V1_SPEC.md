# Onboarding Exotic V1 — Product + UX + Technical Spec

## 1. Objective

Faire entrer rapidement l’utilisateur dans le feed avec suffisamment de données pour lancer un matching pertinent, sans freiner l’acquisition.

---

## 2. Onboarding Flow (V1)

### Étapes obligatoires

1. Splash / branding
2. 18+ / consentements
3. Création de compte
4. Prénom + date de naissance + genre + orientation
5. Ville + pays d’origine + langues parlées
6. Ajout d’au moins 1 photo
7. Préférences de rencontre : genre recherché, âge, rayon
8. Intention + 3 à 5 intérêts
9. Écran de confirmation + entrée dans le feed

### Étapes facultatives post-onboarding

- Selfie de vérification
- Bio
- Réglage avancé de traduction
- Activation ShadowGhost
- Upgrade premium

---

## 3. Consentement / Âge / Cadre

### Écran 2 — Conditions de base

#### Champs

- J’ai 18 ans ou plus
- Acceptation CGU / confidentialité
- Consentement géolocalisation (explication simple)

#### CTA

- Continuer

#### Objectif

- Sécurité légale
- Préparer le matching local

---

## 4. Création de compte

### Écran 3 — Auth

#### Options

- V1 : téléphone ou email + OTP simple
- V2 : OAuth Google (Apple ensuite si utile)

#### Objectif

- Friction faible
- Identité minimale fiable

---

## 5. Identité de base

### Écran 4 — Profil essentiel

#### Champs obligatoires

- Prénom
- Date de naissance
- Genre
- Orientation
- Ville
- Pays d’origine
- Langues parlées

#### Pourquoi

Nourrir directement les sous-scores :

- `C` (compatibilité)
- `P` (proximité)
- `D` (diversité)
- `L` (langue/traduction)

#### Règle produit

Même si le front marketing met en avant l’axe hétéro dans certains contextes, le système doit enregistrer correctement toutes les orientations compatibles.

---

## 6. Photos

### Écran 5 — Ajout photo

#### Règle

- 1 photo obligatoire
- Recommandation forte : 3 minimum

#### Micro-copy

Les profils avec 3 photos ou plus performent mieux.

#### CTA

- Continuer
- Ajouter plus tard (autorisé uniquement après 1 photo)

#### Objectif

- Éviter feed vide / fake
- Éviter score `Q` faible

---

## 7. Préférences de rencontre

### Écran 6 — Qui veux-tu rencontrer ?

#### Champs

- Genre(s) recherché(s)
- Tranche d’âge recherchée
- Distance max : 25 / 50 / 100 km

#### Objectif

- Nourrir `C` et `P`
- Rendre le feed pertinent immédiatement

---

## 8. Intentions

### Écran 7 — Ce que tu cherches

#### Choix

- Relation sérieuse
- Discussion / connexion
- Découverte / rencontres
- Je verrai

#### Objectif

- Nourrir `Intent`
- Affiner `C`

---

## 9. Intérêts

### Écran 8 — Centres d’intérêt

#### Chips

- Musique
- Sport
- Business
- Voyage
- Cinéma
- Food
- Mode
- Spiritualité
- Tech
- Art
- Danse
- Lifestyle

#### Règle

- Choisir 3 à 5 minimum

#### Objectif

- Nourrir `Interests`
- Enrichir `Q` et `C`

---

## 10. Langue et traduction

### Écran 9 — Traduction du chat

#### Contenu

- Langues parlées (pré-renseignées)
- Langue d’interface
- Langue cible de traduction préférée
- Toggle : activer la traduction automatique dans le chat

#### Objectif

- Poser le différenciateur Exotic
- Nourrir `L`

---

## 11. Vérification optionnelle

### Écran 10 — Vérifie ton profil

#### Actions

- Vérifier maintenant
- Passer pour l’instant

#### Message

Les profils vérifiés inspirent plus confiance.

#### Objectif

- Nourrir `S`
- Rassurer
- Ne pas casser l’acquisition

#### Règle V1

La vérification n’est pas obligatoire à l’entrée.

---

## 12. Permissions finales

### Écran 11 — Autorisations utiles

#### Ordre conseillé

1. Localisation précise
2. Notifications (après valeur perçue)

#### Règle

Ne pas demander toutes les permissions trop tôt.

---

## 13. Entrée dans le feed

### Écran 12 — Profil prêt

#### Affichage

- Photo
- Prénom, âge
- Ville
- Langues
- Badge si vérifié
- Barre de complétion profil

#### CTA

- Principal : Voir mes profils
- Secondaire : Améliorer mon profil

---

## 14. Version courte finale

### Obligatoire V1

1. Splash
2. 18+ / consentement
3. Auth
4. Identité de base
5. Photo
6. Préférences de rencontre
7. Intentions
8. Intérêts
9. Traduction
10. Entrée feed

### Progressive completion après entrée

- Selfie de vérification
- Bio
- Zodiaque auto (depuis DOB)
- Hide age/distance
- ShadowGhost upsell
- Travel Pass discovery
- Premium prompts

---

## 15. UX/Design Technical Foundation

### Stack

- React 18+ (Vite)
- Tailwind CSS (mobile-first)
- `motion/react` (Framer Motion) pour transitions/feedback
- `lucide-react` via `ICONS` centralisé

### Design tokens (core)

- Background principal : `#0A0A0B`
- Accent CTA : gradient `from-pink-500 to-purple-600`
- Bordures : `border-white/10`, `border-pink-500/20`
- Texte :
  - primaire : `text-white`
  - secondaire : `text-white/30` à `text-white/50`
  - accent : `text-pink-400`

### Glass token

```css
.glass {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
```

### Typographie

- Titre : `text-2xl font-black tracking-tight`
- Micro label : `text-[10px] font-black uppercase tracking-[0.2em] text-white/30`
- Badge : `text-[8px] font-bold uppercase tracking-widest`

---

## 16. Interaction & Validation Logic

### State d’étape

Un `step` unique (ex: `useState(1)`) pilote l’ensemble du flow.

### Transitions

`AnimatePresence` + animation step enter/exit (fade + horizontal offset léger).

### Validation dynamique (`isStepValid`)

Validation par étape avant activation CTA “continuer”.

Exemple :

- consentements obligatoires sur step 2
- âge >= 18 sur step identité
- 1 photo minimum sur step photo
- 3 à 5 intérêts minimum sur step intérêts

### DOB + zodiaque

- `calculateAge` à partir de la date
- `getZodiacSign` via mapping date/jour
- Badge zodiaque masqué pendant focus du champ date pour ne pas gêner la saisie

---

## 17. Components to Reuse

- `GlassButton`
  - variants : `primary | secondary | ghost`
  - micro-motion :
    - `whileHover={{ scale: 1.02 }}`
    - `whileTap={{ scale: 0.98 }}`
- Progress bar onboarding
  - track : `h-1 bg-white/5`
  - fill : `bg-gradient-to-r from-pink-500 to-purple-500`
  - width : `(step / totalSteps) * 100`

---

## 18. Product Constraints (Do Not Break)

- Pas de friction inutile avant l’entrée feed
- Pas de vérification obligatoire en V1
- Pas de hard lock sur fonctionnalités post-onboarding
- Priorité au matching local, actif, et conversationnel
- Compatibilité orientation toujours respectée côté système

---

## 19. Implementation notes

- Mobile-first strict
- Aucun hardcode bloquant non i18n
- Onboarding découplé du paywall principal
- Tracking analytics dès V1 sur chaque step (view, complete, skip, fail-validation)

