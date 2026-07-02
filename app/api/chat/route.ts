/**
 * Route Handler: POST /api/chat
 *
 * Streams an LLM response to the browser as Server-Sent Events so the API key
 * never reaches the client bundle. Provider + credentials are chosen purely via
 * environment variables — no code changes to switch models or gateways.
 *
 * Env vars (set in .env.local for dev, or the deploy platform's secrets):
 *   LLM_PROVIDER          "claude" | "openai" | "deepseek"   (default: mock)
 *   ANTHROPIC_API_KEY     key for the claude provider
 *   ANTHROPIC_BASE_URL    default "https://api.anthropic.com" — override to use a gateway
 *   ANTHROPIC_MODEL       default "claude-opus-4-5"
 *   ANTHROPIC_EXTRA_HEADERS  optional JSON object of extra headers (e.g. gateway routing headers)
 *   OPENAI_API_KEY        key for openai
 *   DEEPSEEK_API_KEY      key for deepseek
 *
 * Request body: { messages: ChatMessage[], animalId?: string }
 * Response: text/event-stream — each event is `data: {"delta":"..."}`, then `data: [DONE]`.
 *
 * Runtime is left as the platform default (Node-compatible). The body uses only
 * Web Fetch APIs (fetch / ReadableStream / TextEncoder) so it runs unchanged on
 * a Cloudflare Worker via OpenNext as well as on Node.
 */

interface ChatMessage { role: string; content: string }
interface ReqBody { messages?: ChatMessage[]; animalId?: string }

function env(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

// ---- Provider adapters --------------------------------------------------

async function* streamClaude(messages: ChatMessage[], signal?: AbortSignal): AsyncIterable<string> {
  // Anthropic's Messages API rejects role:"system" entries inside `messages`;
  // the system prompt must be lifted to the top-level `system` field. The old
  // production /api/chat forwarded messages verbatim (a real, latent bug); the
  // dev shim (api/server.mjs) did this extraction. We keep the correct behavior.
  const system = messages.find((m) => m.role === 'system')?.content;
  const convo = messages.filter((m) => m.role !== 'system');

  const baseUrl = env('ANTHROPIC_BASE_URL', 'https://api.anthropic.com');
  const headers: Record<string, string> = {
    'x-api-key': env('ANTHROPIC_API_KEY'),
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  };
  try {
    const extra = env('ANTHROPIC_EXTRA_HEADERS');
    if (extra) Object.assign(headers, JSON.parse(extra) as Record<string, string>);
  } catch {
    /* ignore malformed ANTHROPIC_EXTRA_HEADERS */
  }

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({
      model: env('ANTHROPIC_MODEL', 'claude-opus-4-5'),
      max_tokens: 512,
      stream: true,
      ...(system ? { system } : {}),
      messages: convo,
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
        if (j.type === 'message_stop') return;
        const delta = j.delta?.text ?? j.delta?.content?.[0]?.text ?? '';
        if (delta) yield delta as string;
      } catch {
        /* skip non-JSON keep-alive lines */
      }
    }
  }
}

async function* streamOpenAI(
  messages: ChatMessage[],
  baseUrl = 'https://api.openai.com',
  key = env('OPENAI_API_KEY'),
  model = 'gpt-4o-mini',
  signal?: AbortSignal,
): AsyncIterable<string> {
  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    signal,
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
      try {
        const d = JSON.parse(data).choices?.[0]?.delta?.content;
        if (d) yield d as string;
      } catch {
        /* skip */
      }
    }
  }
}

async function* streamDeepSeek(messages: ChatMessage[], signal?: AbortSignal): AsyncIterable<string> {
  yield* streamOpenAI(messages, 'https://api.deepseek.com', env('DEEPSEEK_API_KEY'), 'deepseek-chat', signal);
}

async function* streamMock(messages: ChatMessage[], signal?: AbortSignal): AsyncIterable<string> {
  const last = messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
  const text = `(mock) Received: "${last.slice(0, 60)}". Set LLM_PROVIDER + an API key to activate a real model.`;
  for (const ch of text) {
    if (signal?.aborted) return;
    yield ch;
    await new Promise((r) => setTimeout(r, 12));
  }
}

// ---- Handler ------------------------------------------------------------

export async function POST(req: Request): Promise<Response> {
  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const messages: ChatMessage[] = body.messages ?? [];
  const provider = env('LLM_PROVIDER', 'mock');

  // Abort the upstream LLM request when the client disconnects or the stream is
  // cancelled, so cancelled chats stop billing tokens and don't leak a connection.
  const ac = new AbortController();
  if (req.signal.aborted) ac.abort();
  else req.signal.addEventListener('abort', () => ac.abort(), { once: true });
  const signal = ac.signal;

  async function* stream(): AsyncIterable<string> {
    switch (provider) {
      case 'claude':   yield* streamClaude(messages, signal); break;
      case 'openai':   yield* streamOpenAI(messages, undefined, undefined, undefined, signal); break;
      case 'deepseek': yield* streamDeepSeek(messages, signal); break;
      default:         yield* streamMock(messages, signal);
    }
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream()) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk })}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        // Client gone / aborted: the consumer is gone, so don't try to enqueue.
        if (signal.aborted) return;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } catch {
          /* controller already closed */
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed/errored */
        }
      }
    },
    cancel() {
      ac.abort();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
