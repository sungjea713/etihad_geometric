import { useEffect, useRef, useState } from "react";

export type ShootTier = "silver" | "golden" | "platinum";

interface TierConfig {
  name: ShootTier;
  color: [number, number, number];
  spawnProb: number; // per frame at ~60fps
  size: number;
  trailMul: number;
  haloSize: number;
}

const TIERS: TierConfig[] = [
  // silver: ~every 5–8s
  { name: "silver", color: [210, 220, 232], spawnProb: 0.0035, size: 2.0, trailMul: 0.14, haloSize: 16 },
  // golden: ~every 25–40s
  { name: "golden", color: [255, 215, 0], spawnProb: 0.0008, size: 2.6, trailMul: 0.18, haloSize: 22 },
  // platinum: ~every 90–150s
  { name: "platinum", color: [185, 242, 255], spawnProb: 0.00018, size: 3.2, trailMul: 0.22, haloSize: 30 },
];

interface Shoot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t0: number;
  duration: number;
  lastT: number;
  tier: TierConfig;
}

interface Props {
  onPick: (tier: ShootTier) => void;
}

let nextId = 1;

export function ShootingStarField({ onPick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shootsRef = useRef<Shoot[]>([]);
  const hitboxRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [active, setActive] = useState<Array<{ id: number; tier: ShootTier }>>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function spawn(tier: TierConfig, t: number) {
      const fromTop = Math.random() < 0.7;
      const startX = fromTop ? Math.random() * width * 0.9 : -20;
      const startY = fromTop ? -20 : Math.random() * height * 0.4;
      const angle = Math.PI * 0.18 + Math.random() * Math.PI * 0.18;
      const speed = 450 + Math.random() * 350;
      const id = nextId++;
      shootsRef.current.push({
        id,
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        t0: t,
        duration: 1800 + Math.random() * 1200,
        lastT: t,
        tier,
      });
      setActive((prev) => [...prev, { id, tier: tier.name }]);
    }

    function removeShoot(id: number) {
      const idx = shootsRef.current.findIndex((s) => s.id === id);
      if (idx >= 0) shootsRef.current.splice(idx, 1);
      hitboxRefs.current.delete(id);
      setActive((prev) => prev.filter((s) => s.id !== id));
    }

    let raf = 0;
    function tick() {
      const t = performance.now();
      ctx.clearRect(0, 0, width, height);

      for (const tier of TIERS) {
        if (Math.random() < tier.spawnProb) spawn(tier, t);
      }

      for (let i = shootsRef.current.length - 1; i >= 0; i--) {
        const sh = shootsRef.current[i];
        const age = t - sh.t0;
        const lifeProgress = age / sh.duration;
        if (lifeProgress >= 1 || sh.x > width + 100 || sh.y > height + 100) {
          removeShoot(sh.id);
          continue;
        }
        const dt = (t - sh.lastT) / 1000;
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        sh.lastT = t;

        const hb = hitboxRefs.current.get(sh.id);
        if (hb) {
          hb.style.transform = `translate(${sh.x - 75}px, ${sh.y - 75}px)`;
        }

        const fadeIn = Math.min(1, lifeProgress * 5);
        const fadeOut = Math.min(1, (1 - lifeProgress) * 3);
        const a = Math.min(fadeIn, fadeOut);
        const [r, g, b] = sh.tier.color;
        const tailX = sh.x - sh.vx * sh.tier.trailMul;
        const tailY = sh.y - sh.vy * sh.tier.trailMul;

        // tail
        const grad = ctx.createLinearGradient(sh.x, sh.y, tailX, tailY);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = sh.tier.size;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(sh.x, sh.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // halo
        const halo = ctx.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, sh.tier.haloSize);
        halo.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a * 0.9})`);
        halo.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(sh.x, sh.y, sh.tier.haloSize, 0, Math.PI * 2);
        ctx.fill();

        // core dot — extra bright on platinum
        ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
        ctx.beginPath();
        ctx.arc(sh.x, sh.y, sh.tier.size + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      shootsRef.current = [];
      hitboxRefs.current.clear();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="shooting-stars" />
      <div className="shooting-hitboxes">
        {active.map((s) => (
          <div
            key={s.id}
            ref={(el) => {
              if (el) hitboxRefs.current.set(s.id, el);
              else hitboxRefs.current.delete(s.id);
            }}
            className={`shoot-hitbox tier-${s.tier}`}
            onClick={() => {
              onPickRef.current(s.tier);
              const idx = shootsRef.current.findIndex((sh) => sh.id === s.id);
              if (idx >= 0) shootsRef.current.splice(idx, 1);
              hitboxRefs.current.delete(s.id);
              setActive((prev) => prev.filter((x) => x.id !== s.id));
            }}
          />
        ))}
      </div>
    </>
  );
}
