import React from "react";
import { useUniverse } from "@/lib/universe-context";
import { formOf } from "@/lib/fantaballa";
import FormPills from "@/components/common/FormPills";
import { cn } from "@/lib/utils";

function Tile({ label, value, note, accent = false, className, children }) {
  return (
    <div className={cn("rounded-xl border border-border/80 bg-card/70 px-3 py-2.5", accent && "border-club/40 bg-club/10", className)}>
      <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      {children || <p className="mt-1 font-heading text-2xl font-bold leading-none tnum">{value}</p>}
      {note ? <p className="mt-1 truncate text-[10px] uppercase tracking-wider text-muted-foreground">{note}</p> : null}
    </div>
  );
}

export default function StatStrip() {
  const { standings, fixtures, config } = useUniverse();
  const row = standings.find((r) => r.club === config.team) || {};
  const form = formOf(fixtures, config.team, 5);
  const diff = (row.gf || 0) - (row.ga || 0);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      <Tile label="Posizione" value={`${row.position ?? "—"}°`} note={`su ${standings.length} club`} accent />
      <Tile label="Punti" value={row.points ?? "—"} note={`${row.played ?? 0} partite giocate`} />
      <Tile label="Bilancio" value={`${row.won ?? 0}-${row.drawn ?? 0}-${row.lost ?? 0}`} note="vittorie · pareggi · sconfitte" />
      <Tile label="Reti" value={`${row.gf ?? 0}:${row.ga ?? 0}`} note={`differenza ${diff > 0 ? "+" : ""}${diff}`} />
      <Tile label="Ultime 5" className="col-span-2 sm:col-span-1" note={form.length ? "dalla più recente" : "nessuna gara"}>
        <div className="mt-1.5">
          <FormPills form={form} />
        </div>
      </Tile>
    </div>
  );
}