"use client";

import * as React from "react";

type PosterSpec = {
  src: string;
  leftPct: number;
  topPct: number;
  widthPx: number;
  dxPx: number;
  dyPx: number;
  durationSec: number;
  delaySec: number;
  ease: string;
  dir: string;
  rotDeg: number;
  scale: number;
  scaleDelta: number;
  z: number;
  opacity: number;
};

/**
 * Ambient floating posters background.
 * Attempts to discover images in /cat-posters by probing common names (1..24, .jpg/.png) via HEAD.
 * Only discovered images are rendered. Customize by providing your own list with the images prop.
 */
export function AmbientPosters({ images }: { images?: string[] }) {
  const [available, setAvailable] = React.useState<string[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    async function probe() {
      if (images && images.length > 0) {
        setAvailable(images);
        return;
      }
      try {
        const res = await fetch('/api/posters');
        const data = await res.json();
        if (!cancelled && Array.isArray(data.images)) setAvailable(data.images as string[]);
      } catch {
        if (!cancelled) setAvailable([]);
      }
    }
    void probe();
    return () => {
      cancelled = true;
    };
  }, [images]);

  const specs = React.useMemo<PosterSpec[]>(() => {
    const rng = (min: number, max: number) => Math.random() * (max - min) + min;
    const out: PosterSpec[] = [];

    const count = available.length;
    if (count === 0) return out;

    // Poisson-like placement (rejection sampling) to minimize clustering across full viewport
    const placed: Array<{ x: number; y: number }> = [];
    const minDist = 18; // percent of viewport; larger -> less clustering
    const attemptsPerItem = 200;

    function place(): { x: number; y: number } {
      for (let a = 0; a < attemptsPerItem; a++) {
        const x = rng(4, 96);
        const y = rng(6, 94);
        const ok = placed.every((p) => Math.hypot(x - p.x, y - p.y) >= minDist);
        if (ok) return { x, y };
      }
      // fallback: accept even if too close
      return { x: rng(4, 96), y: rng(6, 94) };
    }

    available.forEach((src) => {
      const pos = place();
      placed.push(pos);

      // Movement profile tiers for more variation
      const tier = Math.random();
      let dxMax = 14;
      let dyMax = 10;
      let durMin = 16;
      let durMax = 28;
      let ease = Math.random() < 0.5 ? "ease-in-out" : "ease-out";
      let rotMin = 0.5;
      let rotMax = 2.0;
      let scaleMin = 0.98;
      let scaleMax = 1.02;
      let scaleDeltaMin = 1.01;
      let scaleDeltaMax = 1.04;

      if (tier < 0.33) {
        // Drift: slow, small movement
        dxMax = 6 + Math.random() * 6; // 6-12
        dyMax = 4 + Math.random() * 6; // 4-10
        durMin = 24; durMax = 40;
        ease = "ease-in-out";
        rotMin = 0.3; rotMax = 1.2;
        scaleMin = 0.985; scaleMax = 1.015;
        scaleDeltaMin = 1.005; scaleDeltaMax = 1.015;
      } else if (tier < 0.66) {
        // Float: medium movement
        dxMax = 14 + Math.random() * 10; // 14-24
        dyMax = 10 + Math.random() * 8;  // 10-18
        durMin = 14; durMax = 26;
        ease = Math.random() < 0.5 ? "ease-in-out" : "ease-out";
        rotMin = 0.5; rotMax = 2.0;
        scaleMin = 0.98; scaleMax = 1.02;
        scaleDeltaMin = 1.01; scaleDeltaMax = 1.03;
      } else {
        // Glide: faster, larger movement
        dxMax = 22 + Math.random() * 14; // 22-36
        dyMax = 16 + Math.random() * 12; // 16-28
        durMin = 8; durMax = 18;
        ease = Math.random() < 0.5 ? "ease" : "ease-in";
        rotMin = 1.0; rotMax = 3.0;
        scaleMin = 0.975; scaleMax = 1.025;
        scaleDeltaMin = 1.015; scaleDeltaMax = 1.04;
      }

      const dxPx = Math.round(rng(-dxMax, dxMax));
      const dyPx = Math.round(rng(-dyMax, dyMax));
      const durationSec = rng(durMin, durMax);
      const delaySec = rng(-6, 6);
      const rotDeg = rng(rotMin, rotMax);
      const scale = rng(scaleMin, scaleMax);
      const scaleDelta = rng(scaleDeltaMin, scaleDeltaMax);

      out.push({
        src,
        leftPct: pos.x,
        topPct: pos.y,
        widthPx: Math.round(rng(100, 160)),
        dxPx,
        dyPx,
        durationSec,
        delaySec,
        ease,
        dir: Math.random() < 0.5 ? "alternate" : "alternate-reverse",
        rotDeg,
        scale,
        scaleDelta,
        z: Math.random() < 0.5 ? 0 : 1,
        opacity: rng(0.42, 0.6),
      });
    });

    return out;
  }, [available]);

  if (specs.length === 0) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {specs.map((p, i) => {
        const hue = Math.round(Math.random() * 120) + 20; // 20-140deg
        const hueDur = (Math.random() * 10 + 10).toFixed(1) + "s"; // 10-20s
        const hueDelay = (Math.random() * -8).toFixed(1) + "s"; // negative stagger
        const trailOpacity = Math.max(0.18, p.opacity - 0.2);
        const trailScale = p.scale * 0.995;
        const trailDelay = (p.delaySec - p.durationSec * 0.08).toFixed(2) + "s";

        return (
          <React.Fragment key={`${p.src}-${i}`}>
            {/* trail */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.src}
              alt=""
              style={{
                left: `${p.leftPct}%`,
                top: `${p.topPct}%`,
                width: `${p.widthPx}px`,
                opacity: trailOpacity,
                zIndex: Math.max(0, p.z - 1),
                ["--dx" as unknown as string]: `${Math.round(p.dxPx * 0.9)}px`,
                ["--dy" as unknown as string]: `${Math.round(p.dyPx * 0.9)}px`,
                ["--dur" as unknown as string]: `${(p.durationSec * 1.05).toFixed(2)}s`,
                ["--delayTrail" as unknown as string]: trailDelay,
                ["--ease" as unknown as string]: p.ease,
                ["--dir" as unknown as string]: p.dir,
                ["--rot" as unknown as string]: `${(p.rotDeg * 0.9).toFixed(2)}deg`,
                ["--scale" as unknown as string]: String(trailScale),
                ["--scaleDelta" as unknown as string]: String(p.scaleDelta),
                ["--hue" as unknown as string]: `${hue}deg`,
                ["--hueDur" as unknown as string]: hueDur,
                ["--hueDelay" as unknown as string]: hueDelay,
              } as React.CSSProperties}
              className="ambient-poster-trail select-none"
            />

            {/* main */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.src}
              alt=""
              style={{
                left: `${p.leftPct}%`,
                top: `${p.topPct}%`,
                width: `${p.widthPx}px`,
                opacity: p.opacity,
                zIndex: p.z,
                // animation knobs
                ["--dx" as unknown as string]: `${p.dxPx}px`,
                ["--dy" as unknown as string]: `${p.dyPx}px`,
                ["--dur" as unknown as string]: `${p.durationSec}s`,
                ["--delay" as unknown as string]: `${p.delaySec}s`,
                ["--ease" as unknown as string]: p.ease,
                ["--dir" as unknown as string]: p.dir,
                ["--rot" as unknown as string]: `${p.rotDeg}deg`,
                ["--scale" as unknown as string]: String(p.scale),
                ["--scaleDelta" as unknown as string]: String(p.scaleDelta),
              } as React.CSSProperties}
              className="ambient-poster select-none"
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}


