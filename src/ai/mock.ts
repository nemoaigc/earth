import type { AnimalInfo } from '../data/animals';
import type { ChatMessage, StreamChatProvider } from './types';

/**
 * Local fallback used when no real LLM provider is wired up.
 *
 * For the first assistant turn (pure narration) it assembles a
 * deterministic intro from the data we already ship, and streams
 * it character-by-character so the UI still exercises the streaming
 * codepath. For subsequent turns it acknowledges the question but
 * makes it explicit that this is mocked — production will route
 * through a real model.
 */
function buildNarration(info: AnimalInfo): string {
  const opening = info.status === 'extinct'
    ? `The ${info.name} is gone from this world.`
    : `The ${info.name} still clings on — but barely.`;
  const profile = `It lived in ${info.habitat.toLowerCase()}, across ${info.region}. ${info.blurb}`;
  const pressure = info.status === 'extinct'
    ? `The thread that undid it: ${info.cause.toLowerCase()}.`
    : `The pressure it faces today: ${info.cause.toLowerCase()}.`;
  return `${opening}\n\n${profile}\n\n${pressure}`;
}

async function* streamText(text: string, signal?: AbortSignal, chunkSize = 3, delayMs = 18) {
  // Chunk through graphemes-ish (good enough for Chinese + Latin) and
  // yield each slice so the UI can paint word-by-word.
  for (let i = 0; i < text.length; i += chunkSize) {
    if (signal?.aborted) return;
    await new Promise((r) => setTimeout(r, delayMs));
    yield text.slice(i, i + chunkSize);
  }
}

export const mockChatProvider: StreamChatProvider = {
  name: 'local-mock',
  async *stream(info, messages, signal) {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const isOpeningTurn = !messages.some((m) => m.role === 'assistant');

    if (isOpeningTurn) {
      yield* streamText(buildNarration(info), signal);
      return;
    }

    const q = lastUser?.content?.trim() ?? '';
    const reply = q
      ? `About "${q}" — this is still an offline placeholder. Once you wire up a real LLM, the same streaming pipeline will carry the model's answer instead.`
      : `(empty prompt) This is a placeholder reply; it will be replaced by a streamed model response once a chat provider is registered.`;
    yield* streamText(reply, signal);
  },
};

export type { ChatMessage };
