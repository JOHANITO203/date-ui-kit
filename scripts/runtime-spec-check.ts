import assert from 'node:assert/strict';
import type { AnalyticsEventName } from '../src/contracts';
import { getTrackedEvents } from '../src/services';
import { runtimeApi } from '../src/state';

const getEventNames = () => getTrackedEvents().map((event) => event.name);

const countEvent = (name: AnalyticsEventName) =>
  getTrackedEvents().filter((event) => event.name === name).length;

const expectEvent = (name: AnalyticsEventName) => {
  assert(
    getEventNames().includes(name),
    `Expected analytics event "${name}" to be tracked.`,
  );
};

const resetRuntime = () => {
  runtimeApi.resetForTests();
};

const testDiscoverFlow = () => {
  resetRuntime();
  const feed = runtimeApi.getFeed(['all']);
  assert(feed.window.candidates.length > 0, 'Discover feed should contain at least one candidate.');

  for (let index = 1; index < feed.window.candidates.length; index += 1) {
    const previous = feed.window.candidates[index - 1];
    const current = feed.window.candidates[index];
    assert(
      previous.rankScore >= current.rankScore,
      'Discover feed must stay sorted by rankScore descending.',
    );
  }

  const candidate = feed.window.candidates[0];
  const superlikesBefore = runtimeApi.getState().balances.superlikesLeft;
  const rewindsBefore = runtimeApi.getState().balances.rewindsLeft;
  const boostsBefore = runtimeApi.getState().balances.boostsLeft;

  runtimeApi.markProfileImpression(candidate.id);
  expectEvent('profile_impression');

  const boostActivation = runtimeApi.activateBoost();
  assert.equal(boostActivation.status, 'activated', 'Boost should activate when at least one token is available.');
  assert.equal(
    runtimeApi.getState().balances.boostsLeft,
    boostsBefore - 1,
    'Boost activation must consume exactly one boost token.',
  );
  assert.equal(boostActivation.boost.active, true, 'Boost status should be active right after activation.');
  expectEvent('boost_activated');

  const swipeResult = runtimeApi.swipe(candidate.id, 'superlike');
  const afterSwipe = runtimeApi.getState();
  assert.equal(
    afterSwipe.balances.superlikesLeft,
    superlikesBefore - 1,
    'Using a SuperLike must consume exactly one SuperLike token.',
  );
  assert(
    afterSwipe.dismissedProfileIds.includes(candidate.id),
    'Swiped profile should be added to dismissed stack.',
  );
  expectEvent('superlike_used');
  if (swipeResult.matched) {
    expectEvent('match_created');
  }

  const rewindResult = runtimeApi.rewind();
  const afterRewind = runtimeApi.getState();
  assert.equal(
    rewindResult.restoredProfileId,
    candidate.id,
    'Rewind should restore the latest dismissed profile.',
  );
  assert.equal(
    afterRewind.balances.rewindsLeft,
    rewindsBefore - 1,
    'Rewind must consume exactly one rewind token.',
  );
  expectEvent('rewind_used');
};

const testLikesFlow = () => {
  resetRuntime();
  const locked = runtimeApi.getLikes();
  assert.equal(locked.state, 'locked', 'Free plan should keep received likes locked.');
  assert.equal(locked.inventory.unlocked, false, 'Locked state should expose unlocked=false.');
  assert(
    locked.inventory.iceBreaker.eligibleLikesHiddenCount >= 3,
    'Seed data should keep IceBreaker eligibility context available.',
  );

  runtimeApi.trackLikesPaywallView();
  runtimeApi.clickLikesPaywall();
  expectEvent('paywall_view');
  expectEvent('paywall_click');

  runtimeApi.setPlanTier('gold');
  const unlocked = runtimeApi.getLikes();
  assert.equal(unlocked.state, 'unlocked', 'Paid plans must unlock received likes.');
  assert.equal(unlocked.inventory.hiddenCount, 0, 'Unlocked state should hide no likes.');
};

