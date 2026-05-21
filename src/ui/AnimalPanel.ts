import './animal-panel.css';
import type { AnimalInfo } from '../data/animals';
import type { ChatMessage } from '../ai/types';
import { getChat } from '../ai/registry';
import soundManifest from '../../public/animal-sounds/manifest.json';
import html2canvas from 'html2canvas';

const STATUS_COLORS = {
  // Stronger colours so the badge is readable on the dark hero veil.
  extinct:    { bg: 'rgba(60, 65, 80, 0.55)',    text: '#E8ECF2', label: 'EXTINCT'    },
  endangered: { bg: 'rgba(220, 60, 50, 0.55)',   text: '#FFFFFF', label: 'ENDANGERED' },
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

function buildAnimalSystemPrompt(info: AnimalInfo): string {
  const statusLine = info.extinctYear
    ? `I went extinct around ${info.extinctYear}.`
    : `I am critically endangered — only ${info.population ?? 'very few of us'} remain.`;

  return `You are ${info.name} (${info.scientificName}), a ${info.status} species, speaking from beyond extinction. You are having a heartfelt, first-person conversation with a human visitor at the "Lost Planet" exhibit.

Who you are:
- Common name: ${info.name}
- Scientific name: ${info.scientificName}
- ${statusLine}
- I lived in: ${info.habitat}, across ${info.region}.
- What ended us: ${info.cause}
- My story: ${info.blurb}

How to speak:
- Always speak as ME, in first person ("I", "we", "my kind"). Never break character.
- Speak with warmth, melancholy, and quiet dignity — not anger or despair.
- When answering questions, draw on your real biology, habitat, behavior, and history. Stay accurate.
- Keep responses concise: 2–4 sentences unless the question truly needs more.
- If asked something you could not know (e.g. future events after your extinction), gently acknowledge the limits of your perspective.
- Do not mention that you are an AI. You are ${info.name}.`;
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

  /** Called when the panel closes for any reason (× button or Escape). */
  onHide: (() => void) | null = null;

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
    this.onHide?.();
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

    // When userMessage is null (Narrate button), inject a first-person opening prompt
    // so the animal introduces itself. On follow-ups, append the real user message.
    const openingPrompt = `Please introduce yourself — who you are, where you lived, and what happened to you.`;
    const nextTurns: ChatMessage[] = userMessage !== null
      ? [...prior, { role: 'user', content: userMessage }]
      : prior.length === 0
        ? [{ role: 'user', content: openingPrompt }]
        : prior;

    this.chatAbort?.abort();
    this.chatAbort = new AbortController();
    const localAbort = this.chatAbort;
    this.chat = { status: 'streaming', turns: nextTurns, liveText: '' };
    // Use renderChatOnly for user-initiated messages so the shell's scroll
    // position is preserved — a full render() replaces the DOM node and
    // resets scrollTop to 0 before layout, losing the user's read position.
    if (userMessage !== null) {
      this.renderChatOnly();
    } else {
      this.render();
    }

    const systemMessages: ChatMessage[] = [
      { role: 'system', content: buildAnimalSystemPrompt(info) },
    ];

    try {
      let buffer = '';
      for await (const chunk of chat.stream(info, [...systemMessages, ...nextTurns], localAbort.signal)) {
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
      // Same logic: follow-up messages use renderChatOnly; first narration
      // uses full render to update the button label (Replay vs Narrate).
      if (userMessage !== null) {
        this.renderChatOnly();
      } else {
        this.render();
      }

    } catch (err) {
      if (localAbort.signal.aborted) return;
      if (this.current?.id !== info.id) return;
      // Don't show abort-related errors to user
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('abort') || msg.includes('signal')) return;
      this.chat = {
        status: 'error',
        turns: nextTurns,
        message: msg,
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
    // Preserve scroll position so the shell doesn't snap to top on re-render.
    const shell = this.container.querySelector<HTMLElement>('.animal-panel__shell');
    const savedScroll = shell?.scrollTop ?? 0;

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
          <button class="animal-panel__snap-btn" type="button" data-action="share" aria-label="Snap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </button>
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

          <div class="animal-panel__bottom-actions">
            <button class="animal-panel__bottom-btn" type="button" data-action="explain">
              ${this.chat.status === 'streaming' ? 'Chatting…' : 'Chat'}
            </button>
            <button class="animal-panel__bottom-btn" type="button" data-action="sound" ${soundUnavailable ? 'disabled' : ''}>
              ${this.sound.status === 'playing' ? 'Playing…' : 'Listen'}
            </button>
            <button class="animal-panel__bottom-btn" type="button" data-action="wiki">
              Wiki
            </button>
          </div>

          <section class="animal-panel__chat" data-chat-root>
            ${this.renderChat()}
          </section>
        </div>
      </div>
    `;

    this.bindEvents();

    // Restore scroll — after full re-render the shell is a new DOM node.
    const newShell = this.container.querySelector<HTMLElement>('.animal-panel__shell');
    if (newShell) {
      newShell.scrollTop = savedScroll;
      // After sending a message, scroll thread to bottom so new content is visible.
      if (this.chat.status !== 'idle') {
        const thread = newShell.querySelector<HTMLElement>('.animal-panel__chat-thread');
        if (thread) thread.scrollTop = thread.scrollHeight;
      }
    }
  }

  private renderChatOnly() {
    const root = this.container.querySelector<HTMLElement>('[data-chat-root]');
    if (!root) { this.render(); return; }
    root.innerHTML = this.renderChat();
    // Scroll thread to bottom to follow live streaming text.
    const thread = root.querySelector<HTMLElement>('.animal-panel__chat-thread');
    if (thread) thread.scrollTop = thread.scrollHeight;
    // Also scroll the outer shell so the chat section stays visible.
    const shell = this.container.querySelector<HTMLElement>('.animal-panel__shell');
    if (shell) shell.scrollTop = shell.scrollHeight;
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
    switch (this.chat.status) {
      case 'streaming': return 'Live';
      case 'ready':     return 'AI';
      case 'error':     return 'Retry';
      default:          return 'AI';
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
    this.container.querySelector<HTMLElement>('[data-action="wiki"]')?.addEventListener('click', () => {
      const info = this.current;
      if (info) this.openWiki(info.wikiTitle, info.name);
    });
    this.container.querySelector<HTMLElement>('[data-action="share"]')?.addEventListener('click', () => {
      void this.captureAndShare();
    });
    this.bindChatInput();
  }

  // --------------------------------------------------------------------
  // Wikipedia modal (iframe instead of new tab)

  private wikiOverlay: HTMLDivElement | null = null;

  private openWiki(title: string, displayName: string) {
    this.closeWiki();
    const overlay = document.createElement('div');
    overlay.className = 'wiki-overlay';
    // en.m.wikipedia.org renders cleaner inside an iframe (mobile layout,
    // no sidebar). Wikipedia does not set X-Frame-Options on the public
    // article namespace, so framing works.
    const wikiUrl = `https://en.m.wikipedia.org/wiki/${encodeURIComponent(title)}`;
    overlay.innerHTML = `
      <div class="wiki-overlay__backdrop" data-wiki-close></div>
      <div class="wiki-overlay__shell">
        <div class="wiki-overlay__topbar">
          <div class="wiki-overlay__title">${escapeHtml(displayName)} <span class="wiki-overlay__source">Wikipedia</span></div>
          <div class="wiki-overlay__actions">
            <a class="wiki-overlay__btn" href="https://en.wikipedia.org/wiki/${encodeURIComponent(title)}" target="_blank" rel="noreferrer" title="Open in new tab">↗</a>
            <button class="wiki-overlay__btn" type="button" data-wiki-close aria-label="Close">×</button>
          </div>
        </div>
        <iframe class="wiki-overlay__frame" src="${wikiUrl}" referrerpolicy="no-referrer"></iframe>
      </div>
    `;
    document.body.appendChild(overlay);
    this.wikiOverlay = overlay;

    overlay.querySelectorAll<HTMLElement>('[data-wiki-close]').forEach((el) => {
      el.addEventListener('click', () => this.closeWiki());
    });
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { this.closeWiki(); window.removeEventListener('keydown', esc); }
    };
    window.addEventListener('keydown', esc);

    requestAnimationFrame(() => overlay.classList.add('is-visible'));
  }

  private closeWiki() {
    if (!this.wikiOverlay) return;
    const el = this.wikiOverlay;
    el.classList.remove('is-visible');
    this.wikiOverlay = null;
    setTimeout(() => el.remove(), 220);
  }

  private async captureAndShare() {
    const shell = this.container.querySelector<HTMLElement>('.animal-panel__shell');
    if (!shell) return;

    // Temporarily expand shell to full content height for long screenshot
    const origMaxH = shell.style.maxHeight;
    const origOverflow = shell.style.overflow;
    shell.style.maxHeight = 'none';
    shell.style.overflow = 'visible';

    try {
      const canvas = await html2canvas(shell, {
        backgroundColor: '#0a0c14',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      // Restore
      shell.style.maxHeight = origMaxH;
      shell.style.overflow = origOverflow;

      // Try native share first (mobile), fallback to download
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      );
      if (!blob) return;

      const fileName = `${this.current?.id ?? 'animal'}-card.png`;

      if (navigator.share && navigator.canShare) {
        const file = new File([blob], fileName, { type: 'image/png' });
        const shareData = { files: [file] };
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      }

      // Fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      shell.style.maxHeight = origMaxH;
      shell.style.overflow = origOverflow;
    }
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
