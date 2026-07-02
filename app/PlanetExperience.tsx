'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// Keep the heavy WebGL / Three.js chunk off the initial HTML hydration path.
// Static-importing it makes DOMContentLoaded block on a large client bundle.
const PlanetCanvas = dynamic(() => import('./PlanetCanvas'), { ssr: false });

// Keep the liquid-glass refraction, but make it cheaper than the original
// full-device-pixel-ratio copy path. The HUD is static and the planet rotates
// slowly, so ~5fps still reads as live glass without hammering the GPU/CPU.
const LIVE_GLASS_COPY_INTERVAL_MS = 200;
const LIVE_GLASS_MAX_PIXEL_RATIO = 0.75;

async function createLiquidGlassMapUrl(): Promise<string | null> {
  const width = 256;
  const height = 144;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) return null;

  const image = context.createImageData(width, height);
  const rimWidth = 0.36;
  const gain = 102;
  const refractiveIndex = 1.5;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / (width - 1);
      const v = y / (height - 1);
      const left = u;
      const right = 1 - u;
      const top = v;
      const bottom = 1 - v;
      const edgeX = Math.min(left, right);
      const edgeY = Math.min(top, bottom);
      const edgeDistance = Math.min(edgeX, edgeY);
      const rim = Math.max(0, Math.min(1, (rimWidth - edgeDistance) / rimWidth));

      let nx = 0;
      let ny = 0;

      if (edgeX < rimWidth && edgeY < rimWidth) {
        nx = left < right ? -1 + edgeX / rimWidth : 1 - edgeX / rimWidth;
        ny = top < bottom ? -1 + edgeY / rimWidth : 1 - edgeY / rimWidth;
        const length = Math.hypot(nx, ny) || 1;
        nx /= length;
        ny /= length;
      } else if (edgeX < edgeY) {
        nx = left < right ? -1 : 1;
      } else {
        ny = top < bottom ? -1 : 1;
      }

      // Flat centre, steep transparent rim: compute the bend from the same
      // glass-optics rule as the reference instead of painting a border.
      const depth = Math.min(1, edgeDistance / rimWidth);
      const surface = 1 - depth;
      const slopeDenominator = Math.max(0.0001, 1 - surface ** 4) ** 0.75;
      const slope = surface ** 3 / slopeDenominator;
      const thetaI = Math.atan(slope);
      const thetaT = Math.asin(Math.sin(thetaI) / refractiveIndex);
      const bend = Math.sin(thetaI - thetaT);
      const specular = Math.max(0, Math.min(1, (rim - 0.5) / 0.5));
      const index = (y * width + x) * 4;
      image.data[index] = 128 - nx * bend * gain;
      image.data[index + 1] = 128 - ny * bend * gain;
      image.data[index + 2] = 128 + specular * 20;
      image.data[index + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob ? URL.createObjectURL(blob) : null);
    }, 'image/png');
  });
}

const GLASS_LENS_SELECTORS = [
  '.top-bar__glass',
  '#help-btn',
  '.help-panel',
  '.animal-panel__shell',
  '.wiki-overlay__shell',
] as const;

interface GlassLensCopy {
  element: HTMLElement;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
}

function useLiquidGlassCopies(enabled: boolean) {
  const copiesRef = useRef(new Map<HTMLElement, GlassLensCopy>());
  const lastCopyTimeRef = useRef(0);

  useEffect(() => {
    return () => {
      for (const copy of copiesRef.current.values()) {
        copy.canvas.remove();
      }
      copiesRef.current.clear();
    };
  }, []);

  return useCallback((sourceCanvas: HTMLCanvasElement) => {
    if (!enabled) return;

    const now = performance.now();
    if (now - lastCopyTimeRef.current < LIVE_GLASS_COPY_INTERVAL_MS) return;
    lastCopyTimeRef.current = now;

    const sourceRect = sourceCanvas.getBoundingClientRect();
    if (sourceRect.width <= 0 || sourceRect.height <= 0) return;

    const scaleX = sourceCanvas.width / sourceRect.width;
    const scaleY = sourceCanvas.height / sourceRect.height;
    const targetScale = Math.min(window.devicePixelRatio || 1, LIVE_GLASS_MAX_PIXEL_RATIO);
    const liveElements = new Set<HTMLElement>();

    for (const selector of GLASS_LENS_SELECTORS) {
      document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        if (element.matches('.help-panel:not(.is-visible)')) return;
        if (element.closest('.animal-panel:not(.is-visible), .wiki-overlay:not(.is-visible)')) return;

        const rect = element.getBoundingClientRect();
        if (rect.width <= 1 || rect.height <= 1) return;

        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.02) return;

        liveElements.add(element);
        let copy = copiesRef.current.get(element);
        if (!copy) {
          const canvas = document.createElement('canvas');
          canvas.className = 'liquid-glass-copy';
          canvas.setAttribute('aria-hidden', 'true');
          const context = canvas.getContext('2d', { alpha: true });
          if (!context) return;
          element.prepend(canvas);
          copy = { element, canvas, context };
          copiesRef.current.set(element, copy);
        }

        const width = Math.max(1, Math.round(rect.width * targetScale));
        const height = Math.max(1, Math.round(rect.height * targetScale));
        if (copy.canvas.width !== width || copy.canvas.height !== height) {
          copy.canvas.width = width;
          copy.canvas.height = height;
        }

        const sx = Math.max(0, Math.round((rect.left - sourceRect.left) * scaleX));
        const sy = Math.max(0, Math.round((rect.top - sourceRect.top) * scaleY));
        const sw = Math.min(Math.round(rect.width * scaleX), sourceCanvas.width - sx);
        const sh = Math.min(Math.round(rect.height * scaleY), sourceCanvas.height - sy);
        if (sw <= 0 || sh <= 0) return;

        copy.context.clearRect(0, 0, width, height);
        copy.context.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, width, height);
      });
    }

    for (const [element, copy] of copiesRef.current) {
      if (!liveElements.has(element) || !element.isConnected) {
        copy.canvas.remove();
        copiesRef.current.delete(element);
      }
    }
  }, [enabled]);
}

