import React from "react";
import { Target } from "lucide-react";
import { useUniverse } from "@/lib/universe-context";
import { trimClub } from "@/lib/fantaballa";
import Panel from "@/components/common/Panel";
import RoleTag from "@/components/common/RoleTag";

export default function ScorersPanel() {
  const { leaders, config } = useUniverse();
  const scorers = (leaders?.scorers || []).slice(0, 6);

  return (
    <Panel title="Marcatori" icon={Target} actionTo="/giocatori" actionLabel="Scout">
      <div className="space-y-0.5">
        {scorers.map((player, index) => {
          const own = player.club === config.team;
          return (
            <div key={`${player.name}-${player.club}`} className="flex items-center gap-2 rounded-md px-1 py-1.5 text-[13px] hover:bg-white/[0.03]">
              <span className="w-4 shrink-0 font-heading text-[11px] tnum text-muted-foreground">{index + 1}</span>
              <RoleTag role={player.role} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className={own ? "block truncate font-semibold text-foreground" : "block truncate text-foreground/90"}>{player.name}</span>
                <span className="block truncate text-[10px] uppercase tracking-wider text-muted-foreground">{trimClub(player.club)}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="font-heading text-lg font-bold leading-none tnum">{player.goals}</span>
                <span className="block font-heading text-[9px] uppercase tracking-wider text-muted-foreground">gol</span>
              </span>
            </div>
          );
        })}
        {!scorers.length ? <p className="py-4 text-center text-sm text-muted-foreground">Nessun dato disponibile.</p> : null}
      </div>
    </Panel>
  );
}