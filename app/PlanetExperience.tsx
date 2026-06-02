'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';

// The WebGL canvas + all of Three.js is loaded client-only. ssr:false is only
// allowed from a Client Component, which this is. This keeps `window`/`document`
// and the renderer out of the server render entirely.
const PlanetCanvas = dynamic(() => import('./PlanetCanvas'), { ssr: false });

export default function PlanetExperience() {
  const [ready, setReady] = useState(false);
  const [helpOpen, setHelpOpen] = useState(true);

  // Stable callback so PlanetCanvas's effect mounts exactly once.
  const handleReady = useCallback(() => setReady(true), []);

  return (
    <>
      <PlanetCanvas onReady={handleReady} />

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
        ?
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
      >
        <div className="ls-bar" />
      </div>
    </>
  );
}
