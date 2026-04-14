# Spec: TTS narration voice

**Status:** draft · **Owner:** Eris · **Target:** P0

## Goal
Read the AI narration out loud — preferably starting playback before
the full text has streamed in, so the voice feels like a live narrator
rather than a recording.

## Non-goals
- User-specific voice cloning
- Real-time voice conversation (one-way TTS only)
- Multilingual voices (app is English-only now)

## Approach

### Provider
**Cartesia Sonic** as primary — the only mainstream TTS with real
chunk-by-chunk streaming (first audio byte ~200 ms after first text
byte). Fallback to **OpenAI TTS** (not streaming but cheap) if
Cartesia quota is exhausted.

### Streaming contract
Same proxy pattern as chat (keys never reach the browser):

```
[browser] ──► POST /api/tts  { text, voiceId } ──► [edge] ──► Cartesia
                                                       │
                                                       └─ returns opus chunks
```

Browser plays chunks via `MediaSource` + `SourceBuffer`, appending as
they arrive. This is tricky — if Cartesia fails we fall back to a
single-shot `Blob` URL.

### Coordinating with chat
Two speeds collide: text streams fast, TTS streams slower. Options:
1. **Sentence chunking** — buffer text until we hit `.!?`, send that
   sentence to TTS, begin playback. Next sentence arrives while first
   is playing. Lowest complexity, matches most narration apps.
2. **Full-sentence batch at end** — wait for the chat stream to
   complete, synth the whole reply, play. Simpler but kills the
   "live narrator" feel.

Go with **sentence chunking**. Needs a small `sentenceSplitter()`
helper in `src/ai/sentence-stream.ts`.

### Voice control
- Single default voice (male, mid-range, warm — test Cartesia's
  "Newsman" and "Storyteller").
- Persist `voiceId` in `localStorage` under `lostplanet.voice`.
- No UI picker in v1; add one only if we get multi-voice requests.

### Auto-play consent
First narration requires a user gesture (click). We already have one
(the Narrate button), so no extra consent flow needed. For automatic
replays, treat the existing button click as ambient consent for the
session.

## Interfaces

```ts
// src/ai/types.ts (existing, unchanged)
export interface TextToSpeechProvider {
  readonly name: string;
  synthesize(text: string, opts?: { voiceId?: string; signal?: AbortSignal }):
    Promise<{ url: string; mime: string; dispose?: () => void }>;
}
```

New streaming interface, opt-in:

```ts
// src/ai/types.ts (new)
export interface StreamingTtsProvider extends TextToSpeechProvider {
  /** Incrementally feed text; returns an audio element already playing. */
  openStream(voiceId?: string): {
    feed(text: string): void;
    close(): void;
    audio: HTMLAudioElement;
  };
}
```

`AnimalPanel.runChat` uses `openStream()` when the provider supports
it, else falls back to `synthesize()` with the full text at the end.

## Files touched
- `src/ai/providers/cartesia-tts.ts` (new, streaming)
- `src/ai/providers/openai-tts.ts` (new, non-streaming fallback)
- `src/ai/sentence-stream.ts` (new, utility)
- `src/ai/registry.ts` — register TTS based on env
- `src/ui/AnimalPanel.ts` — hook sentence chunker to chat stream;
  pipe chunks into `tts.openStream()` when available
- `api/tts.ts` (new, edge function)

## Open questions
- **Latency budget** — aiming for < 400 ms from Narrate click to
  first audible word. Cartesia usually hits this. If not, we accept
  up to 700 ms and move on.
- **Overlap** — what if user clicks Replay while previous audio is
  still playing? Current plan: stop the in-flight `HTMLAudioElement`
  (`stopEverything()` already does this) and start fresh.

## Acceptance
- Narrate click → first spoken word within 400 ms of first streamed
  text token
- Full narration plays through without audio gaps
- Stopping mid-narration (switching species, closing panel) cuts
  audio cleanly
- Works on Safari + Chrome + mobile Chrome (MediaSource support)
