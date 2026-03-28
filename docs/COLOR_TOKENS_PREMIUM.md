# Cahier Tokens Couleur - Premium Dark

Ce cahier verrouille les tokens couleur actuellement utilises dans l'application pour garantir une coherence visuelle mobile, tablette et desktop.

## Palette principale

```css
--color-premium-start: #FF1493;
--color-premium-end: #00BFFF;
--color-boost-start: #FF8C00;
--color-boost-end: #FFD166;
```

## Surfaces / neutral premium

```css
--color-surface: rgba(255, 255, 255, 0.05);
--color-surface-border: rgba(255, 255, 255, 0.1);
```

## Menu premium (verrouille)

```css
--menu-premium-gray: rgba(18, 20, 26, 0.9);
--menu-premium-border: rgba(255, 255, 255, 0.12);
```

Usage:
- Bottom nav mobile
- Sidebar desktop

## Discover - Filtres rapides (verrouille)

```css
--filters-stack-bg: rgba(26, 30, 39, 0.72);
--filters-chip-bg: rgba(255, 255, 255, 0.06);
--filters-chip-border: rgba(255, 255, 255, 0.16);
```

Usage:
- Pile de filtres rapides (tablet + desktop)
- Chips inactives du bloc filtres

## Badges / accents

```css
Verified badge: #1D9BF0
Meta text secondary: #8E8E93
Notification badge: rouge (activite)
```

## Regles de verrouillage

1. Ne pas modifier ces tokens directement dans les composants.
2. Toute evolution couleur passe d'abord par `src/index.css`.
3. En cas de nouvelle variante, ajouter un token, ne pas hardcoder.
4. Garder les gradients pour les CTA premium/boost.

## Fichiers relies

- `src/index.css`
- `src/components/BottomNav.tsx`
- `src/components/Sidebar.tsx`
- `src/components/SwipeScreen.tsx`

