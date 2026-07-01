'use client';

import { useEffect, useRef } from 'react';
import { mountPlanet } from '../src/planet';

/**
 * Mounts the Three.js planet into a container div and tears it down on unmount.
 * The teardown is what makes this safe under React StrictMode / Fast Refresh,
 * which mount→unmount→remount in dev: without dispose() each cycle would leak a
 * second WebGL context and animation loop until the browser runs out of contexts.
 */
export default function PlanetCanvas({
  onReady,
  onAfterRender,
}: {
  onReady?: () => void;
  onAfterRender?: (canvas: HTMLCanvasElement) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Keep the latest onReady without making it an effect dependency, so the
  // planet mounts exactly once per real mount.
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onAfterRenderRef = useRef(onAfterRender);
  onAfterRenderRef.current = onAfterRender;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const dispose = mountPlanet(container, {
      onReady: () => onReadyRef.current?.(),
      onAfterRender: (canvas) => onAfterRenderRef.current?.(canvas),
    });
    return dispose;
  }, []);

  return <div ref={containerRef} id="app" />;
}
