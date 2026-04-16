/**
 * Free TTS using the browser-native SpeechSynthesis API.
 * No API key required. Works in Chrome, Edge, Safari, Firefox.
 * Quality depends on the OS system voices (best on macOS/Windows).
 *
 * The provider speaks the text internally, then returns an empty URL
 * so AnimalPanel skips the HTMLAudioElement pathway.
 */
import type { TextToSpeechProvider } from '../types';

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  // Prefer a high-quality local English voice.
  return (
    voices.find(v => v.lang === 'en-US' && v.localService && v.name.includes('Natural'))
    ?? voices.find(v => v.lang === 'en-US' && v.localService)
    ?? voices.find(v => v.lang.startsWith('en') && v.localService)
    ?? voices.find(v => v.lang.startsWith('en'))
    ?? voices[0]
    ?? null
  );
}

export const webSpeechTtsProvider: TextToSpeechProvider = {
  name: 'web-speech',

  async synthesize(text, opts) {
    if (!('speechSynthesis' in window)) {
      return { url: '', mime: '' }; // not supported — no-op
    }
    if (opts?.signal?.aborted) return { url: '', mime: '' };

    // Chrome requires voices to be loaded asynchronously on first call.
    if (speechSynthesis.getVoices().length === 0) {
      await new Promise<void>(r => {
        const onVoices = () => { r(); speechSynthesis.removeEventListener('voiceschanged', onVoices); };
        speechSynthesis.addEventListener('voiceschanged', onVoices);
        // Fallback in case the event never fires (e.g. already loaded).
        setTimeout(r, 500);
      });
    }

    return new Promise(resolve => {
      // Stop anything currently playing.
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text.slice(0, 4000));
      const voice = pickVoice();
      if (voice) utterance.voice = voice;
      utterance.rate  = 0.95;
      utterance.pitch = 1.0;
      utterance.lang  = 'en-US';

      const done = () => resolve({ url: '', mime: '' });

      utterance.onend   = done;
      utterance.onerror = done; // non-fatal — text is still visible on screen

      // Respect abort (e.g. user closes panel mid-speech).
      opts?.signal?.addEventListener('abort', () => {
        speechSynthesis.cancel();
        done();
      }, { once: true });

      speechSynthesis.speak(utterance);
    });
  },
};
