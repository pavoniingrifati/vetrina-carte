import React, { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useUniverse } from "@/lib/universe-context";
import { RESULT_PILL, mediumDate, resultFor, teamFixtures, trimClub } from "@/lib/fantaballa";
import PageHeader from "@/components/common/PageHeader";
import PageLoading from "@/components/common/PageLoading";
import FilterChips from "@/components/common/FilterChips";
import ClubCrest from "@/components/common/ClubCrest";
import { cn } from "@/lib/utils";

const VIEW_OPTIONS = [
  { value: "upcoming", label: "Prossime gare" },
  { value: "results", label: "Risultati" },
];

function MatchRow({ fixture, team, clubsMap }) {
  const result = resultFor(fixture, team);
  const ownHome = fixture.h === team;
  return (
    <div className="flex items-center gap-2 border-b border-border/40 px-2 py-2 text-[13px] last:border-0 hover:bg-white/[0.03]">
      <div className="w-9 shrink-0 text-center">
        <p className="font-heading text-[11px] tnum leading-none text-muted-foreground">{mediumDate(fixture.d)}</p>
        <p className="mt-0.5 font-heading text-[9px] uppercase tracking-wider text-muted-foreground/70">{fixture.r != null ? `${fixture.r + 1}ª` : "—"}</p>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
        <span className={cn("truncate text-right", ownHome ? "font-semibold text-club" : "text-foreground/85")}>{trimClub(fixture.h)}</span>
        <ClubCrest name={fixture.h} colors={clubsMap.get(fixture.h)?.colors} size={20} />
      </div>
      <div className="w-12 shrink-0 text-center">
        {fixture.p ? (
          <span className={cn("inline-block rounded border px-1.5 py-0.5 font-heading text-[11px] font-semibold tnum", RESULT_PILL[result.kind])}>
            {fixture.hg}-{fixture.ag}
          </span>
        ) : (
          <span className="font-heading text-[11px] tracking-widest text-muted-foreground">—</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <ClubCrest name={fixture.a} colors={clubsMap.get(fixture.a)?.colors} size={20} />
        <span className={cn("truncate", !ownHome ? "font-semibold text-club" : "text-foreground/85")}>{trimClub(fixture.a)}</span>
      </div>
      <span className="hidden w-8 shrink-0 text-center font-heading text-[9px] uppercase tracking-wider text-muted-foreground sm:block">
        {fixture.p ? (result.kind === "win" ? "V" : result.kind === "draw" ? "P" : "S") : ownHome ? "C" : "T"}
      </span>
    </div>
  );
}

export default function Fixtures() {
  const { loading, fixtures, config, clubsMap, meta } = useUniverse();
  const [view, setView] = useState("upcoming");

  const matches = useMemo(() => {
    if (!fixtures) return [];
    const all = teamFixtures(fixtures, config.team);
    return view === "upcoming"
      ? all.filter((f) => !f.p).sort((a, b) => a.d.localeCompare(b.d))
      : all.filter((f) => f.p).sort((a, b) => b.d.localeCompare(a.d));
  }, [fixtures, config.team, view]);

  if (loading) return <PageLoading />;

  const played = teamFixtures(fixtures, config.team).filter((f) => f.p).length;
  const rounds = new Set(fixtures.map((f) => f.r)).size;

  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader title="Calendario" subtitle={`${meta.competition} · ${played} partite giocate su ${rounds} giornate`} />

      <FilterChips options={VIEW_OPTIONS} value={view} onChange={setView} label="Vista calendario" />

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card/80">
        <div className="flex items-center gap-2 border-b border-border/70 bg-white/[0.03] px-3 py-2">
          <CalendarDays className="h-3.5 w-3.5 text-club" />
          <span className="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {view === "upcoming" ? `Prossime ${matches.length} gare` : `Ultime ${matches.length} gare`}
          </span>
        </div>
        {matches.map((fixture) => (
          <MatchRow key={`${fixture.d}-${fixture.h}-${fixture.a}`} fixture={fixture} team={config.team} clubsMap={clubsMap} />
        ))}
        {!matches.length ? <p className="py-10 text-center text-sm text-muted-foreground">Nessuna partita disponibile.</p> : null}
      </div>
    </div>
  );
}