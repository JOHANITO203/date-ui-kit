import assert from 'node:assert/strict';

type LikeStatus = 'pending' | 'matched' | 'passed';

type LikeRow = {
  id: string;
  liker: string;
  liked: string;
  status: LikeStatus;
  hiddenByShadowGhost: boolean;
  wasSuperLike: boolean;
};

const rows: LikeRow[] = [];
const unlockedByUser = new Map<string, Set<string>>();
const inventoryByUser = new Map<string, { icebreakersLeft: number; planTier: 'free' | 'essential' | 'gold' | 'platinum' | 'elite' }>();

const upsertLike = (input: {
  liker: string;
  liked: string;
  hiddenByShadowGhost?: boolean;
  wasSuperLike?: boolean;
}) => {
  const idx = rows.findIndex((row) => row.liker === input.liker && row.liked === input.liked);
  const next: LikeRow = {
    id: `${input.liker}->${input.liked}`,
    liker: input.liker,
    liked: input.liked,
    status: 'pending',
    hiddenByShadowGhost: Boolean(input.hiddenByShadowGhost),
    wasSuperLike: Boolean(input.wasSuperLike),
  };
  if (idx >= 0) rows[idx] = { ...rows[idx], ...next };
  else rows.push(next);
};

const decideIncoming = (likedUser: string, likerUser: string, action: 'like_back' | 'pass') => {
  const incoming = rows.find((row) => row.liker === likerUser && row.liked === likedUser);
  if (!incoming) return { matched: false, status: 'missing' as const };
  if (action === 'pass') {
    incoming.status = 'passed';
    const outgoing = rows.find((row) => row.liker === likedUser && row.liked === likerUser);
    if (outgoing) outgoing.status = 'passed';
    return { matched: false, status: 'refused' as const };
  }

  upsertLike({ liker: likedUser, liked: likerUser });
  const reciprocal = rows.find((row) => row.liker === likedUser && row.liked === likerUser);
  if (!reciprocal) return { matched: false, status: 'pending_incoming_like' as const };

  incoming.status = 'matched';
  reciprocal.status = 'matched';
  return { matched: true, status: 'matched' as const };
};

const incomingFor = (userId: string) => rows.filter((row) => row.liked === userId);
const hiddenIncomingFor = (userId: string) => incomingFor(userId).filter((row) => row.hiddenByShadowGhost);

const seedInventory = (userId: string, icebreakersLeft: number) => {
  inventoryByUser.set(userId, { icebreakersLeft, planTier: 'free' });
};

const setPlanTier = (userId: string, planTier: 'free' | 'essential' | 'gold' | 'platinum' | 'elite') => {
  const current = inventoryByUser.get(userId) ?? { icebreakersLeft: 0, planTier: 'free' as const };
  inventoryByUser.set(userId, { ...current, planTier });
};

const getInventory = (userId: string) => inventoryByUser.get(userId) ?? { icebreakersLeft: 0, planTier: 'free' as const };

const getVisibility = (userId: string, like: LikeRow) => {
  const inv = getInventory(userId);
  if (like.hiddenByShadowGhost) {
    const unlocked = inv.planTier !== 'free' || (unlockedByUser.get(userId)?.has(like.id) ?? false);
    return { hiddenByShadowGhost: true, blurredLocked: !unlocked };
  }
  if (inv.planTier !== 'free') return { hiddenByShadowGhost: false, blurredLocked: false };
  const unlocked = unlockedByUser.get(userId)?.has(like.id) ?? false;
  return { hiddenByShadowGhost: false, blurredLocked: !unlocked };
};

const useIceBreaker = (userId: string, likeId: string) => {
  const inventory = getInventory(userId);
  if (inventory.planTier !== 'free') return { ok: false, code: 'not_required' as const };
  if (inventory.icebreakersLeft <= 0) return { ok: false, code: 'empty' as const };
  const like = incomingFor(userId).find((entry) => entry.id === likeId);
  if (!like) return { ok: false, code: 'missing' as const };
  const currentUnlocked = unlockedByUser.get(userId) ?? new Set<string>();
  if (currentUnlocked.has(likeId)) return { ok: false, code: 'already_unlocked' as const };

  currentUnlocked.add(likeId);
  unlockedByUser.set(userId, currentUnlocked);
  const next = { ...inventory, icebreakersLeft: inventory.icebreakersLeft - 1 };
  inventoryByUser.set(userId, next);
  return { ok: true, inventory: next, unlockedCount: currentUnlocked.size };
};

