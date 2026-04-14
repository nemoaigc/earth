# Spec: Real LLM streaming chat provider

**Status:** draft · **Owner:** Eris · **Target:** P0

## Goal
Replace `mockChatProvider` with a production streaming LLM so
"Narrate" + follow-up questions produce fresh, context-aware text.

## Non-goals
- Custom fine-tuning / RAG. The animal's facts already live in
  `AnimalInfo`; we pass them as system context.
- Multi-model routing. One provider per deploy; swap via env.

## Approach

### Secrets architecture
Browser code must never see the API key. Route every request through
a thin proxy:

```
[browser] ── POST /api/chat ──► [edge function] ──► [Anthropic / OpenAI / DeepSeek]
                                    │
                                    ├─ attaches API key from env
                                    ├─ streams response back
                                    └─ optional per-IP rate limiting
```

Deploy target: **Vercel Edge Functions** (easiest), fallback to
**Cloudflare Workers** if cost matters.

### Transport
- Browser → proxy: `fetch('/api/chat', { body: { animalId, messages } })`
  with `Response.body.getReader()` consumed as a `ReadableStream`.
- Proxy → model: the model SDK's native streaming (Anthropic
  `messages.stream()`, OpenAI `chat.completions.create({stream: true})`).
- Proxy → browser: Server-Sent Events (`text/event-stream`). Each
  chunk is `data: {"delta":"word "}`.
- Browser adapter converts SSE stream → `AsyncIterable<string>` so it
  plugs straight into the existing `StreamChatProvider` interface.

### Provider selection
Compile-time via Vite env:
```
VITE_LLM_PROVIDER=claude   # or openai | deepseek
```
Proxy picks the corresponding SDK path based on its own env (not the
browser's), keeps keys out of the bundle.

Provider files (new):
- `src/ai/providers/sse-client.ts` — generic SSE → AsyncIterable helper
- `src/ai/providers/http-chat.ts` — posts to `/api/chat`, returns
  `StreamChatProvider` implementation
- `api/chat.ts` — Vercel edge function: dispatches on `process.env.LLM_PROVIDER`

### System prompt
Move out of `AnimalPanel` into `src/ai/prompts.ts`:
```ts
export function buildSystemPrompt(info: AnimalInfo): string {
  return [
    'You are the narrator of the Lost Planet exhibit...',
    `Subject: ${info.name} (${info.scientificName}).`,
    `Status: ${info.status}. ${info.extinctYear ? 'Extinct since ' + info.extinctYear + '.' : ''}`,
    `Range: ${info.region}. Habitat: ${info.habitat}.`,
    `Cause of decline: ${info.cause}.`,
    `Additional facts: ${info.blurb}`,
    'Keep the first narration under 120 words. For follow-ups, answer concisely and factually; if the question is outside your knowledge, say so.',
  ].join('\n');
}
```

### Rate limiting
Edge function: cap at 10 requests / minute / IP via Upstash Redis or
a simple in-memory Map (edge runtimes forgive losing counter state).

### Failure modes
- Model 429 / 5xx: proxy returns 503 with `Retry-After`. Client
  shows "Too many questions — take a breath." and re-enables input.
- Model returns empty: surface as "No response — try rewording."
- Network drop mid-stream: already handled by `AbortController` in
  `AnimalPanel.runChat`; the partial text is kept.

## Files touched
- `src/ai/providers/http-chat.ts` (new)
- `src/ai/providers/sse-client.ts` (new)
- `src/ai/prompts.ts` (new)
- `src/main.ts` — replace default mock with `httpChatProvider` when
  `import.meta.env.VITE_LLM_PROVIDER` is set
- `api/chat.ts` (new, at repo root for Vercel)
- `vercel.json` (new, minimal; sets runtime to edge)

## Open questions
- **Caching** — should repeated "Narrate" clicks on the same species
  in the same session return cached text? I lean no (the streaming
  effect is part of the UX), but we could hash + memoize after the
  first full reply.
- **Content moderation** — do we filter user inputs? For an extinct-
  species museum, probably unnecessary, but worth thinking about
  before going fully public.

## Acceptance
- `VITE_LLM_PROVIDER=claude` deploys with no API key in the browser
  bundle (verified by grep)
- Clicking Narrate streams in < 500ms to first token
- Follow-up questions include prior turns in context
- Mock provider still usable when env is unset (no regression)
