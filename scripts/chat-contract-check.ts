import { translations } from '../src/i18n/translations.ts';

const EXPECTED_RELATION_STATES = ['active', 'blocked_by_me', 'blocked_me'] as const;

const errors: string[] = [];

const assertObjectHasOnlyExpectedKeys = (
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
) => {
  if (!value || typeof value !== 'object') {
    errors.push(`${label}: missing object`);
    return;
  }

  const keys = Object.keys(value as Record<string, unknown>);
  for (const expected of expectedKeys) {
    if (!keys.includes(expected)) {
      errors.push(`${label}: missing key "${expected}"`);
    }
  }
  for (const key of keys) {
    if (!expectedKeys.includes(key)) {
      errors.push(`${label}: unexpected key "${key}"`);
    }
  }
};

for (const locale of ['en', 'ru'] as const) {
  const dictionary = translations[locale] as Record<string, unknown>;
  const messages = dictionary.messages as Record<string, unknown> | undefined;
  const chat = dictionary.chat as Record<string, unknown> | undefined;

  assertObjectHasOnlyExpectedKeys(
    messages?.conversationStates,
    EXPECTED_RELATION_STATES,
    `[${locale}] messages.conversationStates`,
  );
  assertObjectHasOnlyExpectedKeys(
    chat?.conversationStates,
    EXPECTED_RELATION_STATES,
    `[${locale}] chat.conversationStates`,
  );
  assertObjectHasOnlyExpectedKeys(
    chat?.restrictions,
    ['blocked_by_me', 'blocked_me'],
    `[${locale}] chat.restrictions`,
  );
}

if (errors.length > 0) {
  console.error(`chat contract check failed (${errors.length} issues):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('chat contract check passed.');