const run = () => {
  // Case 1: A like B -> B sees incoming like.
  upsertLike({ liker: 'A', liked: 'B' });
  assert.equal(incomingFor('B').length, 1);
  assert.equal(incomingFor('B')[0].status, 'pending');

  // Case 2: A like B with ShadowGhost -> identity masked.
  upsertLike({ liker: 'C', liked: 'D', hiddenByShadowGhost: true });
  assert.equal(incomingFor('D')[0].hiddenByShadowGhost, true);

  // Case 3: B like back while A online -> matched.
  const case3 = decideIncoming('B', 'A', 'like_back');
  assert.equal(case3.matched, true);
  assert.equal(rows.find((row) => row.liker === 'A' && row.liked === 'B')?.status, 'matched');
  assert.equal(rows.find((row) => row.liker === 'B' && row.liked === 'A')?.status, 'matched');

  // Case 4: B like back while A offline -> still matched.
  upsertLike({ liker: 'E', liked: 'F' });
  const case4 = decideIncoming('F', 'E', 'like_back');
  assert.equal(case4.matched, true);

  // Case 5: B refuses -> no match.
  upsertLike({ liker: 'G', liked: 'H' });
  const case5 = decideIncoming('H', 'G', 'pass');
  assert.equal(case5.matched, false);
  assert.equal(rows.find((row) => row.liker === 'G' && row.liked === 'H')?.status, 'passed');

  // Case 6: free/no icebreaker lock concept preserved by pending hidden list.
  // Invariant: incoming likes stay pending until explicit decision.
  upsertLike({ liker: 'I', liked: 'J' });
  assert.equal(rows.find((row) => row.liker === 'I' && row.liked === 'J')?.status, 'pending');

  // Case 7: IceBreaker unitary unlock + no useless consumption on plan unlock.
  seedInventory('J', 2);
  const targetLike = rows.find((row) => row.liker === 'I' && row.liked === 'J');
  assert.ok(targetLike);
  upsertLike({ liker: 'L', liked: 'J' });
  const secondLike = rows.find((row) => row.liker === 'L' && row.liked === 'J');
  assert.ok(secondLike);
  assert.equal(getVisibility('J', targetLike!).blurredLocked, true);
  assert.equal(getVisibility('J', secondLike!).blurredLocked, true);
  const used = useIceBreaker('J', targetLike!.id);
  assert.equal(used.ok, true);
  assert.equal(getInventory('J').icebreakersLeft, 1);
  assert.equal(getVisibility('J', targetLike!).blurredLocked, false);
  assert.equal(
    getVisibility('J', secondLike!).blurredLocked,
    true,
    'Using one IceBreaker must not unlock other locked likes.',
  );
  const usedAgain = useIceBreaker('J', targetLike!.id);
  assert.equal(usedAgain.ok, false);
  setPlanTier('J', 'essential');
  const beforePlanStock = getInventory('J').icebreakersLeft;
  const usedWithPlan = useIceBreaker('J', targetLike!.id);
  assert.equal(usedWithPlan.ok, false);
  assert.equal(getInventory('J').icebreakersLeft, beforePlanStock);

  // Case 8: ShadowGhost incoming can exist while identity remains hidden and can be unlocked unitary.
  setPlanTier('J', 'free');
  upsertLike({ liker: 'K', liked: 'J', hiddenByShadowGhost: true });
  const shadowLike = hiddenIncomingFor('J')[0];
  assert.ok(shadowLike);
  assert.equal(getVisibility('J', shadowLike).hiddenByShadowGhost, true);
  assert.equal(getVisibility('J', shadowLike).blurredLocked, true);
  const shadowUse = useIceBreaker('J', shadowLike.id);
  assert.equal(shadowUse.ok, true);
  assert.equal(getVisibility('J', shadowLike).blurredLocked, false);
  assert.equal(getInventory('J').icebreakersLeft, 0);

  // Case 9: after one card is unlocked, new incoming likes must not relock or "remove" it logically.
  setPlanTier('J', 'free');
  upsertLike({ liker: 'M', liked: 'J' });
  upsertLike({ liker: 'N', liked: 'J' });
  assert.equal(
    getVisibility('J', targetLike!).blurredLocked,
    false,
    'Previously unlocked card must remain unlocked when new likes arrive.',
  );
  assert.equal(getVisibility('J', secondLike!).blurredLocked, true);

  // eslint-disable-next-line no-console
  console.log('[likes-flow-regression] ok');
};

run();
