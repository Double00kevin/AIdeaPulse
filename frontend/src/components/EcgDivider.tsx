import { useEffect, useRef } from "react";

interface Props {
  index?: number;
}

function ecgY(t: number): number {
  if (t < 0.08) return 0;
  if (t < 0.16) { const p = (t - 0.08) / 0.08; return -Math.sin(p * Math.PI) * 0.08; }
  if (t < 0.20) return 0;
  if (t < 0.23) { const q = (t - 0.20) / 0.03; return Math.sin(q * Math.PI) * 0.06; }
  if (t < 0.28) { const r = (t - 0.23) / 0.05; return -Math.sin(r * Math.PI) * 1.0; }
  if (t < 0.33) { const s = (t - 0.28) / 0.05; return Math.sin(s * Math.PI) * 0.45; }
  if (t < 0.40) return 0;
  if (t < 0.55) { const tw = (t - 0.40) / 0.15; return -Math.sin(tw * Math.PI) * 0.12; }
  return 0;
}

export default function EcgDivider({ index = 0 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let traceAge: Float64Array;
    let traceY: Float32Array;
    const speed = 1.0;
    const beatLen = 320;
    const gapSize = 80;
    const maxAge_factor = 1.2;
    const height = 80;

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.offsetWidth;
      canvas.width = w * dpr;
      canvas.height = height * dpr;
      canvas.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const oldAge = traceAge;
      const oldY = traceY;
      traceAge = new Float64Array(w);
      traceY = new Float32Array(w);

      if (oldAge && oldY) {
        const copyLen = Math.min(oldAge.length, w);
        traceAge.set(oldAge.subarray(0, copyLen));
        traceY.set(oldY.subarray(0, copyLen));
      }
    }

    function prefill(w: number, cursorX: number, beatPhase: number) {
      const now = performance.now();
      for (let x = 0; x < w; x++) {
        const dist = (cursorX - x + w) % w;
        if (dist < gapSize) {
          traceAge[x] = 0;
          traceY[x] = 0;
          continue;
        }
        const age = dist / speed;
        traceAge[x] = now - age * (1000 / 60);
        const phase = ((beatPhase - dist / beatLen) % 1 + 1) % 1;
        traceY[x] = ecgY(phase);
      }
    }

    resize();

    const w = canvas.offsetWidth;
    // Stagger starting position by index
    let cursorX = (w * 0.3 * index) % w;
    let beatPhase = (index * 0.4) % 1;

    prefill(w, cursorX, beatPhase);

    let lastTime = performance.now();

    function draw(now: number) {
      if (!canvas || !ctx) return;
      const w = canvas.offsetWidth;
      const midY = height / 2;
      const amp = height * 0.35;
      const maxAge = w * maxAge_factor;

      const dt = Math.min(now - lastTime, 50);
      lastTime = now;
      const pxToAdvance = speed * dt * 0.06;

      // Advance cursor
      cursorX = (cursorX + pxToAdvance) % w;
      beatPhase = (beatPhase + pxToAdvance / beatLen) % 1;

      // Stamp new pixels
      const startX = Math.floor((cursorX - pxToAdvance + w) % w);
      const endX = Math.floor(cursorX);
      if (startX <= endX) {
        for (let x = startX; x <= endX; x++) {
          const d = (cursorX - x + w) % w;
          const phase = ((beatPhase - d / beatLen) % 1 + 1) % 1;
          traceAge[x] = now;
          traceY[x] = ecgY(phase);
        }
      } else {
        for (let x = startX; x < w; x++) {
          const d = (cursorX - x + w) % w;
          const phase = ((beatPhase - d / beatLen) % 1 + 1) % 1;
          traceAge[x] = now;
          traceY[x] = ecgY(phase);
        }
        for (let x = 0; x <= endX; x++) {
          const d = (cursorX - x + w) % w;
          const phase = ((beatPhase - d / beatLen) % 1 + 1) % 1;
          traceAge[x] = now;
          traceY[x] = ecgY(phase);
        }
      }

      ctx.clearRect(0, 0, w, height);

      // Faint baseline
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.strokeStyle = "rgba(34,211,238,0.04)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw trace — unified single pass
      for (let x = 0; x < w; x++) {
        if (traceAge[x] === 0) continue;
        const age = now - traceAge[x];
        const dist = (cursorX - x + w) % w;

        // Skip gap ahead of cursor
        if (dist < gapSize && dist >= 0) continue;

        const ageFrames = age / (1000 / 60);
        const norm = Math.min(ageFrames / (w * 1.2), 1.0);
        const visibility = Math.pow(1.0 - norm, 2.0);
        if (visibility < 0.005) continue;

        const whiteAmount = Math.pow(Math.max(0, 1.0 - age / 2500), 3.0);
        const r = Math.round(255 * whiteAmount + 34 * (1 - whiteAmount));
        const g = Math.round(255 * whiteAmount + 211 * (1 - whiteAmount));
        const b = Math.round(255 * whiteAmount + 238 * (1 - whiteAmount));
        const alpha = visibility * (0.15 + 0.85 * Math.pow(Math.max(0, 1.0 - age / 3300), 2.0));

        if (alpha < 0.005) continue;

        const y = midY + traceY[x] * amp;
        const nextX = (x + 1) % w;
        const yNext = (traceAge[nextX] !== 0 && !((cursorX - nextX + w) % w < gapSize))
          ? midY + traceY[nextX] * amp
          : y;

        ctx.save();
        if (whiteAmount > 0.05) {
          ctx.shadowColor = `rgba(34, 211, 238, ${whiteAmount * 0.8})`;
          ctx.shadowBlur = whiteAmount * 25;
        }
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 1, yNext);
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // Cursor dot
      const cy = midY + ecgY(beatPhase) * amp;
      ctx.save();
      ctx.shadowColor = "rgba(34, 211, 238, 0.8)";
      ctx.shadowBlur = 20;
      // Outer glow ring
      ctx.beginPath();
      ctx.arc(cursorX, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(34, 211, 238, 0.15)";
      ctx.fill();
      // Inner dot
      ctx.beginPath();
      ctx.arc(cursorX, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.restore();

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, [index]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full my-10"
      style={{ height: 80 }}
      aria-hidden="true"
    />
  );
}
