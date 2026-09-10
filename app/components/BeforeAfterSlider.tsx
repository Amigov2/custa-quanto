"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Slider avant/après style rehab-show : deux images superposées, une barre draggable
// qui révèle progressivement l après. Support drag souris + touch iOS.
export default function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  aspectRatio = 4 / 3,
}: {
  beforeSrc: string;
  afterSrc: string;
  aspectRatio?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);       // % de la largeur, 0 = tout avant, 100 = tout après
  const [dragging, setDragging] = useState(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPosition(pct);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent | TouchEvent) {
      const clientX = "touches" in e ? e.touches[0]?.clientX : (e as MouseEvent).clientX;
      if (typeof clientX === "number") updateFromClientX(clientX);
    }
    function onUp() { setDragging(false); }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
    };
  }, [dragging, updateFromClientX]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl select-none touch-none"
      style={{ aspectRatio: String(aspectRatio) }}
      onMouseDown={e => { setDragging(true); updateFromClientX(e.clientX); }}
      onTouchStart={e => { setDragging(true); updateFromClientX(e.touches[0].clientX); }}
    >
      {/* Image AVANT en fond */}
      <img
        src={beforeSrc}
        alt="Avant"
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Image APRÈS clippée à droite selon position */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 0 0 ${position}%)` }}
      >
        <img
          src={afterSrc}
          alt="Après"
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>

      {/* Barre verticale draggable */}
      <div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_rgba(0,0,0,0.3)] cursor-ew-resize"
        style={{ left: `${position}%`, transform: "translateX(-50%)" }}
      >
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center cursor-ew-resize"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0071e3" strokeWidth={2.5}>
            <polyline points="15 18 9 12 15 6" />
            <polyline points="9 18 15 12 9 6" transform="translate(-6 0)" />
          </svg>
        </div>
      </div>

      {/* Labels ANTES / DEPOIS */}
      <div className="absolute top-3 left-3 rounded-full bg-black/60 text-white text-[11px] font-semibold px-2.5 py-1 pointer-events-none">
        ANTES
      </div>
      <div className="absolute top-3 right-3 rounded-full bg-[color:var(--color-accent)] text-white text-[11px] font-semibold px-2.5 py-1 pointer-events-none">
        DEPOIS
      </div>
    </div>
  );
}
