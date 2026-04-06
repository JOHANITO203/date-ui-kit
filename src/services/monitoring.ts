import type { AnalyticsEvent } from '../contracts';

const MONITORING_ENDPOINT =
  (import.meta.env.VITE_MONITORING_LOG_ENDPOINT as string | undefined)?.trim() ?? '';
const ANALYTICS_ENDPOINT =
  (import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined)?.trim() ?? '';

type MonitoringLevel = 'info' | 'warn' | 'error';

type MonitoringPayload = {
  level: MonitoringLevel;
  source: 'frontend';
  category: 'runtime_error' | 'unhandled_rejection' | 'analytics';
  message: string;
  timestampIso: string;
  metadata?: Record<string, unknown>;
};

const postPayload = (endpoint: string, payload: MonitoringPayload | AnalyticsEvent) => {
  if (!endpoint) return;
  const body = JSON.stringify(payload);
  try {
    const blob = new Blob([body], { type: 'application/json' });
    if (!navigator.sendBeacon(endpoint, blob)) {
      void fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
        keepalive: true,
      });
    }
  } catch {
    // Keep monitoring non-blocking.
  }
};

const buildPayload = (
  level: MonitoringLevel,
  category: MonitoringPayload['category'],
  message: string,
  metadata?: Record<string, unknown>,
): MonitoringPayload => ({
  level,
  source: 'frontend',
  category,
  message,
  timestampIso: new Date().toISOString(),
  metadata,
});

export const logMonitoring = (
  level: MonitoringLevel,
  category: MonitoringPayload['category'],
  message: string,
  metadata?: Record<string, unknown>,
) => {
  const payload = buildPayload(level, category, message, metadata);
  if (level === 'error') {
    console.error('[monitoring]', payload);
  } else if (level === 'warn') {
    console.warn('[monitoring]', payload);
  } else {
    console.info('[monitoring]', payload);
  }
  postPayload(MONITORING_ENDPOINT, payload);
};

export const captureAnalyticsEvent = (event: AnalyticsEvent) => {
  if (!ANALYTICS_ENDPOINT) return;
  postPayload(ANALYTICS_ENDPOINT, event);
};

export const initMonitoring = () => {
  const onRuntimeError = (event: ErrorEvent) => {
    logMonitoring('error', 'runtime_error', event.message, {
      file: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason =
      typeof event.reason === 'string'
        ? event.reason
        : event.reason instanceof Error
          ? event.reason.message
          : 'unknown_rejection';
    logMonitoring('error', 'unhandled_rejection', reason);
  };

  window.addEventListener('error', onRuntimeError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  return () => {
    window.removeEventListener('error', onRuntimeError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
};

