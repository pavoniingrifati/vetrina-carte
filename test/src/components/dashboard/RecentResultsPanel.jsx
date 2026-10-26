import React from "react";
import { Swords } from "lucide-react";
import { useUniverse } from "@/lib/universe-context";
import { RESULT_PILL, resultFor, shortDate, teamFixtures, trimClub } from "@/lib/fantaballa";
import Panel from "@/components/common/Panel";
import FormPills from "@/components/common/FormPills";
import { cn } from "@/lib/utils";

export default function RecentResultsPanel() {
  const { fixtures, config, clubsMap } = useUniverse();
  const played = teamFixtures(fixtures, config.team)
    .filter((f) => f.p)
    .sort((a, b) => b.d.localeCompare(a.d))
    .slice(0, 6);

  const form = played.slice(0, 5).map((f) => ({ ...resultFor(f, config.team), date: f.d }));

  return (
    <Panel title="Ultimi risultati" icon={Swords} actionTo="/calendario" actionLabel="Tutti" action={null}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <FormPills form={form} size="sm" />
        <span className="font-heading text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{played.length} partite</span>
      </div>
      <div className="space-y-1">
        {played.map((fixture) => {
          const result = resultFor(fixture, config.team);
          return (
            <div key={`${fixture.d}-${fixture.h}-${fixture.a}`} className="flex items-center gap-2 rounded-md px-1 py-1 text-[13px] hover:bg-white/[0.03]">
              <span className="w-9 shrink-0 font-heading text-[11px] tnum text-muted-foreground">{shortDate(fixture.d)}</span>
              <span className="w-3 shrink-0 font-heading text-[9px] uppercase tracking-wider text-muted-foreground">{result.home ? "C" : "T"}</span>
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ background: clubsMap.get(result.opponent)?.colors?.[0] || "#2b4a6b" }}
                />
                <span className="truncate text-muted-foreground">{trimClub(result.opponent)}</span>
              </span>
              <span className={cn("shrink-0 rounded border px-1.5 py-0.5 font-heading text-[11px] font-semibold tnum", RESULT_PILL[result.kind])}>
                {result.goals}-{result.against}
              </span>
            </div>
          );
        })}
        {!played.length ? <p className="py-4 text-center text-sm text-muted-foreground">Nessuna partita disputata.</p> : null}
      </div>
    </Panel>
  );
}