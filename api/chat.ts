/**
 * Edge function: /api/chat
 *
 * Streams an LLM response back to the browser as Server-Sent Events so
 * the API key never touches the client bundle. Provider is chosen via
 * environment variables set in the Vercel dashboard — no code changes
 * needed when switching models.
 *
 * Required env vars (set in Vercel → Settings → Environment Variables):
 *   LLM_PROVIDER   "claude" | "openai" | "deepseek"  (default: mock)
 *   ANTHROPIC_API_KEY   (if LLM_PROVIDER=claude)
 *   OPENAI_API_KEY      (if LLM_PROVIDER=openai)
 *   DEEPSEEK_API_KEY    (if LLM_PROVIDER=deepseek)
 *
 * Request body: { messages: ChatMessage[], animalId: string }
 * Response: text/event-stream; each event is `data: {"delta":"..."}`.
 */

export const config = { runtime: 'edge' };

interface ChatMessage { role: string; content: string }
interface Req { messages: ChatMessage[]; animalId?: string }

const PROVIDER = process.env.LLM_PROVIDER ?? 'mock';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const OPENAI_KEY    = process.env.OPENAI_API_KEY ?? '';
const DEEPSEEK_KEY  = process.env.DEEPSEEK_API_KEY ?? '';

// Rate limiting: Edge functions are stateless — in-memory Maps reset on every
// cold start and are not shared between isolates. For real rate limiting, use
// Upstash Redis + @upstash/ratelimit (set UPSTASH_REDIS_REST_URL +
// UPSTASH_REDIS_REST_TOKEN in Vercel env vars, then wrap the handler).
// Until that is wired up, rate limiting is intentionally skipped.
function isRateLimited(_ip: string): boolean { return false; }

// ---- Provider adapters --------------------------------------------------

async function* streamClaude(messages: ChatMessage[]): AsyncIterable<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      stream: true,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
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
        const delta = j.delta?.text ?? j.delta?.content?.[0]?.text ?? '';
        if (delta) yield delta;
      } catch {}
    }
  }
}

async function* streamOpenAI(messages: ChatMessage[], baseUrl = 'https://api.openai.com', key = OPENAI_KEY, model = 'gpt-4o-mini'): AsyncIterable<string> {
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: true, max_tokens: 512, messages }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
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
      try { const d = JSON.parse(data).choices?.[0]?.delta?.content; if (d) yield d; } catch {}
    }
  }
}

async function* streamDeepSeek(messages: ChatMessage[]): AsyncIterable<string> {
  yield* streamOpenAI(messages, 'https://api.deepseek.com', DEEPSEEK_KEY, 'deepseek-chat');
}

async function* streamMock(messages: ChatMessage[]): AsyncIterable<string> {
  const last = messages.filter(m => m.role === 'user').at(-1)?.content ?? '';
  const text = `(mock) Received: "${last.slice(0, 60)}". Plug in a real LLM provider via Vercel env vars to activate.`;
  for (const ch of text) {
    yield ch;
    await new Promise(r => setTimeout(r, 12));
  }
}

// ---- Edge handler -------------------------------------------------------

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(ip)) return new Response('Too Many Requests', { status: 429 });

  let body: Req;
  try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }

  const messages: ChatMessage[] = body.messages ?? [];

  async function* stream(): AsyncIterable<string> {
    switch (PROVIDER) {
      case 'claude':   yield* streamClaude(messages); break;
      case 'openai':   yield* streamOpenAI(messages); break;
      case 'deepseek': yield* streamDeepSeek(messages); break;
      default:         yield* streamMock(messages);
    }
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream()) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk })}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
