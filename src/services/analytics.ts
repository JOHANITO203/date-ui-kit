import type { AnalyticsEvent, AnalyticsEventName, AnalyticsEventPayload } from '../contracts';
import { captureAnalyticsEvent } from './monitoring';

const ANALYTICS_STORAGE_KEY = 'exotic.analytics.events.v1';
const ANALYTICS_MAX_EVENTS = 300;

const readStoredEvents = (): AnalyticsEvent[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(ANALYTICS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is AnalyticsEvent => {
      if (!entry || typeof entry !== 'object') return false;
      return (
        typeof (entry as AnalyticsEvent).id === 'string' &&
        typeof (entry as AnalyticsEvent).name === 'string' &&
        typeof (entry as AnalyticsEvent).timestampIso === 'string' &&
        typeof (entry as AnalyticsEvent).payload === 'object'
      );
    });
  } catch {
    return [];
  }
};

const persistEvents = (events: AnalyticsEvent[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(events.slice(-ANALYTICS_MAX_EVENTS)));
  } catch {
    // Ignore storage quota/permission failures.
  }
};

const events: AnalyticsEvent[] = readStoredEvents();

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const trackEvent = (name: AnalyticsEventName, payload: AnalyticsEventPayload): AnalyticsEvent => {
  const event: AnalyticsEvent = {
    id: makeId('evt'),
    name,
    timestampIso: new Date().toISOString(),
    payload,
  };
  events.push(event);
  if (events.length > ANALYTICS_MAX_EVENTS) {
    events.splice(0, events.length - ANALYTICS_MAX_EVENTS);
  }
  persistEvents(events);
  captureAnalyticsEvent(event);
  return event;
};

export const getTrackedEvents = () => [...events];

export const clearTrackedEvents = () => {
  events.length = 0;
  persistEvents(events);
};
