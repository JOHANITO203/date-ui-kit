// Client for the AI assistance layer (auth-bff /api/ai/*). Session-cookie auth.
const AUTH_BFF_URL = (import.meta.env.VITE_AUTH_BFF_URL as string | undefined)?.replace(/\/$/, '') ?? '';

type Tone = 'warm' | 'playful' | 'confident' | 'sincere' | 'witty';

const post = async <T>(path: string, body: unknown): Promise<T | null> => {
  try {
    const res = await fetch(`${AUTH_BFF_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; data?: T };
    return json.data ?? null;
  } catch {
    return null;
  }
};

export const aiClient = {
  async isEnabled(): Promise<boolean> {
    try {
      const res = await fetch(`${AUTH_BFF_URL}/api/ai/status`, { credentials: 'include' });
      if (!res.ok) return false;
      const json = (await res.json()) as { enabled?: boolean };
      return Boolean(json.enabled);
    } catch {
      return false;
    }
  },

  optimizeBio(draft: string, tone?: Tone): Promise<{ suggestion: string } | null> {
    return post<{ suggestion: string }>('/api/ai/bio/optimize', { draft, tone });
  },

  suggestReplies(
    messages: Array<{ from: 'me' | 'them'; text: string }>,
    tone?: Tone,
  ): Promise<{ suggestions: string[] } | null> {
    return post<{ suggestions: string[] }>('/api/ai/reply/suggest', { messages, tone });
  },

  translate(text: string, targetLang: 'en' | 'ru' | 'fr'): Promise<{ translated: string } | null> {
    return post<{ translated: string }>('/api/ai/translate', { text, targetLang });
  },
};
