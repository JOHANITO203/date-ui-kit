# Exotic — I18n Guardrails (EN/RU)

Ce document verrouille la discipline i18n pour éviter les régressions, le hardcode et le mojibake.

## 1) Encodage obligatoire

- UTF-8 partout (sources, locales, exports/imports).
- Aucune modification de fichier de locale dans un autre encodage.
- Contrôle automatique via:
  - `npm run i18n:utf8`
  - `npm run i18n:check`

## 2) Langue canonique

- La langue source canonique est `en`.
- Toute nouvelle clé est créée d'abord dans `en`, puis propagée vers `ru`.
- Interdiction d'ajouter une clé uniquement en `ru`.

## 3) Contrat de clés

- Les clés i18n sont une API interne stable.
- Convention: `domaine.section.item`.
- Exemples:
  - `discover.quickFilters.nearby`
  - `boost.tiers.gold.price`
  - `settings.sections.privacy`

## 4) Hardcode interdit

- Aucun texte utilisateur ne doit rester en dur dans les composants.
- Exceptions temporaires uniquement si clairement marquées puis supprimées avant merge.

## 5) Fallback contrôlé

- Si clé absente en locale active:
  - fallback vers `en`
  - signalement en dev (`i18n:check`).
- Le fallback ne doit jamais masquer une dette de traduction durable.

## 6) Placeholders

- Les placeholders doivent être identiques entre `en` et `ru`.
- Exemple:
  - `matchPair: 'You and {name}'`
  - `matchPair: 'Вы и {name}'`

## 7) Validation avant livraison

Exécuter systématiquement:

1. `npm run i18n:utf8`
2. `npm run i18n:check`
3. `npm run lint`

Ou en une commande:

- `npm run quality:translations`

## 8) Séparation affichage / logique

- La logique métier ne doit pas dépendre des textes traduits.
- Utiliser enums/flags côté logique, puis mapper vers i18n côté rendu.

## 9) Règle workflow

Avant toute modif écran:

1. alignement design visible vs spec;
2. i18n EN/RU cohérent sans hardcode;
3. seulement ensuite: données/états/logique/algo/API/tests/prod.

