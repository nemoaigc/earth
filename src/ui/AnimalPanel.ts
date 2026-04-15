import './animal-panel.css';
import type { AnimalInfo } from '../data/animals';
import type { ChatMessage } from '../ai/types';
import { getChat, getTts } from '../ai/registry';
import soundManifest from '../../public/animal-sounds/manifest.json';

const STATUS_COLORS = {
  extinct:    { bg: 'rgba(120, 122, 128, 0.14)', text: '#7f8794', label: 'EXTINCT'    },
  endangered: { bg: 'rgba(255, 95, 87, 0.14)',   text: '#f85d54', label: 'ENDANGERED' },
} as const;

type ChatState =
  | { status: 'idle' }
  | { status: 'streaming'; turns: ChatMessage[]; liveText: string }
  | { status: 'ready'; turns: ChatMessage[] }
  | { status: 'error'; turns: ChatMessage[]; message: string };

type SoundState =
  | { status: 'idle' }
  | { status: 'playing' }
  | { status: 'unavailable' };

interface SoundEntry {
  file: string;
  version?: number;
  accepted?: boolean | null;
  generated?: boolean;
  prompt?: string;
}

interface SoundManifest {
  provider: string;
  generatedAt: string;
  files: Record<string, string | SoundEntry | null>;
}

