import type { AnimalInfo } from '../data/animals';

const STATUS_COLORS = {
  extinct: { bg: 'rgba(142,142,147,0.18)', text: '#8e8e93', label: '已灭绝' },
  endangered: { bg: 'rgba(255,59,48,0.12)', text: '#ff3b30', label: '濒危' },
};

export class AnimalPanel {
  private container: HTMLDivElement;
  private current: AnimalInfo | null = null;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'animal-panel';
    this.container.style.cssText = `
      position: fixed;
      right: 24px;
      top: 50%;
      transform: translate(40px, -50%);
      opacity: 0;
      pointer-events: none;
      z-index: 200;
      width: 520px;
      max-height: calc(100vh - 32px);
      overflow-y: auto;
      overflow-x: hidden;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.72);
      backdrop-filter: blur(40px) saturate(1.8);
      -webkit-backdrop-filter: blur(40px) saturate(1.8);
      border: 1px solid rgba(255, 255, 255, 0.55);
      box-shadow:
        0 20px 60px rgba(0, 0, 0, 0.12),
        0 0 0 0.5px rgba(0, 0, 0, 0.06),
        inset 0 0 0 0.5px rgba(255, 255, 255, 0.4);
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', sans-serif;
      color: #1d1d1f;
      transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease;
      -webkit-font-smoothing: antialiased;
    `;

    // Scrollbar styling
    const style = document.createElement('style');
    style.textContent = `
      .animal-panel::-webkit-scrollbar { width: 0; }
      .animal-panel { scrollbar-width: none; }
    `;
    document.head.appendChild(style);

    document.body.appendChild(this.container);
  }

  async show(info: AnimalInfo) {
    this.current = info;
    const sc = STATUS_COLORS[info.status];

    // Fetch wiki image
    const wikiImg = await this.fetchWikiImage(info.wikiTitle);

    // Don't render if a different animal was selected while loading
    if (this.current !== info) return;

    const fields = [
      info.extinctYear ? ['灭绝时间', info.extinctYear] : null,
      info.population ? ['现存数量', info.population] : null,
      ['栖息地', info.habitat],
      ['分布区域', info.region],
      ['威胁因素', info.cause],
    ].filter(Boolean) as [string, string][];

    this.container.innerHTML = `
      <!-- Close button -->
      <button id="animal-panel-close" style="
        position: absolute; top: 14px; right: 14px; z-index: 10;
        width: 28px; height: 28px; border-radius: 50%;
        background: rgba(0,0,0,0.06);
        border: none; cursor: pointer; display: flex;
        align-items: center; justify-content: center;
        transition: background 0.15s ease;
        color: #86868b; font-size: 15px; line-height: 1;
      ">✕</button>

      <!-- Hero image -->
      <div style="
        width: 100%; height: 340px; position: relative;
        border-radius: 20px 20px 0 0; overflow: hidden;
        background: linear-gradient(135deg, #f5f5f7, #e8e8ed);
      ">
        ${wikiImg ? `
          <img src="${wikiImg}" style="
            width: 100%; height: 100%; object-fit: cover;
          " />
          <div style="
            position: absolute; inset: 0;
            background: linear-gradient(180deg, transparent 40%, rgba(255,255,255,0.85) 100%);
          "></div>
        ` : `
          <img src="animals/${info.id}.png" style="
            width: 65%; height: 85%; object-fit: contain;
            position: absolute; top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            filter: drop-shadow(0 4px 12px rgba(0,0,0,0.15));
          " />
        `}
        <!-- Status badge -->
        <div style="
          position: absolute; top: 16px; left: 16px;
          padding: 5px 14px; border-radius: 20px;
          background: ${sc.bg};
          backdrop-filter: blur(10px);
          font-size: 12px; font-weight: 600;
          letter-spacing: 0.04em;
          color: ${sc.text};
        ">${sc.label}</div>
      </div>

      <!-- Content -->
      <div style="padding: 28px 30px 32px;">
        <!-- Name -->
        <div style="margin-bottom: 6px;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: -0.02em;">
            ${info.nameCn}
          </span>
        </div>
        <div style="
          font-size: 18px; color: #86868b; margin-bottom: 4px; font-weight: 500;
        ">${info.name}</div>
        <div style="
          font-size: 14px; color: #aeaeb2; font-style: italic; margin-bottom: 24px;
        ">${info.scientificName}</div>

        <!-- Info grid -->
        <div style="
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 1px; border-radius: 16px; overflow: hidden;
          background: rgba(0,0,0,0.04); margin-bottom: 24px;
        ">
          ${fields.map(([label, value]) => {
            const isWide = label === '威胁因素' || label === '分布区域';
            const span = isWide ? 'grid-column: 1 / -1;' : '';
            return `
              <div style="
                padding: 14px 18px; background: rgba(255,255,255,0.7);
                ${span}
              ">
                <div style="font-size: 11px; color: #86868b; font-weight: 600;
                  letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 5px;">
                  ${label}
                </div>
                <div style="font-size: 15px; font-weight: 500; color: #1d1d1f; line-height: 1.45;">
                  ${value}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Blurb -->
        <div style="
          font-size: 16px; line-height: 1.75; color: #424245;
          font-weight: 400;
        ">${info.blurb}</div>

        <!-- Wiki link -->
        <a href="https://zh.wikipedia.org/wiki/${info.wikiTitle}" target="_blank"
          style="
            display: inline-flex; align-items: center; gap: 6px;
            margin-top: 24px; padding: 12px 24px; border-radius: 24px;
            background: rgba(0,122,255,0.08);
            color: #007aff; font-size: 15px; font-weight: 500;
            text-decoration: none;
            transition: background 0.15s ease;
          ">
          📖 维基百科
        </a>
      </div>
    `;

    // Close button handler
    this.container.querySelector('#animal-panel-close')?.addEventListener('click', () => {
      this.hide();
    });

    // Animate in
    requestAnimationFrame(() => {
      this.container.style.transform = 'translate(0, -50%)';
      this.container.style.opacity = '1';
      this.container.style.pointerEvents = 'auto';
    });
  }

  hide() {
    this.current = null;
    this.container.style.transform = 'translate(40px, -50%)';
    this.container.style.opacity = '0';
    this.container.style.pointerEvents = 'none';
  }

  private async fetchWikiImage(wikiTitle: string): Promise<string | null> {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.thumbnail?.source || data.originalimage?.source || null;
    } catch {
      return null;
    }
  }

  dispose() {
    this.container.remove();
  }
}