export default function PlanetExperience() {
  const [canvasReady, setCanvasReady] = useState(false);
  const [introReady, setIntroReady] = useState(false);
  const [canvasFailed, setCanvasFailed] = useState(false);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [helpOpen, setHelpOpen] = useState(true);
  const [glassMapUrl, setGlassMapUrl] = useState<string | null>(null);
  const ready = (canvasReady || canvasFailed || loadingTimedOut) && introReady;

  // Stable callback so PlanetCanvas's effect mounts exactly once.
  const handleReady = useCallback(() => setCanvasReady(true), []);
  const handleError = useCallback(() => setCanvasFailed(true), []);
  const handleAfterRender = useLiquidGlassCopies(Boolean(glassMapUrl));

  useEffect(() => {
    const timer = window.setTimeout(() => setIntroReady(true), 1300);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoadingTimedOut(true), 6000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let disposed = false;
    let currentUrl: string | null = null;

    void createLiquidGlassMapUrl().then((url) => {
      if (!url) return;
      if (disposed) {
        URL.revokeObjectURL(url);
        return;
      }
      currentUrl = url;
      setGlassMapUrl(url);
    });

    return () => {
      disposed = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, []);

  return (
    <>
      <PlanetCanvas onReady={handleReady} onAfterRender={handleAfterRender} onError={handleError} />

      <svg className="liquid-glass-filters" aria-hidden="true" focusable="false">
        <filter
          id="liquid-glass-backdrop"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodColor="rgb(128,128,128)" floodOpacity="1" result="mapBg" />
          <feImage
            href={glassMapUrl ?? undefined}
            x="0"
            y="0"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            result="rawMap"
          />
          <feComposite in="rawMap" in2="mapBg" operator="over" result="lensMap" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="lensMap"
            scale="28"
            xChannelSelector="R"
            yChannelSelector="G"
            result="lensColor"
          />
          <feColorMatrix
            in="lensMap"
            type="matrix"
            values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 1 0 -0.5019607843137255"
            result="specularRim"
          />
          <feComposite
            in="specularRim"
            in2="lensColor"
            operator="arithmetic"
            k1="0"
            k2="0.32"
            k3="1"
            k4="0"
            result="lensWithRim"
          />
          <feGaussianBlur
            in="lensWithRim"
            stdDeviation="0.35"
            result="lensAntialias"
          />
        </filter>
      </svg>

      {/* Top bar: title + tagline (always visible) */}
      <div id="top-bar">
        <div className="top-bar__glass" aria-hidden="true" />
        <div className="top-bar__title">Lost Planet</div>
        <div className="top-bar__tagline">
          An interactive memorial to species lost from our world
        </div>
      </div>

      {/* Help bubble (bottom-left) */}
      <button
        id="help-btn"
        aria-label="Help"
        onClick={() => setHelpOpen((v) => !v)}
      >
        <span className="help-btn__label">?</span>
      </button>

      {/* Help panel (pops up from bottom-left) */}
      <div className={`help-panel${helpOpen ? ' is-visible' : ''}`}>
        <div className="help-panel__header">
          <span className="help-panel__title">How to Explore</span>
          <button
            className="help-panel__close"
            onClick={() => setHelpOpen(false)}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="help-panel__body">
          <div className="help-panel__section">
            <div className="help-panel__tip"><strong>Click</strong> an animal on the globe to open its profile</div>
            <div className="help-panel__tip"><strong>Chat</strong> — Talk with the animal through AI</div>
            <div className="help-panel__tip"><strong>Listen</strong> — Hear what the animal sounded like</div>
            <div className="help-panel__tip"><strong>Wiki</strong> — Read the full Wikipedia article</div>
            <div className="help-panel__tip"><strong>Snap</strong> — Capture and save the animal's card</div>
            <div className="help-panel__tip"><strong>Drag</strong> the globe to explore different regions</div>
          </div>
        </div>
      </div>

      {/* Loading screen — fades out once the first frame is painted. */}
      <div
        id="loading-screen"
        className={ready ? 'fade-out' : ''}
        aria-label="Loading Lost Planet"
      />
    </>
  );
}
