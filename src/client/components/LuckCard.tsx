import { useEffect, useMemo, useState } from "react";
import type { ShootTier } from "./ShootingStarField";

const TIER_CFG: Record<ShootTier, { color: string; deepColor: string; points: number; label: string }> = {
  silver: { color: "#d2dce8", deepColor: "#8a96a6", points: 1, label: "Silver" },
  golden: { color: "#ffd700", deepColor: "#b8860b", points: 2, label: "Golden" },
  platinum: { color: "#b9f2ff", deepColor: "#3b9fb4", points: 3, label: "Platinum" },
};

interface Props {
  tier: ShootTier;
  onClose: () => void;
}

interface Quote {
  text: string;
  textKo?: string;
  author?: string;
  year?: string;
  source?: string;
}

let cachedSvg: string | null = null;

export function LuckCard({ tier, onClose }: Props) {
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/quote")
      .then((r) => (r.ok ? r.json() : null))
      .then((q) => {
        if (!cancelled) setQuote(q);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const cfg = TIER_CFG[tier];
  const [svgHtml, setSvgHtml] = useState<string>(cachedSvg ?? "");

  useEffect(() => {
    if (cachedSvg) return;
    fetch("/clover.svg")
      .then((r) => r.text())
      .then((t) => {
        cachedSvg = t;
        setSvgHtml(t);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sparkles = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const isStar = Math.random() < 0.55;
        return {
          id: i,
          angle: (i / 18) * Math.PI * 2 + Math.random() * 0.3,
          radius: 85 + Math.random() * 60,
          size: isStar ? 10 + Math.random() * 10 : 3 + Math.random() * 4,
          delay: Math.random() * 1.8,
          duration: 1.4 + Math.random() * 1.4,
          star: isStar,
        };
      }),
    [tier]
  );

  return (
    <div className="luck-overlay" onClick={onClose}>
      <div
        className={`luck-card tier-${tier}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          // expose tier colors as CSS vars
          // @ts-ignore
          "--tier-color": cfg.color,
          "--tier-deep": cfg.deepColor,
        }}
      >
        <button className="luck-close" onClick={onClose} aria-label="Close">×</button>

        <div className="luck-clover-wrap">
          {sparkles.map((s) => (
            <span
              key={s.id}
              className={`luck-spark ${s.star ? "star" : ""}`}
              style={{
                left: `calc(50% + ${Math.cos(s.angle) * s.radius}px)`,
                top: `calc(50% + ${Math.sin(s.angle) * s.radius}px)`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                animationDelay: `${s.delay}s`,
                animationDuration: `${s.duration}s`,
              }}
            />
          ))}
          <div
            className="luck-clover"
            style={{ color: cfg.color }}
            aria-label="Four-leaf clover"
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        </div>

        <div className="luck-title">You got a {cfg.label} Shooting Star!</div>
        <div className="luck-points">
          <span className="luck-plus">+{cfg.points}</span>
          <span className="luck-points-label">luck points today</span>
        </div>
        {quote && (
          <div className="luck-quote">
            <div className="luck-quote-scroll">
              {quote.textKo && <div className="luck-quote-translation">{quote.textKo}</div>}
              <div className="luck-quote-original">&ldquo;{quote.text}&rdquo;</div>
              <div className="luck-quote-meta">
                {quote.author && <span className="luck-quote-author">— {quote.author}</span>}
                {quote.year && <span className="luck-quote-year">{quote.year}</span>}
              </div>
              {quote.source && <div className="luck-quote-source">{quote.source}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
