/**
 * Runtime AI capabilities the UI depends on.
 *
 * We deliberately keep this tiny: chat streaming + optional TTS for the
 * narration voice. Everything that can be baked ahead of time (species
 * photos, vocalisation recordings) lives in /public/ as static assets
 * — see scripts/fetch-animal-photos.mjs and
 * scripts/generate-animal-sounds.mjs.
 *
 * Providers are registered at bootstrap via `registerAi({...})` in
 * registry.ts, or by attaching to window globals for quick prototyping.
 */

import type { AnimalInfo } from '../data/animals';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Streaming text generation for narration + conversational follow-ups.
 */
export interface StreamChatProvider {
  readonly name: string;
  stream(
    animal: AnimalInfo,
    messages: ChatMessage[],
    signal?: AbortSignal,
  ): AsyncIterable<string>;
}

/**
 * Text-to-speech for reading the narrator voice out loud.
 * Returns a ready-to-play audio URL.
 */
export interface TextToSpeechProvider {
  readonly name: string;
  synthesize(
    text: string,
    opts?: { voiceId?: string; signal?: AbortSignal },
  ): Promise<{
    url: string;
    mime: string;
    dispose?: () => void;
  }>;
}

export interface AiRegistry {
  chat?: StreamChatProvider;
  tts?: TextToSpeechProvider;
}
