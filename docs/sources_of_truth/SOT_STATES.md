# SOURCE OF TRUTH — ETATS

Date de verrouillage: 2026-03-30

## 1) Discover
- feed: `loading | ready | empty | error`
- boost: `inactive | active_with_timer | out_of_tokens`
- match modal: `closed | open`

## 2) Likes
- `loading | locked | unlocked | empty | error`
- icebreaker context present/absent
- incoming like domain state:
  - `pending_incoming_like`
  - `matched`
  - `refused`
  - `hidden_by_shadowghost` (visibility mask overlay)
  - `blurred_locked` (free lock visual state)

## 3) Messages list
- data: `loading | ready | empty | error`
- conversation relation state:
  - `active`
  - `blocked_by_me`
  - `blocked_me`
  - `unmatched`
- visual density responsive locked

## 4) Chat
- relation state identique a Messages
- input enabled uniquement sur `active`
- translation toggle: `on | off`

## 5) Boost
- boost activation:
  - `activated | already_active | no_tokens`
- catalog tab:
  - `instant | passes | bundles`

## 6) Profile
- plan visual state: `free | essential/gold | platinum | elite`
- privacy toggles: on/off
- travel pass server switch:
  - `canChangeServer=true` avec source
  - `canChangeServer=false` (lock + upsell)

## 7) Settings (Privacy)
- section state: `loading | ready | error | invalid_route`
- travel pass item:
  - `locked` (cta vers Boost)
  - `enabled` (select city)

## 8) Onboarding
- step state: `1..12`
- completion per step via `canContinue`
- resume state persisted (step/form)
- finish state clear draft
