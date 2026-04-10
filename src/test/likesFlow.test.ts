import { runtimeApi } from '../state/appRuntimeStore';
import assert from 'node:assert/strict';

const seedUnlockedLikes = () => {
  runtimeApi.resetForTests();
  runtimeApi.seedDemo();
  runtimeApi.setPlanTier('essential');
};

const run = () => {
  runtimeApi.resetForTests();

  {
    seedUnlockedLikes();
    const initial = runtimeApi.getLikes();
    const target = initial.inventory.visibleLikes[0];
    assert.ok(target);

    const response = runtimeApi.decideIncomingLike({
      likeId: target.id,
      action: 'like_back',
    });

    assert.equal(response.ok, true);
    assert.equal(response.matched, true);
    assert.ok(response.conversationId);

    const next = runtimeApi.getLikes();
    const matched = next.inventory.visibleLikes.find((entry) => entry.id === target.id);
    assert.equal(matched?.state, 'matched');
    assert.equal(matched?.blurredLocked, false);

    const conversation = runtimeApi.getConversationByUserId(target.profile.id);
    assert.ok(conversation);
  }

  {
    seedUnlockedLikes();
    const initial = runtimeApi.getLikes();
    const target = initial.inventory.visibleLikes[0];

    const response = runtimeApi.decideIncomingLike({
      likeId: target.id,
      action: 'pass',
    });

    assert.equal(response.ok, true);
    assert.equal(response.status, 'refused');

    const next = runtimeApi.getLikes();
    const exists = next.inventory.visibleLikes.some((entry) => entry.id === target.id);
    assert.equal(exists, false);
    assert.equal(next.inventory.visibleLikes.length, initial.inventory.visibleLikes.length - 1);
  }

  {
    runtimeApi.resetForTests();
    runtimeApi.seedDemo();
    runtimeApi.applyEntitlementSnapshot({
      planTier: 'free',
      balancesDelta: {
        boostsLeft: 0,
        superlikesLeft: 0,
        rewindsLeft: 0,
        icebreakersLeft: 1,
      },
    });

    const before = runtimeApi.getLikes();
    const target = before.inventory.visibleLikes[0];
    assert.equal(before.inventory.hiddenCount, before.inventory.visibleLikes.length);

    const response = runtimeApi.consumeLikesIceBreaker(target.id);
    assert.equal(response.ok, true);
    assert.equal(response.inventory.iceBreaker.unlockedCount, 1);
    assert.equal(response.inventory.hiddenCount, before.inventory.hiddenCount - 1);

    const after = runtimeApi.getLikes();
    const unlocked = after.inventory.visibleLikes.find((entry) => entry.id === target.id);
    assert.equal(unlocked?.blurredLocked, false);
  }

  // eslint-disable-next-line no-console
  console.log('[likes-flow-runtime] ok');
};

run();
