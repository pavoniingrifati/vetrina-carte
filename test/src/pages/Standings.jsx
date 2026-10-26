import React from "react";
import { useUniverse } from "@/lib/universe-context";
import { trimClub } from "@/lib/fantaballa";
import PageHeader from "@/components/common/PageHeader";
import PageLoading from "@/components/common/PageLoading";
import ClubCrest from "@/components/common/ClubCrest";
import { cn } from "@/lib/utils";

export default function Standings() {
  const { loading, standings, config, clubsMap, meta } = useUniverse();

  if (loading) return <PageLoading />;

  const rows = [...standings].sort((a, b) => (a.position || 99) - (b.position || 99));
  const topZone = 4;
  const bottomZone = rows.length - 4;

  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader title="Classifica" subtitle={`${meta.competition} · ${rows.length} squadre`} />

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card/80">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border/70 bg-white/[0.03] font-heading text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="w-9 px-2 py-2 text-left font-semibold">Pos</th>
                <th className="px-2 py-2 text-left font-semibold">Squadra</th>
                <th className="w-9 px-1 py-2 text-center font-semibold">G</th>
                <th className="w-9 px-1 py-2 text-center font-semibold">V</th>
                <th className="w-9 px-1 py-2 text-center font-semibold">N</th>
                <th className="w-9 px-1 py-2 text-center font-semibold">P</th>
                <th className="w-10 px-1 py-2 text-center font-semibold">GF</th>
                <th className="w-10 px-1 py-2 text-center font-semibold">GS</th>
                <th className="w-10 px-1 py-2 text-center font-semibold">DR</th>
                <th className="w-12 px-2 py-2 text-center font-semibold">Pti</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const own = row.club === config.team;
                const diff = (row.gf || 0) - (row.ga || 0);
                const zone = row.position <= topZone ? "border-l-emerald-400/70" : row.position > bottomZone ? "border-l-rose-400/70" : "border-l-transparent";
                return (
                  <tr
                    key={row.club}
                    className={cn(
                      "border-b border-l-2 border-border/40 transition-colors last:border-b-0 hover:bg-white/[0.04]",
                      zone,
                      own && "bg-club/12 hover:bg-club/15"
                    )}
                  >
                    <td className={cn("px-2 py-2 font-heading tnum", own ? "text-club" : "text-muted-foreground")}>{row.position}</td>
                    <td className="px-2 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <ClubCrest name={row.club} colors={clubsMap.get(row.club)?.colors} size={20} />
                        <span className={cn("truncate", own ? "font-semibold text-foreground" : "text-foreground/85")}>{trimClub(row.club)}</span>
                      </div>
                    </td>
                    <td className="px-1 py-2 text-center tnum text-muted-foreground">{row.played}</td>
                    <td className="px-1 py-2 text-center tnum text-muted-foreground">{row.won}</td>
                    <td className="px-1 py-2 text-center tnum text-muted-foreground">{row.drawn}</td>
                    <td className="px-1 py-2 text-center tnum text-muted-foreground">{row.lost}</td>
                    <td className="px-1 py-2 text-center tnum text-muted-foreground">{row.gf}</td>
                    <td className="px-1 py-2 text-center tnum text-muted-foreground">{row.ga}</td>
                    <td className={cn("px-1 py-2 text-center tnum", diff > 0 ? "text-emerald-300/90" : diff < 0 ? "text-rose-300/90" : "text-muted-foreground")}>
                      {diff > 0 ? `+${diff}` : diff}
                    </td>
                    <td className={cn("px-2 py-2 text-center font-heading text-sm font-semibold tnum", own ? "text-club" : "text-foreground")}>{row.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 px-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-1 rounded-full bg-emerald-400/70" /> Prime {topZone}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-1 rounded-full bg-rose-400/70" /> Ultime 4
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-1 rounded-full bg-club" /> La tua squadra
        </span>
        <span className="ml-auto">Dati dal salvataggio del {meta.saveDate.split("-").reverse().join("/")}</span>
      </div>
    </div>
  );
}