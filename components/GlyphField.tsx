"use client";
import { useEffect, useRef } from "react";

const GLYPHS = "·.+*:=^~<>|/\\-".split("");
const GRAYS = ["#9CA3AF", "#D1D5D8", "#B6BCC6", "#E5E7EB"];

/**
 * Whisper-quiet generative backdrop: a full-viewport field of faint drifting
 * glyph characters in monochrome grays. Pure decoration — non-interactive,
 * very low opacity, and static when the user prefers reduced motion.
 */
export default function GlyphField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let raf = 0;
    let w = 0;
    let h = 0;
    const CELL = 30;

    interface Cell {
      ch: string;
      gray: string;
      phase: number;
      speed: number;
      alpha: number;
    }
    let cells: Cell[] = [];
    let cols = 0;
    let rows = 0;

    const seed = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / CELL) + 1;
      rows = Math.ceil(h / CELL) + 1;
      cells = [];
      for (let i = 0; i < cols * rows; i++) {
        // sparse: most cells stay empty so the field breathes
        if (Math.random() < 0.42) {
          cells.push({
            ch: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
            gray: GRAYS[Math.floor(Math.random() * GRAYS.length)],
            phase: Math.random() * Math.PI * 2,
            speed: 0.15 + Math.random() * 0.35,
            alpha: 0.25 + Math.random() * 0.55,
          });
        } else {
          cells.push({
            ch: "",
            gray: "#D1D5D8",
            phase: 0,
            speed: 0,
            alpha: 0,
          });
        }
      }
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.font = "13px ui-monospace, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let i = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++, i++) {
          const cell = cells[i];
          if (!cell.ch) continue;
          // slow breathing drift
          const tw = 0.5 + 0.5 * Math.sin(cell.phase + t * 0.001 * cell.speed);
          ctx.globalAlpha = 0.16 * cell.alpha * (0.35 + 0.65 * tw);
          ctx.fillStyle = cell.gray;
          const x = c * CELL + CELL / 2;
          const y = r * CELL + CELL / 2 + Math.sin(cell.phase + t * 0.0002) * 3;
          ctx.fillText(cell.ch, x, y);
          // rare glyph mutation keeps it alive
          if (!reduced && Math.random() < 0.0006) {
            cell.ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    seed();
    draw(0);

    if (!reduced) {
      let last = 0;
      const tick = (t: number) => {
        // ~12fps is plenty for a calm drift
        if (t - last > 80) {
          last = t;
          draw(t);
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    const onResize = () => seed();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
