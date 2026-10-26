import React from "react";
import { ListOrdered } from "lucide-react";
import { useUniverse } from "@/lib/universe-context";
import { trimClub } from "@/lib/fantaballa";
import Panel from "@/components/common/Panel";
import { cn } from "@/lib/utils";

function TableRow({ row, own }) {
  const diff = (row.gf || 0) - (row.ga || 0);
  return (
    <div
      className={cn(
        "grid grid-cols-[26px_1fr_26px_30px_34px] items-center gap-2 rounded-md px-2 py-1.5 text-[13px]",
        own ? "bg-club/12 text-foreground shadow-[inset_2px_0_0_hsl(var(--club))]" : "text-muted-foreground"
      )}
    >
      <span className={cn("font-heading text-xs tnum", own && "text-club")}>{row.position}</span>
      <span className={cn("truncate", own && "font-semibold text-foreground")}>{trimClub(row.club)}</span>
      <span className="text-center text-[12px] tnum">{row.played}</span>
      <span className="text-center text-[12px] tnum">{diff > 0 ? `+${diff}` : diff}</span>
      <span className={cn("text-right font-heading text-sm font-semibold tnum", own ? "text-club" : "text-foreground")}>{row.points}</span>
    </div>
  );
}

export default function StandingsPanel() {
  const { standings, config } = useUniverse();
  const sorted = [...standings].sort((a, b) => (a.position || 99) - (b.position || 99));
  const top = sorted.slice(0, 7);
  const mine = sorted.find((r) => r.club === config.team);
  const mineOutside = mine && !top.some((r) => r.club === config.team);

  return (
    <Panel title="Classifica" icon={ListOrdered} actionTo="/classifica">
      <div className="grid grid-cols-[26px_1fr_26px_30px_34px] items-center gap-2 px-2 pb-1 font-heading text-[9px] uppercase tracking-[0.16em] text-muted-foreground/80">
        <span>Pos</span>
        <span>Squadra</span>
        <span className="text-center">G</span>
        <span className="text-center">DR</span>
        <span className="text-right">Pti</span>
      </div>
      <div className="space-y-0.5">
        {top.map((row) => (
          <TableRow key={row.club} row={row} own={row.club === config.team} />
        ))}
        {mineOutside ? (
          <>
            <div className="my-1 border-t border-dashed border-border/70" />
            <TableRow row={mine} own />
          </>
        ) : null}
      </div>
    </Panel>
  );
}