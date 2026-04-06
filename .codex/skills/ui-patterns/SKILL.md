# Skill: ui-patterns

## 1. Purpose
Keep visual and semantic consistency for identity, premium status, and monetization UI.

## 2. When to use
- Editing Discover/Messages/Profile/Boost screens.
- Editing badge/name display, premium cards, or token shop labels.

## 3. Inputs to inspect before changing code
- `NameWithBadge` usage across screens.
- `BoostScreen.tsx`, `MessagesScreen.tsx`, `ProfileScreen.tsx`.
- source-of-truth docs in `docs/sources_of_truth`.

## 4. Rules to follow
- Preserve distinction between verified identity and paid status.
- Preserve premium tier ordering and naming used in current UI copy.
- Keep item/pack naming conventions consistent with current product decisions.
- Reuse existing visual primitives (glass, gradient, glow tokens) instead of creating parallel styles.

## 5. Existing repository patterns to preserve
- premium/glow token usage in cards and CTAs.
- dense badge modes for conversation rows.
- profile-level richer status display vs compact list display.

## 6. Anti-patterns to avoid
- introducing new badge types without product source update.
- showing profile-only pass badges in discover/messages if current rule excludes them.
- mixing old and new item nomenclature in same view.

## 7. Regression checklist
- verify badge rendering in Discover, Messages, Profile.
- verify message row readability with long names + time + unread.
- verify Boost catalog labels and visual hierarchy are coherent.

## 8. Definition of done
- visuals are consistent with current design language.
- status semantics remain aligned with business rules.
