/**
 * Direct browser → ElevenLabs TTS.
 * For LOCAL DEV ONLY — requires VITE_ELEVENLABS_API_KEY in .env.local.
 * The key is visible in the browser; never use this provider in production.
 * Production uses /api/tts (http-tts.ts) which keeps the key server-side.
 */
import type { TextToSpeechProvider } from '../types';

const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY as string;
const DEFAULT_VOICE = 'onwK4e9ZLuTAKqWW03F9'; // ElevenLabs "Daniel" — neutral narrator

export const elevenLabsTtsProvider: TextToSpeechProvider = {
  name: 'elevenlabs-direct',

  async synthesize(text, opts) {
    const voiceId = opts?.voiceId ?? DEFAULT_VOICE;
    const trimmed = text.trim().slice(0, 4000);

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': API_KEY,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: trimmed,
          model_id: 'eleven_turbo_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
        signal: opts?.signal,
      }
    );

    if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    return { url, mime: 'audio/mpeg', dispose: () => URL.revokeObjectURL(url) };
  },
};
