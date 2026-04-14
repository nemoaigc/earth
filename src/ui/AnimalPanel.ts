import './animal-panel.css';
import type { AnimalInfo } from '../data/animals';

type AnimalExplanationResult =
  | string
  | { text: string; provider?: string };

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

const STATUS_COLORS = {
  extinct: {
    bg: 'rgba(120, 122, 128, 0.14)',
    text: '#7f8794',
    label: '已灭绝',
  },
  endangered: {
    bg: 'rgba(255, 95, 87, 0.14)',
    text: '#f85d54',
    label: '濒危',
  },
} as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'animal-panel';
    document.body.appendChild(this.container);
  }

  show(info: AnimalInfo) {
    this.current = info;
    // Pre-downloaded photo from public/animal-photos/ — run
    // scripts/fetch-animal-photos.mjs to refresh.
    this.heroImage = `/animal-photos/${info.id}.jpg`;
    this.explanation = { status: 'idle' };
    this.render();
    this.container.classList.add('is-visible');
  }

  hide() {
    this.current = null;
    this.container.classList.remove('is-visible');
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
          : 'AI 讲解';

    const aiBlock = this.explanation.status === 'idle'
      ? ''
      : `
        <section class="animal-panel__section">
          <div class="animal-panel__insight">
            ${this.renderExplanationPanel()}
          </div>
        </section>
      `;

    this.container.innerHTML = `
      <div class="animal-panel__shell">
        <section class="animal-panel__hero">
          <img
            class="animal-panel__hero-image"
            src="${escapeHtml(this.heroImage ?? '')}"
            alt="${escapeHtml(info.nameCn)}"
            onerror="this.style.display='none'"
          />
          <div class="animal-panel__hero-veil"></div>
          <div class="animal-panel__hero-topbar">
            <span class="animal-panel__badge" style="background:${status.bg}; color:${status.text};">
              ${status.label}
            </span>
            <button class="animal-panel__close" type="button" data-action="close" aria-label="关闭">×</button>
          </div>
        </section>

        <div class="animal-panel__body">
          <header class="animal-panel__header">
            <h2 class="animal-panel__title">${escapeHtml(info.nameCn)}</h2>
            <div class="animal-panel__subtitle">${escapeHtml(info.name)} · <span class="animal-panel__scientific">${escapeHtml(info.scientificName)}</span></div>
          </header>

          <section class="animal-panel__meta-grid">
            <article class="animal-panel__meta-card">
              <div class="animal-panel__meta-label">${summaryLabel}</div>
              <div class="animal-panel__meta-value">${escapeHtml(summaryValue)}</div>
            </article>
            <article class="animal-panel__meta-card">
              <div class="animal-panel__meta-label">分布</div>
              <div class="animal-panel__meta-value">${escapeHtml(info.region)}</div>
            </article>
            <article class="animal-panel__meta-card animal-panel__meta-card--wide">
              <div class="animal-panel__meta-label">威胁因素</div>
              <div class="animal-panel__meta-value">${escapeHtml(info.cause)}</div>
            </article>
          </section>

          <div class="animal-panel__summary">${escapeHtml(info.blurb)}</div>

          <div class="animal-panel__actions">
            <button class="animal-panel__action animal-panel__action--primary" type="button" data-action="explain">
              <span class="animal-panel__action-label">${escapeHtml(explainButtonLabel)}</span>
              <span class="animal-panel__action-meta">${escapeHtml(this.getExplanationBadge())}</span>
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

          ${aiBlock}
        </div>
      </div>
    `;

    this.container.querySelector<HTMLElement>('[data-action="close"]')?.addEventListener('click', () => this.hide());
    this.container.querySelector<HTMLElement>('[data-action="explain"]')?.addEventListener('click', () => {
      void this.loadExplanation();
    });
  }

  private renderExplanationPanel(): string {
    if (this.explanation.status === 'loading') {
      return `
        <div class="animal-panel__placeholder">
          <span class="animal-panel__loader"></span>
          <div><strong>正在生成讲解</strong></div>
        </div>
      `;
    }
    if (this.explanation.status === 'ready') {
      return renderParagraphs(this.explanation.text);
    }
    if (this.explanation.status === 'error') {
      return `<p>${escapeHtml(this.explanation.message)}</p>`;
    }
    return '';
  }

  private getExplanationBadge(): string {
    switch (this.explanation.status) {
      case 'loading': return 'Generating';
      case 'ready':   return this.explanation.sourceLabel;
      case 'error':   return 'Fallback';
      default:        return 'Ready';
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
            sourceLabel: result.provider ?? 'AI Connected',
          };
        }
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 320));
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
        message: 'AI 讲解接口暂时不可用，建议稍后重试。',
      };
    }

    if (this.current?.id === info.id) this.render();
  }

  dispose() {
    this.container.remove();
  }
}
