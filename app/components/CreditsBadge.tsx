"use client";

import { useEffect, useState } from "react";
import { getCredits, onCreditsChange } from "@/lib/credits";

export default function CreditsBadge({ compact = false, onClick }: { compact?: boolean; onClick?: () => void }) {
  const [credits, setCredits] = useState<number>(10);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCredits(getCredits());
    setReady(true);
    return onCreditsChange(setCredits);
  }, []);

  if (!ready) return null;

  const empty = credits === 0;
  const low = credits > 0 && credits <= 3;

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
        empty
          ? "bg-[#ff3b30]/10 text-[#ff3b30]"
          : low
          ? "bg-[#ff9500]/10 text-[#ff9500]"
          : "bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]"
      }`}
      aria-label={`${credits} créditos`}
    >
      <span>🪙</span>
      <span className="num">{credits}</span>
      {!compact && <span className="hidden sm:inline">créditos</span>}
    </button>
  );
}
