/**
 * Browser-side StreamChatProvider that POSTs to /api/chat.
 * Only registered when VITE_LLM_PROXY=1 is set at build time,
 * which is done automatically in Vercel via vercel.json env config.
 */

import type { AnimalInfo } from '../../data/animals';
import type { ChatMessage, StreamChatProvider } from '../types';

export const httpChatProvider: StreamChatProvider = {
  name: 'proxy',

  async *stream(info: AnimalInfo, messages: ChatMessage[], signal?: AbortSignal) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, animalId: info.id }),
      signal,
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error('Too many questions — wait a moment and try again.');
      throw new Error(`Chat proxy ${res.status}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;
        try {
          const j = JSON.parse(data);
          if (j.error) throw new Error(j.error);
          if (j.delta) yield j.delta as string;
        } catch (e) {
          if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e;
        }
      }
    }
  },
};
