import { useEffect, useRef } from "react";

const STAR_COUNT = 850;

const COLORS: Array<[number, number, number]> = [
  [255, 255, 255],
  [255, 255, 255],
  [255, 255, 255],
  [255, 255, 255],
  [200, 240, 220],
  [180, 230, 255],
  [0, 255, 156],
  [0, 255, 156],
  [255, 214, 10],
];

interface Star {
  x: number;
  y: number;
  baseAlpha: number;
  freq: number;
  phase: number;
  size: number;
  boostFreq: number;
  boostPhase: number;
  boostAmp: number;
  color: [number, number, number];
  sparkle: boolean;
  bornAt: number;
  lifespan: number;
}

function pickColor(): [number, number, number] {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function seedStar(s: Star, width: number, height: number, t: number) {
  const isBig = Math.random() < 0.1;
  s.x = Math.random() * width;
  s.y = Math.random() * height;
  s.baseAlpha = Math.random() * 0.35 + 0.25;
  s.freq = 0.0008 + Math.random() * 0.002;
  s.phase = Math.random() * Math.PI * 2;
  s.size = isBig ? 0.9 + Math.random() * 0.5 : 0.5 + Math.random() * 0.6;
  s.boostFreq = 0.00008 + Math.random() * 0.00025;
  s.boostPhase = Math.random() * Math.PI * 2;
  s.boostAmp = isBig ? 0.5 + Math.random() * 0.7 : 0.3 + Math.random() * 0.6;
  s.color = pickColor();
  s.sparkle = isBig;
  s.bornAt = t;
  s.lifespan = 20000 + Math.random() * 25000;
}

export function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const dpr = window.devicePixelRatio || 1;
    const stars: Star[] = [];
    function build() {
      const t = performance.now();
      stars.length = 0;
      for (let i = 0; i < STAR_COUNT; i++) {
        const s = {} as Star;
        seedStar(s, width, height, t - Math.random() * 16000); // stagger ages
        stars.push(s);
      }
    }

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    function tick() {
      const t = performance.now();
      ctx.clearRect(0, 0, width, height);

      // stars
      for (const s of stars) {
        const age = t - s.bornAt;
        if (age > s.lifespan) {
          seedStar(s, width, height, t);
          continue;
        }
        const lifeProgress = age / s.lifespan;
        const envelope = Math.sin(lifeProgress * Math.PI); // 0→1→0
        const twinkle = s.baseAlpha + 0.18 * Math.sin(t * s.freq + s.phase);
        const a = Math.max(0, Math.min(1, twinkle * envelope));
        if (a < 0.02) continue;
        const [r, g, b] = s.color;

        // size pulse — slow, independent sine wave per star
        const boostRaw = Math.sin(t * s.boostFreq + s.boostPhase);
        const boost = Math.pow(Math.max(0, boostRaw), 2);
        const curSize = s.size * (1 + boost * s.boostAmp);
        const isPeaking = boost > 0.55;

        if (a > 0.4 || (isPeaking && a > 0.25)) {
          const haloR = curSize * (s.sparkle ? 3.8 : 2.6);
          const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, haloR);
          const haloA = Math.min(1, a * (0.28 + boost * 0.32));
          grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${haloA})`);
          grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(s.x, s.y, haloR, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, curSize, 0, Math.PI * 2);
        ctx.fill();

        // diffraction spikes — gives the dot a real "star" feel
        if (s.sparkle && a > 0.22) {
          const spikeLen = curSize * (3.8 + boost * 2.4);
          const spikeA = a * 0.6;
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${spikeA})`;
          ctx.lineWidth = 0.55;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(s.x - spikeLen, s.y);
          ctx.lineTo(s.x + spikeLen, s.y);
          ctx.moveTo(s.x, s.y - spikeLen);
          ctx.lineTo(s.x, s.y + spikeLen);
          ctx.stroke();
          if (boost > 0.55) {
            const d = spikeLen * 0.55;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${spikeA * 0.4})`;
            ctx.lineWidth = 0.4;
            ctx.beginPath();
            ctx.moveTo(s.x - d, s.y - d);
            ctx.lineTo(s.x + d, s.y + d);
            ctx.moveTo(s.x - d, s.y + d);
            ctx.lineTo(s.x + d, s.y - d);
            ctx.stroke();
          }
        } else if (!s.sparkle && a > 0.45) {
          // very subtle 2-point shimmer on bright small stars
          const spikeLen = curSize * 2.2;
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${a * 0.25})`;
          ctx.lineWidth = 0.3;
          ctx.beginPath();
          ctx.moveTo(s.x - spikeLen, s.y);
          ctx.lineTo(s.x + spikeLen, s.y);
          ctx.moveTo(s.x, s.y - spikeLen);
          ctx.lineTo(s.x, s.y + spikeLen);
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="starfield" />;
}
