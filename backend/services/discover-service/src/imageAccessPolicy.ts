export type ImageSurface =
  | "discover"
  | "likes"
  | "messages"
  | "new_matches"
  | "profile_viewer"
  | "profile_self"
  | "admin";

export type ImageState =
  | "visible_standard"
  | "visible_by_entitlement"
  | "visible_conditional"
  | "locked_free"
  | "unlockable_icebreaker"
  | "unlocked_icebreaker"
  | "shadowghost_active"
  | "shadowghost_disabled"
  | "match_confirmed"
  | "conversation_authorized"
  | "pending"
  | "not_authorized"
  | "self_view";

export type ImageAccessPolicy = "public_stable" | "signed_private";

const STATE_POLICY: Record<ImageState, ImageAccessPolicy> = {
  visible_standard: "public_stable",
  visible_by_entitlement: "public_stable",
  visible_conditional: "signed_private",
  locked_free: "signed_private",
  unlockable_icebreaker: "signed_private",
  unlocked_icebreaker: "public_stable",
  shadowghost_active: "signed_private",
  shadowghost_disabled: "public_stable",
  match_confirmed: "public_stable",
  conversation_authorized: "public_stable",
  pending: "signed_private",
  not_authorized: "signed_private",
  self_view: "signed_private",
};

const SURFACE_PUBLIC_STATES: Record<ImageSurface, Set<ImageState>> = {
  discover: new Set(["visible_standard"]),
  likes: new Set(["unlocked_icebreaker", "visible_by_entitlement", "shadowghost_disabled"]),
  messages: new Set(["match_confirmed", "conversation_authorized"]),
  new_matches: new Set(["match_confirmed"]),
  profile_viewer: new Set(["visible_standard", "visible_by_entitlement"]),
  profile_self: new Set([]),
  admin: new Set([]),
};

export const resolveImageAccessPolicy = (
  surface: ImageSurface,
  state: ImageState,
): ImageAccessPolicy => {
  const preferred = STATE_POLICY[state] ?? "signed_private";
  if (preferred !== "public_stable") return preferred;
  const allowed = SURFACE_PUBLIC_STATES[surface];
  if (!allowed || !allowed.has(state)) return "signed_private";
  return preferred;
};
