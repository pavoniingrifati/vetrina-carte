import React from "react";
import { NavLink } from "react-router-dom";
import { useUniverse } from "@/lib/universe-context";
import { NAV_ITEMS } from "@/lib/nav";
import { mediumDate } from "@/lib/fantaballa";
import ClubCrest from "@/components/common/ClubCrest";
import UniverseSwitcher from "@/components/shell/UniverseSwitcher";
import { cn } from "@/lib/utils";

export default function Sidebar() {
  const { config, meta, clubsMap, squad } = useUniverse();
  const own = clubsMap?.get(config.team);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[258px] flex-col border-r border-border/70 bg-sidebar lg:flex">
      <div className="flex items-center gap-2.5 border-b border-border/70 px-4 py-4">
        <ClubCrest name={config.team} colors={own?.colors} label={config.monogram} size={38} />
        <div className="min-w-0">
          <p className="font-heading text-[19px] font-bold uppercase leading-none tracking-[0.1em]">Fantaballa</p>
          <p className="mt-0.5 font-heading text-[10px] uppercase leading-none tracking-[0.28em] text-muted-foreground">Universe Manager</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 no-scrollbar">
        <p className="px-2 pb-2 font-heading text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Area club</p>
        <nav className="space-y-1" aria-label="Sezioni">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-club/12 text-foreground shadow-[inset_2px_0_0_hsl(var(--club))]"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-club" : "text-muted-foreground group-hover:text-foreground")} strokeWidth={2} />
                  <span className="truncate uppercase tracking-wide">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {meta ? (
          <div className="mt-5 rounded-lg border border-border/70 bg-white/[0.02] px-3 py-2.5">
            <p className="font-heading text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Salvataggio</p>
            <p className="mt-1 text-[12px] leading-relaxed text-foreground">{mediumDate(meta.saveDate)}</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {meta.clubsCount} club · {meta.playersCount.toLocaleString("it-IT")} giocatori
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Rosa: {squad?.length ?? 0} giocatori</p>
          </div>
        ) : null}
      </div>

      <div className="border-t border-border/70 px-3 py-3">
        <p className="px-1 pb-2 font-heading text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Universo</p>
        <UniverseSwitcher />
      </div>
    </aside>
  );
}