const testChatFlow = () => {
  resetRuntime();
  const conversationId = runtimeApi.openChat('u-4', true);
  const before = runtimeApi.getConversationMessages(conversationId).length;

  const firstSent = runtimeApi.sendMessage({ conversationId, text: 'Hi from runtime test.' });
  assert.equal(firstSent.status, 'sent', 'Active conversations should allow sending messages.');
  assert.equal(firstSent.message?.direction, 'outgoing', 'Sent message should be outgoing.');
  assert.equal(
    runtimeApi.getConversationMessages(conversationId).length,
    before + 1,
    'Message list should grow after sending a message.',
  );

  for (let index = 0; index < 4; index += 1) {
    runtimeApi.sendMessage({ conversationId, text: `Follow-up message ${index + 1}` });
  }

  expectEvent('first_message_sent');
  expectEvent('first_message_reply');
  expectEvent('conversation_reached_6_messages');
  assert.equal(
    countEvent('conversation_reached_6_messages'),
    1,
    '6-message milestone should be tracked exactly once.',
  );

  const translation = runtimeApi.setTranslationToggle({
    conversationId,
    enabled: true,
    targetLocale: 'ru',
  });
  assert.equal(translation.enabled, true, 'Translation toggle should persist conversation state.');
  assert.equal(
    runtimeApi.isTranslationEnabled(conversationId),
    true,
    'Conversation translation state should be queryable after toggle.',
  );
  expectEvent('translation_toggle_changed');

  runtimeApi.setConversationRelationState({ conversationId, state: 'blocked_by_me' });
  expectEvent('block_user');
  const blockedAttempt = runtimeApi.sendMessage({
    conversationId,
    text: 'This should not be sent while blocked.',
  });
  assert.equal(
    blockedAttempt.status,
    'blocked_by_me',
    'Blocked-by-me conversations must reject outgoing messages.',
  );
};

const testSettingsFlow = () => {
  resetRuntime();
  const before = runtimeApi.getSettingsEnvelope();
  const patched = runtimeApi.patchSettings({
    patch: {
      privacy: {
        hideAge: true,
        hideDistance: true,
      },
      preferences: {
        language: 'ru',
        distanceKm: 40,
      },
      translation: {
        targetLocale: 'ru',
      },
    },
  });

  assert.equal(patched.settings.privacy.hideAge, true, 'Hide age should be persisted.');
  assert.equal(patched.settings.privacy.hideDistance, true, 'Hide distance should be persisted.');
  assert.equal(patched.settings.preferences.language, 'ru', 'Language preference must persist.');
  assert.equal(
    patched.settings.translation.targetLocale,
    'ru',
    'Translation target locale must stay aligned with settings.',
  );
  assert.equal(
    patched.settings.notifications.matches,
    before.settings.notifications.matches,
    'Patch merge should keep unrelated settings untouched.',
  );

  assert.equal(
    patched.travelPassServerAccess.canChangeServer,
    false,
    'Travel server change should stay locked when no travel entitlement is active.',
  );

  const bundleTravel = runtimeApi.patchSettings({
    patch: {
      preferences: {
        travelPassEntitlementSource: 'bundle_included',
        travelPassEntitlementExpiresAtIso: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    },
  });
  assert.equal(
    bundleTravel.travelPassServerAccess.canChangeServer,
    true,
    'Free users should gain travel server access when an active bundle includes Travel Pass.',
  );
  assert.equal(
    bundleTravel.travelPassServerAccess.source,
    'bundle_included',
    'Travel server source should expose bundle entitlement when applicable.',
  );

  runtimeApi.setPlanTier('platinum');
  const platinumTravel = runtimeApi.getSettingsEnvelope();
  assert.equal(
    platinumTravel.travelPassServerAccess.source,
    'plan_included',
    'Platinum plan should include travel server access regardless of direct pass purchase.',
  );
};

const run = () => {
  testDiscoverFlow();
  testLikesFlow();
  testChatFlow();
  testSettingsFlow();
  console.log('runtime-spec-check: all checks passed');
};

run();
