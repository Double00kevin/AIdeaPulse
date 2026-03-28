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

    // State
    let animId: number;
    let w = 0;
    let h = 80;
    let centerY = h / 2;
    let amplitude = h * 0.42;
    let traceData: (number | null)[] = [];
    let traceAge: number[] = [];
    let cursorX = 0;
    let beatPhase = 0;
    let frameCount = 0;
    const speed = 1.0;
    const beatLength = 320;
    const gapSize = 80;

    function resize() {
      if (!canvas) return;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const dpr = window.devicePixelRatio || 1;
      w = rect.width;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      centerY = h / 2;
      amplitude = h * 0.42;
      traceData = new Array(Math.ceil(w)).fill(null);
      traceAge = new Array(Math.ceil(w)).fill(0);
    }

    function step() {
      frameCount++;
      cursorX += speed;
      if (cursorX >= w) cursorX = 0;

      beatPhase += speed / beatLength;
      if (beatPhase >= 1) beatPhase -= 1;

      const yOffset = ecgY(beatPhase);
      const y = centerY + yOffset * amplitude;

      const col = Math.floor(cursorX);
      traceData[col] = y;
      traceAge[col] = frameCount;

      for (let i = 1; i <= gapSize; i++) {
        const clearCol = (col + i) % traceData.length;
        traceData[clearCol] = null;
        traceAge[clearCol] = 0;
      }
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      // Faint baseline
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(w, centerY);
      ctx.strokeStyle = "rgba(34, 211, 238, 0.04)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const now = frameCount;
      const maxAge = w * 1.2;

      // Single unified draw pass — every pixel gets one color based on distance from cursor
      for (let x = 0; x < traceData.length - 1; x++) {
        if (traceData[x] === null || traceData[x + 1] === null) continue;

        const age = now - traceAge[x];
        if (age <= 0) continue;

        const norm = Math.min(age / maxAge, 1.0);
        const visibility = Math.pow(1.0 - norm, 2.0);
        if (visibility < 0.005) continue;

        const whiteAmount = Math.pow(Math.max(0, 1.0 - age / 150), 3.0);

        const r = Math.round(255 * whiteAmount + 34 * (1 - whiteAmount));
        const g = Math.round(255 * whiteAmount + 211 * (1 - whiteAmount));
        const b = Math.round(255 * whiteAmount + 238 * (1 - whiteAmount));

        const alpha = visibility * (0.15 + 0.85 * Math.pow(Math.max(0, 1.0 - age / 200), 2.0));

        ctx.beginPath();
        ctx.moveTo(x, traceData[x]!);
        ctx.lineTo(x + 1, traceData[x + 1]!);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.lineWidth = 1.2 + whiteAmount * 1.3;
        ctx.lineCap = "round";

        if (whiteAmount > 0.05) {
          ctx.shadowColor = `rgba(34, 211, 238, ${whiteAmount * 0.8})`;
          ctx.shadowBlur = whiteAmount * 25;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // Cursor dot
      const cursorCol = Math.floor(cursorX);
      if (traceData[cursorCol] !== null) {
        ctx.beginPath();
        ctx.arc(cursorX, traceData[cursorCol]!, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(34, 211, 238, 1)";
        ctx.shadowBlur = 20;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cursorX, traceData[cursorCol]!, 6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(34, 211, 238, 0.15)";
        ctx.shadowBlur = 30;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    resize();

    // Stagger starting positions
    cursorX = (index * 250 + 100) % Math.max(w, 1);
    beatPhase = (index * 0.25) % 1;

    // Pre-fill trace so it's not blank on load
    const targetX = cursorX;
    const targetPhase = beatPhase;
    cursorX = 0;
    beatPhase = ((targetPhase - (targetX / beatLength)) % 1 + 1) % 1;
    frameCount = 0;
    for (let i = 0; i < targetX; i++) {
      step();
    }
    cursorX = targetX;
    beatPhase = targetPhase;
    frameCount = Math.floor(targetX / speed);

    function animate() {
      step();
      draw();
      animId = requestAnimationFrame(animate);
    }

    animId = requestAnimationFrame(animate);

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
