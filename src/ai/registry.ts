import type { AiRegistry, StreamChatProvider, TextToSpeechProvider } from './types';
import { mockChatProvider } from './mock';

/**
 * Single mutable registry. The UI reads from here when it needs to
 * stream a narration or synthesise voice. Providers can be swapped
 * freely at runtime (useful for A/B-ing different LLMs).
 */
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

// Let callers attach providers from devtools / bookmarklets without
// rebuilding (window.__EARTH_AI__ = { chat: ..., tts: ... })
declare global {
  interface Window {
    __EARTH_AI__?: Partial<AiRegistry>;
  }
}

if (typeof window !== 'undefined' && window.__EARTH_AI__) {
  registerAi(window.__EARTH_AI__);
}
