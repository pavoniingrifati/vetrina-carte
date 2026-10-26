import React from "react";
import { Star } from "lucide-react";
import { useUniverse } from "@/lib/universe-context";
import Panel from "@/components/common/Panel";
import RoleTag from "@/components/common/RoleTag";

export default function SquadLeadersPanel() {
  const { squad } = useUniverse();
  const leaders = [...squad]
    .filter((p) => p.apps > 0 && (p.fanta != null || p.avgRating != null))
    .sort((a, b) => (b.fanta ?? b.avgRating ?? 0) - (a.fanta ?? a.avgRating ?? 0))
    .slice(0, 5);

  return (
    <Panel title="Rendimento rosa" icon={Star} actionTo="/rosa" actionLabel="Rosa">
      <div className="mb-1 grid grid-cols-[18px_1fr_32px_38px_38px] items-center gap-2 px-1 font-heading text-[9px] uppercase tracking-[0.16em] text-muted-foreground/80">
        <span>#</span>
        <span>Giocatore</span>
        <span className="text-center">PR</span>
        <span className="text-center">Voto</span>
        <span className="text-right">FM</span>
      </div>
      <div className="space-y-0.5">
        {leaders.map((player, index) => (
          <div key={player.id} className="grid grid-cols-[18px_1fr_32px_38px_38px] items-center gap-2 rounded-md px-1 py-1.5 text-[13px] hover:bg-white/[0.03]">
            <span className="font-heading text-[11px] tnum text-muted-foreground">{index + 1}</span>
            <span className="flex min-w-0 items-center gap-1.5">
              <RoleTag role={player.role} className="shrink-0" />
              <span className="truncate">{player.name}</span>
            </span>
            <span className="text-center text-[12px] tnum text-muted-foreground">{player.apps}</span>
            <span className="text-center text-[12px] tnum text-muted-foreground">{player.avgRating != null ? player.avgRating.toFixed(2) : "—"}</span>
            <span className="text-right font-heading text-sm font-semibold tnum text-club">{player.fanta != null ? player.fanta.toFixed(2) : "—"}</span>
          </div>
        ))}
        {!leaders.length ? <p className="py-4 text-center text-sm text-muted-foreground">Nessun dato disponibile.</p> : null}
      </div>
    </Panel>
  );
}