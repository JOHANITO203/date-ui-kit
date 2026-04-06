import type { AnalyticsEvent, AnalyticsEventName, AnalyticsEventPayload } from '../contracts';
import { captureAnalyticsEvent } from './monitoring';

const events: AnalyticsEvent[] = [];

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const trackEvent = (name: AnalyticsEventName, payload: AnalyticsEventPayload): AnalyticsEvent => {
  const event: AnalyticsEvent = {
    id: makeId('evt'),
    name,
    timestampIso: new Date().toISOString(),
    payload,
  };
  events.push(event);
  captureAnalyticsEvent(event);
  return event;
};

export const getTrackedEvents = () => [...events];

export const clearTrackedEvents = () => {
  events.length = 0;
};
