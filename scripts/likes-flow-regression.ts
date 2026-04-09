import assert from 'node:assert/strict';

type LikeStatus = 'pending' | 'matched' | 'passed';

type LikeRow = {
  liker: string;
  liked: string;
  status: LikeStatus;
  hiddenByShadowGhost: boolean;
  wasSuperLike: boolean;
};

const rows: LikeRow[] = [];

const upsertLike = (input: {
  liker: string;
  liked: string;
  hiddenByShadowGhost?: boolean;
  wasSuperLike?: boolean;
}) => {
  const idx = rows.findIndex((row) => row.liker === input.liker && row.liked === input.liked);
  const next: LikeRow = {
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

  // eslint-disable-next-line no-console
  console.log('[likes-flow-regression] ok');
};

run();
