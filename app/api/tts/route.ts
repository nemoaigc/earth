/**
 * Route Handler: POST /api/tts
 *
 * Converts text to speech via OpenAI TTS, keeping the key server-side.
 * Returns 204 when TTS_PROVIDER is unset — the client then falls back to the
 * Web Speech API (see src/ai/providers/web-speech-tts.ts). The 204 contract is
 * load-bearing: http-tts.ts treats it as "not configured".
 *
 * Env vars:
 *   TTS_PROVIDER   "openai"   (leave empty to disable → 204)
 *   OPENAI_API_KEY            (required when TTS_PROVIDER=openai)
 *
 * Request body: { text: string }
 * Response: audio/mpeg stream, or 204 No Content when not configured.
 */

function env(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

async function synthesizeOpenAI(text: string): Promise<Response> {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1', input: text, voice: 'nova', response_format: 'mp3' }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}`);
  return new Response(res.body, {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache' },
  });
}

export async function POST(req: Request): Promise<Response> {
  const provider = env('TTS_PROVIDER');
  if (!provider) return new Response(null, { status: 204 });

  let body: { text?: string };
  try {
    body = (await req.json()) as { text?: string };
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const text = (body.text ?? '').trim().slice(0, 4000);
  if (!text) return new Response('Empty text', { status: 400 });

  try {
    if (provider === 'openai') return await synthesizeOpenAI(text);
    return new Response(null, { status: 204 });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : 'TTS error', { status: 502 });
  }
}
