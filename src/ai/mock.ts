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
    ? `${info.nameCn}已经从地球上消失。`
    : `${info.nameCn}仍在这个星球上，但处境非常脆弱。`;
  const profile = `它主要生活在${info.habitat}，分布于${info.region}。${info.blurb}`;
  const pressure = info.status === 'extinct'
    ? `核心诱因是${info.cause}。`
    : `最主要的压力来自${info.cause}。`;
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
      ? `关于“${q}”——目前这还是本地离线回答。正式上线时我们会把你的问题送到真正的大模型，然后拿到更自然的流式回应。`
      : `（无输入）这里是占位回答，等你接入真正的对话模型后就会换成流式结果。`;
    yield* streamText(reply, signal);
  },
};

export type { ChatMessage };
