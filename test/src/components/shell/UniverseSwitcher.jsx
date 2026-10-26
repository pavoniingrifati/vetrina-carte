import React from "react";
import { useUniverse } from "@/lib/universe-context";
import { UNIVERSES } from "@/lib/fantaballa";
import ClubCrest from "@/components/common/ClubCrest";
import { cn } from "@/lib/utils";

export default function UniverseSwitcher({ compact = false, className }) {
  const { universe, setUniverse, clubsMap } = useUniverse();

  return (
    <div className={cn(compact ? "flex gap-1.5" : "space-y-1.5", className)} role="group" aria-label="Seleziona universo">
      {UNIVERSES.map((item) => {
        const active = item.key === universe;
        const colors = clubsMap?.get(item.team)?.colors;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => setUniverse(item.key)}
            aria-pressed={active}
            className={cn(
              "flex items-center transition-colors",
              compact
                ? "gap-1.5 rounded-lg border px-2 py-1.5"
                : "w-full gap-2.5 rounded-lg border px-2.5 py-2 text-left",
              active
                ? "border-club/60 bg-club/12 text-foreground shadow-[inset_2px_0_0_hsl(var(--club))]"
                : "border-border/70 bg-white/[0.02] text-muted-foreground hover:border-border hover:bg-white/5 hover:text-foreground"
            )}
          >
            <ClubCrest name={item.team} colors={colors} label={item.monogram} size={compact ? 22 : 28} />
            <span className={cn("min-w-0", compact && "sr-only")}>
              <span className="block truncate font-heading text-[13px] font-semibold uppercase tracking-wider leading-tight">{item.team}</span>
              <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Super Lega · {item.tag}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}