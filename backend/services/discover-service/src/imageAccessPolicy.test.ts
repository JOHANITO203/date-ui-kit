import { strict as assert } from "node:assert";
import { resolveImageAccessPolicy } from "./imageAccessPolicy";

type Case = {
  surface: Parameters<typeof resolveImageAccessPolicy>[0];
  state: Parameters<typeof resolveImageAccessPolicy>[1];
  expected: ReturnType<typeof resolveImageAccessPolicy>;
};

const cases: Case[] = [
  { surface: "discover", state: "visible_standard", expected: "public_stable" },
  { surface: "discover", state: "visible_conditional", expected: "signed_private" },
  { surface: "likes", state: "locked_free", expected: "signed_private" },
  { surface: "likes", state: "unlockable_icebreaker", expected: "signed_private" },
  { surface: "likes", state: "unlocked_icebreaker", expected: "public_stable" },
  { surface: "likes", state: "visible_by_entitlement", expected: "public_stable" },
  { surface: "likes", state: "shadowghost_active", expected: "signed_private" },
  { surface: "likes", state: "shadowghost_disabled", expected: "public_stable" },
  { surface: "messages", state: "match_confirmed", expected: "public_stable" },
  { surface: "messages", state: "conversation_authorized", expected: "public_stable" },
  { surface: "messages", state: "pending", expected: "signed_private" },
  { surface: "new_matches", state: "match_confirmed", expected: "public_stable" },
  { surface: "profile_viewer", state: "visible_standard", expected: "public_stable" },
  { surface: "profile_viewer", state: "visible_by_entitlement", expected: "public_stable" },
  { surface: "profile_viewer", state: "locked_free", expected: "signed_private" },
  { surface: "profile_self", state: "self_view", expected: "signed_private" },
  { surface: "admin", state: "visible_standard", expected: "signed_private" },
];

for (const testCase of cases) {
  const actual = resolveImageAccessPolicy(testCase.surface, testCase.state);
  assert.equal(
    actual,
    testCase.expected,
    `policy mismatch: ${testCase.surface}/${testCase.state} expected ${testCase.expected}, got ${actual}`,
  );
}

console.log(`[imageAccessPolicy] ${cases.length} cases OK`);
