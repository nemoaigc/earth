import './animal-panel.css';
import type { AnimalInfo } from '../data/animals';

type AnimalExplanationResult =
  | string
  | {
      text: string;
      provider?: string;
    };

type AnimalAiExplainer = (animal: AnimalInfo) => Promise<AnimalExplanationResult>;

declare global {
  interface Window {
    __EARTH_AI_EXPLAIN__?: AnimalAiExplainer;
  }
}

type ExplanationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; text: string; sourceLabel: string }
  | { status: 'error'; message: string };

type SoundState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'playing' | 'paused'; clip: CommonsAudioResult }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string };

interface CommonsAudioResult {
  url: string;
  title: string;
  descriptionUrl: string;
  description: string;
  license: string;
  mime: string;
}

interface CommonsApiResponse {
  query?: {
    pages?: Record<string, CommonsPage>;
  };
}

interface CommonsPage {
  index?: number;
  title: string;
  imageinfo?: CommonsImageInfo[];
}

interface CommonsImageInfo {
  url?: string;
  descriptionurl?: string;
  mime?: string;
  extmetadata?: Record<string, { value?: string }>;
}

const STATUS_COLORS = {
  extinct: {
    bg: 'rgba(120, 122, 128, 0.14)',
    text: '#7f8794',
    label: '已灭绝',
    accent: '#a5afbe',
    accentRgb: '165, 175, 190',
  },
  endangered: {
    bg: 'rgba(255, 95, 87, 0.14)',
    text: '#f85d54',
    label: '濒危',
    accent: '#7ca4ff',
    accentRgb: '124, 164, 255',
  },
} as const;

const BIOME_LABELS: Record<AnimalInfo['biome'], string> = {
  tropical: '热带生态',
  temperate: '温带生态',
  boreal: '寒温带生态',
  ocean: '海洋生态',
  polar: '极地生态',
  desert: '干旱生态',
};

const COMMONS_AUDIO_REJECT_RE =
  /(pronunciation|lingua libre|spoken|word\b|phrase\b|vocabulary|dictionary|ll-q|^file:en-|^file:de-|^file:fr-|^file:nia-)/i;
