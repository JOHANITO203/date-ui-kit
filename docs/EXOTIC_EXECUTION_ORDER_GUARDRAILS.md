# Exotic — Ordre D'Exécution (Garde-Fous)

Ce document verrouille l'ordre de travail pour éviter les erreurs pendant les refactors écran par écran.

## Règle principale

On ne branche pas le workflow technique complet tant que le design visible de l'écran n'est pas aligné avec la spec.

Ordre obligatoire:

1. Vérifier si le design de l'écran est conforme à la spec (structure, sections, routes, états visibles).
2. Corriger uniquement le design/UX visible manquant pour atteindre l'alignement spec.
3. Verrouiller ce design (tokens, responsive, i18n, cohérence navigation).
4. Seulement après: appliquer le workflow technique écran par écran.

## Workflow technique (après alignement design)

`Écran -> Données -> États -> Logique métier -> Algorithme -> API -> Tests -> Prod`

## Checkpoint avant codage technique d'un écran

Un écran est "prêt workflow" uniquement si:

- les blocs visibles requis par la spec existent;
- les routes et transitions de l'écran sont cohérentes;
- les états UI critiques sont designés (`loading`, `empty`, `error`, `success`, `locked` si besoin);
- la version EN/RU est cohérente (pas de hardcode, pas de mojibake);
- le responsive mobile/tablette/desktop est validé.

## Périmètre immédiat validé par l'équipe

- Priorité actuelle: `Discover`.
- Puis: `Likes`, `Chat`, `Settings`.
- Même méthode pour chaque écran, sans sauter d'étape.

