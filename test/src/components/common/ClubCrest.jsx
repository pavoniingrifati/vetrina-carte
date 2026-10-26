import React from "react";
import { cn } from "@/lib/utils";
import { monogram } from "@/lib/fantaballa";

const FALLBACK = ["#2b4a6b", "#152538"];

export default function ClubCrest({ name, colors, size = 30, className, label }) {
  const first = colors?.[0] || FALLBACK[0];
  const second = colors?.[1] || FALLBACK[1];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[3px] font-heading font-bold uppercase leading-none tracking-tight text-white ring-1 ring-white/15",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.38)),
        background: `linear-gradient(145deg, ${first}, ${second})`,
        clipPath: "polygon(0 0, 100% 0, 100% 68%, 50% 100%, 0 68%)",
        paddingBottom: Math.round(size * 0.1),
      }}
    >
      {label || monogram(name)}
    </span>
  );
}