const COMMONS_AUDIO_PREFER_RE =
  /(audio files of|call|calls|song|sounds|soundscape|vocal|voice|twittering|howl|roar|bellow|cry|whale|seal|bird)/i;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function stripMarkup(value: string | undefined): string {
  if (!value) return '';
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAudioMime(mime: string): string {
  if (mime === 'application/ogg') return 'audio/ogg';
  return mime;
}

function buildFallbackExplanation(info: AnimalInfo): string {
  const opening =
    info.status === 'extinct'
      ? `${info.nameCn}已经从地球上消失，但它留下的痕迹仍然在提醒我们，人类活动可以在很短的时间里改写一个物种的命运。`
      : `${info.nameCn}仍然活着，但它正处在与时间赛跑的阶段，每一次栖息地变化和人为干扰都会直接影响它的未来。`;

  const profile = `${info.nameCn}主要生活在${info.habitat}，分布于${info.region}。${info.blurb}`;
  const pressure =
    info.status === 'extinct'
      ? `它最终走向消失，核心诱因是${info.cause}。这类故事最值得被记住的，不是“已经太晚”，而是哪些错误曾经被重复发生。`
      : `目前估计数量${info.population ?? '仍在持续波动'}，而最主要的压力来自${info.cause}。只要保护窗口还在，恢复就不是空话。`;

  return `${opening}\n\n${profile}\n\n${pressure}`;
}

function renderParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim())}</p>`)
    .join('');
}

export class AnimalPanel {
  private container: HTMLDivElement;
  private current: AnimalInfo | null = null;
  private heroImage: string | null = null;
  private explanation: ExplanationState = { status: 'idle' };
  private sound: SoundState = { status: 'idle' };
  private audio = new Audio();
  private selectionToken = 0;
  private soundCache = new Map<string, Promise<CommonsAudioResult | null>>();
  private activeSoundAnimalId: string | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'animal-panel';
    document.body.appendChild(this.container);

    this.audio.preload = 'none';
    this.audio.crossOrigin = 'anonymous';
    this.audio.addEventListener('ended', this.handleAudioEnded);
    this.audio.addEventListener('pause', this.handleAudioPause);
    this.audio.addEventListener('play', this.handleAudioPlay);
    this.audio.addEventListener('error', this.handleAudioError);
  }

  show(info: AnimalInfo) {
    const isDifferentAnimal = this.current?.id !== info.id;
    this.selectionToken += 1;
    this.current = info;
    this.heroImage = null;
    this.explanation = { status: 'idle' };
    this.container.style.setProperty('--animal-accent', STATUS_COLORS[info.status].accent);
    this.container.style.setProperty('--animal-accent-rgb', STATUS_COLORS[info.status].accentRgb);

    if (isDifferentAnimal) {
      this.resetAudioState();
      this.sound = { status: 'idle' };
    }

    this.render();
    this.container.classList.add('is-visible');
    void this.loadHeroImage(info, this.selectionToken);
  }

  hide() {
    this.current = null;
    this.selectionToken += 1;
    this.stopAudio();
    this.container.classList.remove('is-visible');
  }

  private async loadHeroImage(info: AnimalInfo, token: number) {
    const wikiImg = await this.fetchWikiImage(info.wikiTitle);
    if (!this.current || this.current.id !== info.id || token !== this.selectionToken) {
      return;
    }
    this.heroImage = wikiImg;
    this.render();
  }

  private render() {
    const info = this.current;
    if (!info) {
      this.container.innerHTML = '';
      return;
    }

    const status = STATUS_COLORS[info.status];
    const summaryLabel = info.extinctYear ? '灭绝时间' : '现存数量';
    const summaryValue = info.extinctYear ?? info.population ?? '资料整理中';
    const explainButtonLabel =
      this.explanation.status === 'loading'
        ? '讲解生成中'
        : this.explanation.status === 'ready'
          ? '重新讲解'
          : 'AI讲解';
    const soundButtonLabel =
      this.sound.status === 'loading'
        ? '检索声音中'
        : this.sound.status === 'playing'
          ? '暂停声音'
          : this.sound.status === 'paused'
            ? '继续播放'
            : '听听声音';

    this.container.innerHTML = `
      <div class="animal-panel__shell">
        <section class="animal-panel__hero">
          ${this.heroImage ? `
            <img
              class="animal-panel__hero-image"
              src="${escapeHtml(this.heroImage)}"
              alt="${escapeHtml(info.nameCn)}"
            />
          ` : `
            <div class="animal-panel__hero-fallback">
              <img
                class="animal-panel__hero-art"
                src="animals/${escapeHtml(info.id)}.png"
                alt="${escapeHtml(info.nameCn)}"
              />
            </div>
          `}
          <div class="animal-panel__hero-veil"></div>
          <div class="animal-panel__hero-topbar">
            <span class="animal-panel__badge" style="background:${status.bg}; color:${status.text};">
              ${status.label}
            </span>
            <button class="animal-panel__close" type="button" data-action="close" aria-label="关闭">
              ×
            </button>
          </div>
        </section>

        <div class="animal-panel__body">
          <header class="animal-panel__header">
            <div>
              <h2 class="animal-panel__title">${escapeHtml(info.nameCn)}</h2>
              <div class="animal-panel__subtitle">${escapeHtml(info.name)}</div>
              <div class="animal-panel__scientific">${escapeHtml(info.scientificName)}</div>
            </div>
            <div class="animal-panel__chips">
              <span class="animal-panel__chip">${escapeHtml(BIOME_LABELS[info.biome])}</span>
            </div>
          </header>

          <div class="animal-panel__actions">
            <button class="animal-panel__action animal-panel__action--primary" type="button" data-action="explain">
              <span class="animal-panel__action-label">${escapeHtml(explainButtonLabel)}</span>
              <span class="animal-panel__action-meta">${escapeHtml(this.getExplanationBadge())}</span>
            </button>
            <button class="animal-panel__action animal-panel__action--primary" type="button" data-action="sound">
              <span class="animal-panel__action-label">${escapeHtml(soundButtonLabel)}</span>
              <span class="animal-panel__action-meta">${escapeHtml(this.getSoundBadge())}</span>
            </button>
            <a
              class="animal-panel__action animal-panel__action--secondary"
              href="https://zh.wikipedia.org/wiki/${encodeURIComponent(info.wikiTitle)}"
              target="_blank"
              rel="noreferrer"
            >
              <span class="animal-panel__action-label">更多资料</span>
              <span class="animal-panel__action-meta">Wikipedia</span>
            </a>
          </div>

          <section class="animal-panel__meta-grid">
            <article class="animal-panel__meta-card">
              <div class="animal-panel__meta-label">${summaryLabel}</div>
              <div class="animal-panel__meta-value">${escapeHtml(summaryValue)}</div>
            </article>
            <article class="animal-panel__meta-card">
              <div class="animal-panel__meta-label">栖息地</div>
              <div class="animal-panel__meta-value">${escapeHtml(info.habitat)}</div>
            </article>
            <article class="animal-panel__meta-card animal-panel__meta-card--wide">
              <div class="animal-panel__meta-label">分布区域</div>
              <div class="animal-panel__meta-value">${escapeHtml(info.region)}</div>
            </article>
            <article class="animal-panel__meta-card animal-panel__meta-card--wide">
              <div class="animal-panel__meta-label">威胁因素</div>
              <div class="animal-panel__meta-value">${escapeHtml(info.cause)}</div>
            </article>
          </section>

          <section class="animal-panel__section">
            <div class="animal-panel__section-head">
              <span>观察摘要</span>
            </div>
            <div class="animal-panel__summary">
              ${escapeHtml(info.blurb)}
            </div>
          </section>

          <section class="animal-panel__section">
            <div class="animal-panel__section-head">
              <span>AI 讲解</span>
            </div>
            <div class="animal-panel__insight">
              ${this.renderExplanationPanel()}
            </div>
          </section>

          <section class="animal-panel__section">
            <div class="animal-panel__section-head">
              <span>声音档案</span>
            </div>
            <div class="animal-panel__sound-surface">
              ${this.renderSoundPanel()}
            </div>
          </section>
        </div>
      </div>
    `;

    this.container.querySelector<HTMLElement>('[data-action="close"]')?.addEventListener('click', () => {
      this.hide();
    });
    this.container.querySelector<HTMLElement>('[data-action="explain"]')?.addEventListener('click', () => {
      void this.loadExplanation();
    });
    this.container.querySelector<HTMLElement>('[data-action="sound"]')?.addEventListener('click', () => {
      void this.toggleSound();
    });
  }

  private renderExplanationPanel(): string {
    if (this.explanation.status === 'loading') {
      return `
        <div class="animal-panel__placeholder">
          <span class="animal-panel__loader"></span>
          <div>
            <strong>正在生成讲解</strong>
            <p>我会优先调用外部 AI 讲解接口；如果当前项目还没接入，就回退到本地科普稿。</p>
          </div>
        </div>
      `;
    }

    if (this.explanation.status === 'ready') {
      return renderParagraphs(this.explanation.text);
    }

    if (this.explanation.status === 'error') {
      return `<p>${escapeHtml(this.explanation.message)}</p>`;
    }

    return `
      <p>点一下上方的 <strong>AI讲解</strong>，这里会展开更自然的一段介绍，后面可以直接替换成你的模型返回。</p>
    `;
  }

  private renderSoundPanel(): string {
    if (this.sound.status === 'loading') {
      return `
        <div class="animal-panel__placeholder">
          <span class="animal-panel__loader"></span>
          <div>
            <strong>正在检索录音</strong>
            <p>优先从 Wikimedia Commons 搜索可直接播放的音频文件。</p>
          </div>
        </div>
      `;
    }

    if (this.sound.status === 'playing' || this.sound.status === 'paused') {
      const clip = this.sound.clip;
      return `
        <div class="animal-panel__sound-note">
          <strong>${escapeHtml(this.sound.status === 'playing' ? '正在播放' : '已暂停')}</strong>
          <p>${escapeHtml(clip.title)}</p>
          <p>${escapeHtml(clip.description || '已找到可播放的物种录音。')}</p>
          <a href="${escapeHtml(clip.descriptionUrl)}" target="_blank" rel="noreferrer">
            查看来源 · ${escapeHtml(clip.license)}
          </a>
        </div>
      `;
    }

    if (this.sound.status === 'unavailable' || this.sound.status === 'error') {
      return `
        <div class="animal-panel__sound-note">
          <strong>${escapeHtml(this.sound.status === 'unavailable' ? '暂无录音' : '播放失败')}</strong>
          <p>${escapeHtml(this.sound.message)}</p>
        </div>
      `;
    }

    return `
      <div class="animal-panel__sound-note">
        <strong>准备就绪</strong>
        <p>点击 <strong>听听声音</strong> 试着获取该生物的真实录音；找不到时会在这里提示原因。</p>
      </div>
    `;
  }

  private getExplanationBadge(): string {
    switch (this.explanation.status) {
      case 'loading':
        return 'Generating';
      case 'ready':
        return this.explanation.sourceLabel;
      case 'error':
        return 'Fallback';
      default:
        return 'Ready';
    }
  }

  private getSoundBadge(): string {
    switch (this.sound.status) {
      case 'loading':
        return 'Searching';
      case 'playing':
        return 'Playing';
      case 'paused':
        return 'Paused';
      case 'unavailable':
        return 'No Audio';
      case 'error':
        return 'Retry';
      default:
        return 'Ready';
    }
  }

  private async loadExplanation() {
    const info = this.current;
    if (!info) return;

    this.explanation = { status: 'loading' };
    this.render();

    try {
      const explain = window.__EARTH_AI_EXPLAIN__;
      if (typeof explain === 'function') {
        const result = await explain(info);
        if (!this.current || this.current.id !== info.id) return;
        if (typeof result === 'string') {
          this.explanation = { status: 'ready', text: result, sourceLabel: 'AI Connected' };
        } else {
          this.explanation = {
            status: 'ready',
            text: result.text,
            sourceLabel: result.provider ? result.provider : 'AI Connected',
          };
        }
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 420));
        if (!this.current || this.current.id !== info.id) return;
        this.explanation = {
          status: 'ready',
          text: buildFallbackExplanation(info),
          sourceLabel: 'Local Fallback',
        };
      }
    } catch {
      if (!this.current || this.current.id !== info.id) return;
      this.explanation = {
        status: 'error',
        message: 'AI 讲解接口暂时不可用，建议先使用本地讲解回退或稍后重试。',
      };
    }

    if (this.current?.id === info.id) {
      this.render();
    }
  }

  private async toggleSound() {
    const info = this.current;
    if (!info) return;

    if (this.activeSoundAnimalId === info.id && this.sound.status === 'playing') {
      this.audio.pause();
      return;
    }

    if (this.activeSoundAnimalId === info.id && this.sound.status === 'paused') {
      try {
        await this.audio.play();
      } catch {
        this.sound = { status: 'error', message: '浏览器阻止了自动播放，请再次点击重试。' };
        this.render();
      }
      return;
    }

    if (info.status === 'extinct') {
      this.sound = {
        status: 'unavailable',
        message: '这个物种已经灭绝，目前没有可信的在世录音可供播放。',
      };
      this.render();
      return;
    }

    this.sound = { status: 'loading' };
    this.render();

    const clip = await this.getAnimalSound(info);
    if (!this.current || this.current.id !== info.id) return;

    if (!clip) {
      this.sound = {
        status: 'unavailable',
        message: '暂时没有找到可以直接播放的公共录音，后续可以补本地音频资源做兜底。',
      };
      this.render();
      return;
    }

    try {
      this.audio.src = clip.url;
      this.activeSoundAnimalId = info.id;
      await this.audio.play();
      this.sound = { status: 'playing', clip };
    } catch {
      this.sound = {
        status: 'error',
        message: '音频资源已找到，但浏览器当前无法播放这个格式。',
      };
    }

    if (this.current?.id === info.id) {
      this.render();
    }
  }

  private async getAnimalSound(info: AnimalInfo): Promise<CommonsAudioResult | null> {
    const cached = this.soundCache.get(info.id);
    if (cached) return cached;

    const request = this.fetchAnimalSound(info);
    this.soundCache.set(info.id, request);
    return request;
  }

  private async fetchAnimalSound(info: AnimalInfo): Promise<CommonsAudioResult | null> {
    const searchTerms = [
      `${info.name} animal sound`,
      `${info.name} call`,
      `${info.scientificName}`,
      info.wikiTitle.replaceAll('_', ' '),
    ];

    for (const term of searchTerms) {
      const url = new URL('https://commons.wikimedia.org/w/api.php');
      url.searchParams.set('action', 'query');
      url.searchParams.set('format', 'json');
      url.searchParams.set('origin', '*');
      url.searchParams.set('generator', 'search');
      url.searchParams.set('gsrnamespace', '6');
      url.searchParams.set('gsrlimit', '6');
      url.searchParams.set('gsrsearch', `${term} filetype:audio -pronunciation`);
      url.searchParams.set('prop', 'imageinfo');
      url.searchParams.set('iiprop', 'url|mime|extmetadata');

      try {
        const response = await fetch(url.toString());
        if (!response.ok) continue;

        const data = (await response.json()) as CommonsApiResponse;
        const pages = Object.values(data.query?.pages ?? {});
        const ranked = pages
          .map((page) => this.normalizeCommonsAudio(page))
          .filter((clip): clip is CommonsAudioResult => clip !== null)
          .sort((left, right) => {
            const leftScore = this.scoreCommonsAudio(left);
            const rightScore = this.scoreCommonsAudio(right);
            return rightScore - leftScore;
          });

        const playable = ranked.find((clip) => this.audio.canPlayType(normalizeAudioMime(clip.mime)) !== '');
        if (playable) return playable;
      } catch {
        continue;
      }
    }

    return null;
  }

  private normalizeCommonsAudio(page: CommonsPage): CommonsAudioResult | null {
    const image = page.imageinfo?.[0];
    const fileUrl = image?.url;
    const descriptionUrl = image?.descriptionurl;
    if (!fileUrl || !descriptionUrl) return null;

    const description = stripMarkup(image.extmetadata?.ImageDescription?.value);
    const categories = stripMarkup(image.extmetadata?.Categories?.value);
    const title = page.title.replace(/^File:/, '');
    const haystack = `${title} ${description} ${categories}`.toLowerCase();
    if (COMMONS_AUDIO_REJECT_RE.test(haystack)) return null;

    return {
      url: fileUrl,
      descriptionUrl,
      title,
      description,
      license: stripMarkup(image.extmetadata?.LicenseShortName?.value) || 'Wikimedia Commons',
      mime: image.mime ?? '',
    };
  }

  private scoreCommonsAudio(clip: CommonsAudioResult): number {
    const text = `${clip.title} ${clip.description}`.toLowerCase();
    let score = 0;
    if (COMMONS_AUDIO_PREFER_RE.test(text)) score += 5;
    if (/animal sound/.test(text)) score += 2;
    if (/call|song|twittering|howl|roar|vocal/.test(text)) score += 3;
    if (/whale|seal|bird|panda|turtle/.test(text)) score += 1;
    return score;
  }

  private handleAudioEnded = () => {
    if (this.sound.status === 'playing') {
      this.sound = { status: 'paused', clip: this.sound.clip };
      this.render();
    }
  };

  private handleAudioPause = () => {
    if (this.sound.status === 'playing') {
      this.sound = { status: 'paused', clip: this.sound.clip };
      this.render();
    }
  };

  private handleAudioPlay = () => {
    if (this.sound.status === 'paused') {
      this.sound = { status: 'playing', clip: this.sound.clip };
      this.render();
    }
  };

  private handleAudioError = () => {
    if (!this.current) return;
    this.sound = {
      status: 'error',
      message: '当前音频资源播放失败，建议稍后重试或改接本地音频文件。',
    };
    this.render();
  };

  private stopAudio() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.activeSoundAnimalId = null;
  }

  private resetAudioState() {
    this.stopAudio();
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  private async fetchWikiImage(wikiTitle: string): Promise<string | null> {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();
      return data.thumbnail?.source || data.originalimage?.source || null;
    } catch {
      return null;
    }
  }

  dispose() {
    this.resetAudioState();
    this.audio.removeEventListener('ended', this.handleAudioEnded);
    this.audio.removeEventListener('pause', this.handleAudioPause);
    this.audio.removeEventListener('play', this.handleAudioPlay);
    this.audio.removeEventListener('error', this.handleAudioError);
    this.container.remove();
  }
}