function resolveSound(entry: string | SoundEntry | null | undefined): SoundEntry | null {
  if (!entry) return null;
  if (typeof entry === 'string') return { file: entry, accepted: true, generated: true };
  // If the reviewer explicitly rejected this clip, treat as unavailable.
  if (entry.accepted === false) return null;
  return entry;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderParagraphs(text: string): string {
  return text.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p.trim())}</p>`).join('');
}

export class AnimalPanel {
  private container: HTMLDivElement;
  private current: AnimalInfo | null = null;
  private heroImage: string | null = null;

  private chat: ChatState = { status: 'idle' };
  private chatAbort: AbortController | null = null;

  private sound: SoundState = { status: 'idle' };
  private audio = new Audio();

  private tts: { url: string; dispose?: () => void } | null = null;
  private ttsAudio = new Audio();

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'animal-panel';
    document.body.appendChild(this.container);

    this.audio.addEventListener('ended', () => {
      if (this.sound.status === 'playing') {
        this.sound = { status: 'idle' };
        this.render();
      }
    });
  }

  show(info: AnimalInfo) {
    const isSame = this.current?.id === info.id;
    this.current = info;
    this.heroImage = `/animal-photos/${info.id}.jpg`;

    if (!isSame) {
      this.stopEverything();
      this.chat = { status: 'idle' };
      this.sound = { status: 'idle' };
    }

    this.render();
    this.container.classList.add('is-visible');
  }

  hide() {
    this.stopEverything();
    this.current = null;
    this.container.classList.remove('is-visible');
  }

  private stopEverything() {
    this.chatAbort?.abort();
    this.chatAbort = null;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.ttsAudio.pause();
    this.ttsAudio.currentTime = 0;
    if (this.tts?.dispose) this.tts.dispose();
    this.tts = null;
  }

  // --------------------------------------------------------------------
  // Chat (streaming)

  private async runChat(userMessage: string | null) {
    const info = this.current;
    if (!info) return;
    const chat = getChat();
    if (!chat) {
      this.chat = { status: 'error', turns: [], message: 'No chat provider registered.' };
      this.render();
      return;
    }

    const prior: ChatMessage[] = this.chat.status === 'idle'
      ? []
      : this.chat.status === 'streaming'
        ? [...this.chat.turns]
        : [...this.chat.turns];

    const nextTurns: ChatMessage[] = userMessage
      ? [...prior, { role: 'user', content: userMessage }]
      : prior;

    this.chatAbort?.abort();
    this.chatAbort = new AbortController();
    this.chat = { status: 'streaming', turns: nextTurns, liveText: '' };
    this.render();

    const systemMessages: ChatMessage[] = prior.length === 0
      ? [{ role: 'system', content: 'You are the narrator of the Lost Planet exhibit. Introduce an extinct or endangered species in a warm, slightly poetic tone. Keep it concise and grounded in the facts provided.' }]
      : [];

    try {
      let buffer = '';
      for await (const chunk of chat.stream(info, [...systemMessages, ...nextTurns], this.chatAbort.signal)) {
        if (this.current?.id !== info.id) return;
        buffer += chunk;
        if (this.chat.status === 'streaming') {
          this.chat = { ...this.chat, liveText: buffer };
          this.renderChatOnly();
        }
      }
      if (this.current?.id !== info.id) return;
      const finalTurns: ChatMessage[] = [...nextTurns, { role: 'assistant', content: buffer }];
      this.chat = { status: 'ready', turns: finalTurns };
      this.render();

      // Optional voice playback
      const tts = getTts();
      if (tts) {
        try {
          const audio = await tts.synthesize(buffer, { signal: this.chatAbort.signal });
          if (this.current?.id !== info.id) { audio.dispose?.(); return; }
          this.tts = audio;
          this.ttsAudio.src = audio.url;
          await this.ttsAudio.play();
        } catch {
          // TTS failure is non-fatal; leave the text on screen.
        }
      }
    } catch (err) {
      if (this.chatAbort?.signal.aborted) return;
      this.chat = {
        status: 'error',
        turns: nextTurns,
        message: err instanceof Error ? err.message : String(err),
      };
      this.render();
    }
  }

  // --------------------------------------------------------------------
  // Sound (pre-generated static asset)

  private playSound() {
    const info = this.current;
    if (!info) return;
    const entry = resolveSound((soundManifest as SoundManifest).files[info.id]);
    if (!entry) {
      this.sound = { status: 'unavailable' };
      this.render();
      return;
    }
    this.audio.src = `/animal-sounds/${entry.file}`;
    void this.audio.play().then(() => {
      this.sound = { status: 'playing' };
      this.render();
    }).catch(() => {
      this.sound = { status: 'unavailable' };
      this.render();
    });
  }

  // --------------------------------------------------------------------
  // Render

  private render() {
    const info = this.current;
    if (!info) { this.container.innerHTML = ''; return; }

    const status = STATUS_COLORS[info.status];
    const summaryLabel = info.extinctYear ? 'Extinct since' : 'Population';
    const summaryValue = info.extinctYear ?? info.population ?? 'Data pending';
    const soundEntry = resolveSound((soundManifest as SoundManifest).files[info.id]);
    const soundFile = soundEntry?.file ?? null;
    const soundUnavailable = !soundFile || this.sound.status === 'unavailable';
    const soundIsAi = soundEntry?.generated ?? false;
    // null = not yet reviewed; true = approved; false = rejected (resolveSound
    // returns null for false so we never reach here in that case).
    const soundReviewed = soundEntry?.accepted === true;

    this.container.innerHTML = `
      <div class="animal-panel__shell">
        <section class="animal-panel__hero">
          <img
            class="animal-panel__hero-image"
            src="${escapeHtml(this.heroImage ?? '')}"
            alt="${escapeHtml(info.name)}"
            onerror="this.style.display='none'"
          />
          <div class="animal-panel__hero-veil"></div>
          <div class="animal-panel__hero-topbar">
            <span class="animal-panel__badge" style="background:${status.bg}; color:${status.text};">
              ${status.label}
            </span>
            <button class="animal-panel__close" type="button" data-action="close" aria-label="Close">×</button>
          </div>
        </section>

        <div class="animal-panel__body">
          <header class="animal-panel__header">
            <h2 class="animal-panel__title">${escapeHtml(info.name)}</h2>
            <div class="animal-panel__subtitle"><span class="animal-panel__scientific">${escapeHtml(info.scientificName)}</span></div>
          </header>

          <section class="animal-panel__meta-grid">
            <article class="animal-panel__meta-card">
              <div class="animal-panel__meta-label">${summaryLabel}</div>
              <div class="animal-panel__meta-value">${escapeHtml(summaryValue)}</div>
            </article>
            <article class="animal-panel__meta-card">
              <div class="animal-panel__meta-label">Range</div>
              <div class="animal-panel__meta-value">${escapeHtml(info.region)}</div>
            </article>
            <article class="animal-panel__meta-card animal-panel__meta-card--wide">
              <div class="animal-panel__meta-label">Threats</div>
              <div class="animal-panel__meta-value">${escapeHtml(info.cause)}</div>
            </article>
          </section>

          <div class="animal-panel__summary">${escapeHtml(info.blurb)}</div>

          <div class="animal-panel__actions">
            <button class="animal-panel__action animal-panel__action--primary" type="button" data-action="explain">
              <span class="animal-panel__action-label">${this.chat.status === 'idle' ? 'Narrate' : this.chat.status === 'streaming' ? 'Narrating…' : 'Replay'}</span>
              <span class="animal-panel__action-meta">${this.chatBadge()}</span>
            </button>
            <button class="animal-panel__action animal-panel__action--primary" type="button" data-action="sound" ${soundUnavailable ? 'disabled' : ''}>
              <span class="animal-panel__action-label">${this.sound.status === 'playing' ? 'Playing…' : 'Hear Voice'}</span>
              <span class="animal-panel__action-meta">${soundFile
                ? (soundIsAi
                    ? (soundReviewed ? 'AI RECONSTRUCTION' : 'AI · UNREVIEWED')
                    : 'ARCHIVE RECORDING')
                : 'Pending'}</span>
            </button>
            <a
              class="animal-panel__action animal-panel__action--secondary"
              href="https://en.wikipedia.org/wiki/${encodeURIComponent(info.wikiTitle)}"
              target="_blank"
              rel="noreferrer"
            >
              <span class="animal-panel__action-label">Read More</span>
              <span class="animal-panel__action-meta">Wikipedia</span>
            </a>
          </div>

          <section class="animal-panel__chat" data-chat-root>
            ${this.renderChat()}
          </section>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderChatOnly() {
    const root = this.container.querySelector<HTMLElement>('[data-chat-root]');
    if (!root) { this.render(); return; }
    root.innerHTML = this.renderChat();
    this.bindChatInput();
  }

  private renderChat(): string {
    if (this.chat.status === 'idle') {
      return '';
    }

    const turns = this.chat.status === 'streaming'
      ? [...this.chat.turns]
      : this.chat.turns;
    const liveText = this.chat.status === 'streaming' ? this.chat.liveText : '';
    const errorMsg = this.chat.status === 'error' ? this.chat.message : '';

    const bubbles = turns.filter((t) => t.role !== 'system').map((t) => `
      <div class="animal-panel__bubble animal-panel__bubble--${escapeHtml(t.role)}">
        ${renderParagraphs(t.content)}
      </div>
    `).join('');

    const liveBubble = this.chat.status === 'streaming'
      ? `<div class="animal-panel__bubble animal-panel__bubble--assistant animal-panel__bubble--streaming">${renderParagraphs(liveText || '…')}</div>`
      : '';

    const errorBubble = errorMsg
      ? `<div class="animal-panel__bubble animal-panel__bubble--error">${escapeHtml(errorMsg)}</div>`
      : '';

    const inputDisabled = this.chat.status === 'streaming';
    const inputRow = `
      <form class="animal-panel__chat-input" data-chat-form>
        <input
          type="text"
          name="q"
          placeholder="Ask a follow-up…"
          autocomplete="off"
          ${inputDisabled ? 'disabled' : ''}
          data-chat-field
        />
        <button type="submit" ${inputDisabled ? 'disabled' : ''}>Send</button>
      </form>
    `;

    return `
      <div class="animal-panel__chat-thread">
        ${bubbles}
        ${liveBubble}
        ${errorBubble}
      </div>
      ${inputRow}
    `;
  }

  private chatBadge(): string {
    const chat = getChat();
    switch (this.chat.status) {
      case 'streaming': return 'Streaming';
      case 'ready':     return chat?.name ?? 'Connected';
      case 'error':     return 'Retry';
      default:          return chat?.name ?? 'Ready';
    }
  }

  private bindEvents() {
    this.container.querySelector<HTMLElement>('[data-action="close"]')?.addEventListener('click', () => this.hide());
    this.container.querySelector<HTMLElement>('[data-action="explain"]')?.addEventListener('click', () => {
      if (this.chat.status === 'streaming') return;
      void this.runChat(null);
    });
    this.container.querySelector<HTMLElement>('[data-action="sound"]')?.addEventListener('click', () => {
      this.playSound();
    });
    this.bindChatInput();
  }

  private bindChatInput() {
    const form = this.container.querySelector<HTMLFormElement>('[data-chat-form]');
    if (!form) return;
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const field = form.querySelector<HTMLInputElement>('[data-chat-field]');
      const q = field?.value.trim();
      if (!q) return;
      if (field) field.value = '';
      void this.runChat(q);
    });
  }

  dispose() {
    this.stopEverything();
    this.container.remove();
  }
}
