import type { AiRegistry, StreamChatProvider, TextToSpeechProvider } from './types';
import { mockChatProvider } from './mock';

/**
 * Single mutable registry. The UI reads from here when it needs to
 * stream a narration or synthesise voice. Providers can be swapped
 * freely at runtime.
 *
 * One-command cloud activation (Vercel dashboard):
 *   VITE_LLM_PROXY=1   →  enables /api/chat proxy (set LLM_PROVIDER +
 *                          the corresponding API key on the server side)
 *   VITE_TTS_PROXY=1   →  enables /api/tts proxy (set TTS_PROVIDER +
 *                          ELEVENLABS_API_KEY or OPENAI_API_KEY server-side)
 *
 * Without these flags the mock chat provider is used and TTS is silent.
 */

// Lazily import the proxy providers only when the feature flags are set,
// so their fetch() calls don't appear in the bundle when disabled.
async function loadProxies() {
  if (import.meta.env.VITE_LLM_PROXY === '1') {
    const { httpChatProvider } = await import('./providers/http-chat');
    registerAi({ chat: httpChatProvider });
  }

  if (import.meta.env.VITE_TTS_PROXY === '1') {
    // Production: key stays server-side in edge function.
    const { httpTtsProvider } = await import('./providers/http-tts');
    registerAi({ tts: httpTtsProvider });
  } else if (import.meta.env.VITE_ELEVENLABS_API_KEY) {
    // Dev: call ElevenLabs directly (key visible in browser — dev only).
    const { elevenLabsTtsProvider } = await import('./providers/elevenlabs-tts');
    registerAi({ tts: elevenLabsTtsProvider });
  }
}

const registry: AiRegistry = {
  chat: mockChatProvider,
  tts: undefined,
};

export function registerAi(patch: Partial<AiRegistry>): void {
  if (patch.chat !== undefined) registry.chat = patch.chat;
  if (patch.tts !== undefined) registry.tts = patch.tts;
}

export function getChat(): StreamChatProvider | undefined { return registry.chat; }
export function getTts(): TextToSpeechProvider | undefined { return registry.tts; }

// Allow runtime injection from devtools / bookmarklets.
declare global {
  interface Window { __EARTH_AI__?: Partial<AiRegistry>; }
}

if (typeof window !== 'undefined') {
  if (window.__EARTH_AI__) registerAi(window.__EARTH_AI__);
  void loadProxies();
}
