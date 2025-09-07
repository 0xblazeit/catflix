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

    // Grid-based jittered placement to reduce clustering/overlap
    const totalCells = Math.max(count, Math.ceil(count * 3));
    const cols = Math.max(4, Math.ceil(Math.sqrt(totalCells)));
    const rows = Math.max(4, Math.ceil(totalCells / cols));

    const leftMargin = 3; // percent
    const topMargin = 5; // percent
    const gridW = 94; // percent available horizontally
    const gridH = 88; // percent available vertically
    const cellW = gridW / cols;
    const cellH = gridH / rows;

    // Build list of cell indices and sample without replacement
    const allCells: number[] = Array.from({ length: cols * rows }, (_v, i) => i);
    // Fisher–Yates shuffle
    for (let i = allCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
    }
    const picked = allCells.slice(0, count);

    available.forEach((src, idx) => {
      const cell = picked[idx % picked.length];
      const c = cell % cols;
      const r = Math.floor(cell / cols);
      // jitter within each cell but stay away from edges to further reduce overlap
      const jitterX = cellW * (0.25 + 0.5 * Math.random());
      const jitterY = cellH * (0.25 + 0.5 * Math.random());
      const leftPct = leftMargin + c * cellW + jitterX;
      const topPct = topMargin + r * cellH + jitterY;

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
        leftPct,
        topPct,
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
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {specs.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${p.src}-${i}`}
          src={p.src}
          alt=""
          style={{
            left: `${p.leftPct}%`,
            top: `${p.topPct}%`,
            width: `${p.widthPx}px`,
            opacity: p.opacity,
            zIndex: p.z,
            // animation knobs
            // @ts-expect-error CSS variables
            "--dx": `${p.dxPx}px`,
            // @ts-expect-error CSS variables
            "--dy": `${p.dyPx}px`,
            // @ts-expect-error CSS variables
            "--dur": `${p.durationSec}s`,
            // @ts-expect-error CSS variables
            "--delay": `${p.delaySec}s`,
            // @ts-expect-error CSS variables
            "--ease": p.ease,
            // @ts-expect-error CSS variables
            "--dir": p.dir,
            // @ts-expect-error CSS variables
            "--rot": `${p.rotDeg}deg`,
            // @ts-expect-error CSS variables
            "--scale": p.scale,
            // @ts-expect-error CSS variables
            "--scaleDelta": p.scaleDelta,
          } as React.CSSProperties}
          className="ambient-poster select-none"
        />
      ))}
    </div>
  );
}


