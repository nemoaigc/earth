/**
 * Edge function: /api/tts
 *
 * Converts text to speech via OpenAI TTS. The API key stays server-side.
 * Returns 204 when TTS_PROVIDER is unset — client falls back to Web Speech API.
 *
 * Required env vars (Vercel dashboard):
 *   TTS_PROVIDER   "openai"    (leave empty to disable)
 *   OPENAI_API_KEY             (required when TTS_PROVIDER=openai)
 *
 * Request body: { text: string }
 * Response: audio/mpeg stream, or 204 No Content when not configured.
 */

export const config = { runtime: 'edge' };

const TTS_PROVIDER = process.env.TTS_PROVIDER ?? '';
const OPENAI_KEY   = process.env.OPENAI_API_KEY ?? '';

async function synthesizeOpenAI(text: string): Promise<Response> {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1', input: text, voice: 'nova', response_format: 'mp3' }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}`);
  return new Response(res.body, {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  if (!TTS_PROVIDER) return new Response(null, { status: 204 });

  let body: { text: string };
  try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }

  const text = (body.text ?? '').trim().slice(0, 4000);
  if (!text) return new Response('Empty text', { status: 400 });

  try {
    if (TTS_PROVIDER === 'openai') return await synthesizeOpenAI(text);
    return new Response(null, { status: 204 });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : 'TTS error', { status: 502 });
  }
}
