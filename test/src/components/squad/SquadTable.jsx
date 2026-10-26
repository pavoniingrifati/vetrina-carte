import React from "react";
import RoleTag from "@/components/common/RoleTag";
import { cn } from "@/lib/utils";

const GRID = "grid-cols-[minmax(0,1fr)_38px_42px_40px_44px_44px_34px_34px]";

function Rating({ value }) {
  return <span className={cn("font-heading tnum", value != null && value >= 7 ? "text-emerald-300" : value != null && value < 6 ? "text-rose-300" : "text-foreground")}>{value != null ? value.toFixed(2) : "—"}</span>;
}

export default function SquadTable({ players, onSelect }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border/80 bg-card/80 md:block">
        <div className={cn("grid items-center gap-2 border-b border-border/70 bg-white/[0.03] px-3 py-2 font-heading text-[9px] uppercase tracking-[0.18em] text-muted-foreground", GRID)}>
          <span>Giocatore</span>
          <span className="text-center">Età</span>
          <span className="text-center">CA</span>
          <span className="text-center">PR</span>
          <span className="text-center">Voto</span>
          <span className="text-center">FM</span>
          <span className="text-center">Gol</span>
          <span className="text-center">Ass</span>
        </div>
        <div>
          {players.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => onSelect(player)}
              className={cn(
                "grid w-full items-center gap-2 border-b border-border/40 px-3 py-2 text-left text-[13px] transition-colors last:border-0 hover:bg-club/10",
                GRID
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <RoleTag role={player.role} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{player.name}</span>
                  <span className="block truncate text-[10px] uppercase tracking-wider text-muted-foreground">{player.positions || player.position}</span>
                </span>
              </span>
              <span className="text-center tnum text-muted-foreground">{player.age}</span>
              <span className="text-center font-heading font-semibold tnum text-foreground">{player.ca}</span>
              <span className="text-center tnum text-muted-foreground">{player.apps}</span>
              <span className="text-center text-[12px]">
                <Rating value={player.avgRating} />
              </span>
              <span className="text-center font-heading font-semibold tnum text-club">{player.fanta != null ? player.fanta.toFixed(2) : "—"}</span>
              <span className="text-center tnum text-muted-foreground">{player.goals}</span>
              <span className="text-center tnum text-muted-foreground">{player.assists}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 md:hidden">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            onClick={() => onSelect(player)}
            className="w-full rounded-xl border border-border/80 bg-card/80 px-3 py-2.5 text-left transition-colors active:bg-club/10"
          >
            <div className="flex items-start gap-2">
              <RoleTag role={player.role} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium leading-tight">{player.name}</p>
                <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                  {player.positions || player.position} · {player.age} anni · CA {player.ca}
                </p>
              </div>
              <div className="text-right">
                <p className="font-heading text-lg font-bold leading-none tnum text-club">{player.fanta != null ? player.fanta.toFixed(2) : "—"}</p>
                <p className="font-heading text-[9px] uppercase tracking-wider text-muted-foreground">Fantamedia</p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1 border-t border-border/50 pt-2 text-center text-[11px]">
              <span className="text-muted-foreground">
                <b className="block font-heading text-sm text-foreground tnum">{player.apps}</b>PRES
              </span>
              <span className="text-muted-foreground">
                <b className="block font-heading text-sm text-foreground tnum">{player.avgRating != null ? player.avgRating.toFixed(2) : "—"}</b>VOTO
              </span>
              <span className="text-muted-foreground">
                <b className="block font-heading text-sm text-foreground tnum">{player.goals}</b>GOL
              </span>
              <span className="text-muted-foreground">
                <b className="block font-heading text-sm text-foreground tnum">{player.assists}</b>ASS
              </span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}