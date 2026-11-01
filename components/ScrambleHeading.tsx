"use client";
import { useEffect, useRef, useState } from "react";

const SCRAMBLE = "abcdefghijklmnopqrstuvwxyz0123456789·:+*~^<>/".split("");

/**
 * Light-weight lowercase heading that scrambles in, resolving left to right.
 * Renders the final text immediately when reduced motion is preferred.
 */
export default function ScrambleHeading({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const [shown, setShown] = useState(text);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text);
      return;
    }
    const total = 1400;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / total);
      const resolved = Math.floor(p * text.length);
      let out = "";
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === " ") {
          out += " ";
        } else if (i < resolved) {
          out += c;
        } else {
          out += SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)];
        }
      }
      setShown(out);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setShown(text);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text]);

  return (
    <h1 className={className} aria-label={text}>
      <span aria-hidden="true">{shown}</span>
    </h1>
  );
}
