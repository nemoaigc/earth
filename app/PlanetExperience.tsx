'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Keep the heavy WebGL / Three.js chunk off the initial HTML hydration path.
// Static-importing it makes DOMContentLoaded block on a large client bundle.
const PlanetCanvas = dynamic(() => import('./PlanetCanvas'), { ssr: false });



export default function PlanetExperience() {
  const [canvasReady, setCanvasReady] = useState(false);
  const [introReady, setIntroReady] = useState(false);
  const [canvasFailed, setCanvasFailed] = useState(false);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [helpOpen, setHelpOpen] = useState(true);
  const ready = (canvasReady || canvasFailed || loadingTimedOut) && introReady;

  const handleReady = useCallback(() => setCanvasReady(true), []);
  const handleError = useCallback(() => setCanvasFailed(true), []);

  useEffect(() => {
    const timer = window.setTimeout(() => setIntroReady(true), 1300);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoadingTimedOut(true), 6000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <PlanetCanvas onReady={handleReady} onError={handleError} />

      {/* Top bar: title + tagline (always visible) */}
      <div id="top-bar">
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
