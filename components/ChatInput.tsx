"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * The white rounded chat-input card: multi-line textarea, mono microcopy
 * row ("↵ send · ⇧↵ newline"), circular send button
 * (light gray disabled, near-black active).
 */
export default function ChatInput({
  value,
  onChange,
  onSend,
  placeholder = "Ask YapFi anything...",
  disabled = false,
  autoFocus = false,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const canSend = value.trim().length > 0 && !disabled;

  // auto-grow, capped
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  const keyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div
      className={`rounded-[20px] border bg-white shadow-card transition-colors ${
        focused ? "border-faint" : "border-line"
      }`}
    >
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={keyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        rows={2}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label="chat input"
        className="block w-full bg-transparent px-5 pb-1 pt-4 text-[15px] leading-relaxed text-ink placeholder:text-faint focus:outline-none disabled:opacity-50"
      />
      <div className="flex items-center justify-between px-4 pb-3 pt-1">
        <span className="select-none font-mono text-[11px] text-faint">
          &#9166; send &middot; &#8679;&#9166; newline
        </span>
        <button
          onClick={onSend}
          disabled={!canSend}
          aria-label="send message"
          className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
            canSend
              ? "bg-ink text-white hover:opacity-80"
              : "cursor-default bg-[#E9EBEE] text-white"
          }`}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
