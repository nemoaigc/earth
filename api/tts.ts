/**
 * Edge function: /api/tts
 *
 * Converts text to speech and streams the audio back. The ElevenLabs
 * API key stays on the server. Provider is chosen via env vars.
 *
 * Required env vars (Vercel dashboard):
 *   TTS_PROVIDER     "elevenlabs" | "openai"   (default: none → 204)
 *   ELEVENLABS_API_KEY  (if TTS_PROVIDER=elevenlabs)
 *   OPENAI_API_KEY      (if TTS_PROVIDER=openai)
 *   TTS_VOICE_ID     ElevenLabs voice ID (optional, falls back to a neutral default)
 *
 * Request body: { text: string; voiceId?: string }
 * Response: audio/mpeg stream (or 204 No Content when TTS not configured)
 */

export const config = { runtime: 'edge' };

const TTS_PROVIDER    = process.env.TTS_PROVIDER ?? '';
const EL_KEY          = process.env.ELEVENLABS_API_KEY ?? '';
const OPENAI_KEY      = process.env.OPENAI_API_KEY ?? '';
const DEFAULT_VOICE   = process.env.TTS_VOICE_ID ?? 'onwK4e9ZLuTAKqWW03F9'; // "Daniel" – neutral, warm

async function synthesizeElevenLabs(text: string, voiceId: string): Promise<Response> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
    method: 'POST',
    headers: {
      'xi-api-key': EL_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
  return new Response(res.body, {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' },
  });
}

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

  // If no TTS provider is configured, return 204 so the client falls back
  // to text-only mode without throwing.
  if (!TTS_PROVIDER) return new Response(null, { status: 204 });

  let body: { text: string; voiceId?: string };
  try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }

  const text = (body.text ?? '').trim().slice(0, 4000); // cap to 4 KB
  if (!text) return new Response('Empty text', { status: 400 });

  const voiceId = body.voiceId ?? DEFAULT_VOICE;

  try {
    switch (TTS_PROVIDER) {
      case 'elevenlabs': return await synthesizeElevenLabs(text, voiceId);
      case 'openai':     return await synthesizeOpenAI(text);
      default:           return new Response(null, { status: 204 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'TTS error';
    return new Response(msg, { status: 502 });
  }
}
