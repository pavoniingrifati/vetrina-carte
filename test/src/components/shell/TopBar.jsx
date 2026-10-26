import React from "react";
import { useUniverse } from "@/lib/universe-context";
import { mediumDate, seasonLabel } from "@/lib/fantaballa";
import ClubCrest from "@/components/common/ClubCrest";
import UniverseSwitcher from "@/components/shell/UniverseSwitcher";

export default function TopBar() {
  const { config, meta, clubsMap } = useUniverse();
  const own = clubsMap?.get(config.team);

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-5 lg:h-16 lg:px-7">
        <div className="flex min-w-0 items-center gap-2.5">
          <ClubCrest name={config.team} colors={own?.colors} label={config.monogram} size={32} className="lg:hidden" />
          <div className="min-w-0">
            <p className="truncate font-heading text-[15px] font-bold uppercase leading-none tracking-[0.12em] sm:text-base">{config.team}</p>
            <p className="mt-0.5 hidden truncate text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:block">
              {meta?.competition || "Campionato"} · {seasonLabel(meta?.season)}
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <UniverseSwitcher compact className="lg:hidden" />
          <span className="hidden items-center gap-1.5 rounded-md border border-border/70 bg-white/[0.03] px-2 py-1 font-heading text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Save {meta ? mediumDate(meta.saveDate) : "—"}
          </span>
          <span className="rounded-md border border-club/40 bg-club/10 px-2 py-1 font-heading text-[10px] font-semibold uppercase tracking-[0.18em] text-club">
            {seasonLabel(meta?.season)}
          </span>
        </div>
      </div>
    </header>
  );
}