import React from "react";
import { Link } from "react-router-dom";
import { CalendarRange } from "lucide-react";
import { useUniverse } from "@/lib/universe-context";
import { mediumDate, teamFixtures, trimClub } from "@/lib/fantaballa";
import ClubCrest from "@/components/common/ClubCrest";
import Panel from "@/components/common/Panel";

export default function UpcomingStrip() {
  const { fixtures, config, clubsMap } = useUniverse();
  const upcoming = teamFixtures(fixtures, config.team)
    .filter((f) => !f.p)
    .sort((a, b) => a.d.localeCompare(b.d))
    .slice(0, 5);

  if (!upcoming.length) return null;

  return (
    <Panel title="Prossime gare" icon={CalendarRange} actionTo="/calendario" actionLabel="Calendario" bodyClassName="px-3 pb-3 pt-3 sm:px-4">
      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
        {upcoming.map((fixture) => {
          const home = fixture.h === config.team;
          const opponent = home ? fixture.a : fixture.h;
          return (
            <div
              key={`${fixture.d}-${fixture.h}-${fixture.a}`}
              className="w-[152px] shrink-0 snap-start rounded-lg border border-border/70 bg-white/[0.02] px-2.5 py-2"
            >
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>{mediumDate(fixture.d)}</span>
                <span>{fixture.r != null ? `${fixture.r + 1}ª` : "—"}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <ClubCrest name={opponent} colors={clubsMap.get(opponent)?.colors} size={24} />
                <span className="min-w-0 flex-1 truncate text-[12px] leading-tight">{trimClub(opponent)}</span>
              </div>
              <span className={home ? "mt-2 block font-heading text-[9px] uppercase tracking-[0.18em] text-club" : "mt-2 block font-heading text-[9px] uppercase tracking-[0.18em] text-muted-foreground"}>
                {home ? "In casa" : "Trasferta"}
              </span>
            </div>
          );
        })}
        <Link
          to="/calendario"
          className="flex w-[104px] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/70 text-[11px] uppercase tracking-wider text-muted-foreground hover:border-club/50 hover:text-club"
        >
          Tutte
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </Panel>
  );
}