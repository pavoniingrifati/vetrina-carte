import React from "react";
import { cn } from "@/lib/utils";

export default function FilterChips({ options, value, onChange, className, label }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md border px-2.5 py-1 font-heading text-[11px] font-semibold uppercase tracking-wider transition-colors",
              active
                ? "border-club/60 bg-club/15 text-club"
                : "border-border/70 bg-white/[0.02] text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}