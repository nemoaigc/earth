/**
 * Browser-side TextToSpeechProvider that POSTs to /api/tts.
 * Returns null when the server responds 204 (provider not configured),
 * so the UI degrades gracefully to text-only.
 */

import type { TextToSpeechProvider } from '../types';

export const httpTtsProvider: TextToSpeechProvider = {
  name: 'proxy-tts',

  async synthesize(text, opts) {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId: opts?.voiceId }),
      signal: opts?.signal,
    });

    if (res.status === 204) {
      // TTS not configured on the server — return a no-op.
      return { url: '', mime: '', dispose: () => {} };
    }
    if (!res.ok) throw new Error(`TTS proxy ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    return {
      url,
      mime: blob.type || 'audio/mpeg',
      dispose: () => URL.revokeObjectURL(url),
    };
  },
};
