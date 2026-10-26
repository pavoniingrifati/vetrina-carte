import React from "react";
import RoleTag from "@/components/common/RoleTag";
import { trimClub } from "@/lib/fantaballa";
import { cn } from "@/lib/utils";

const GRID = "grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_44px_38px_40px_40px_40px_34px]";

export default function PlayerList({ players, onSelect, ownTeam }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border/80 bg-card/80 md:block">
        <div className={cn("grid items-center gap-2 border-b border-border/70 bg-white/[0.03] px-3 py-2 font-heading text-[9px] uppercase tracking-[0.18em] text-muted-foreground", GRID)}>
          <span>Giocatore</span>
          <span>Squadra</span>
          <span className="text-center">Età</span>
          <span className="text-center">CA</span>
          <span className="text-center">PR</span>
          <span className="text-center">Voto</span>
          <span className="text-center">FM</span>
          <span className="text-center">Gol</span>
        </div>
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
                <span className="block truncate text-[10px] uppercase tracking-wider text-muted-foreground">{player.position}</span>
              </span>
            </span>
            <span className={cn("truncate", player.club === ownTeam ? "text-club" : "text-muted-foreground")}>{trimClub(player.club)}</span>
            <span className="text-center tnum text-muted-foreground">{player.age}</span>
            <span className="text-center font-heading font-semibold tnum">{player.ca}</span>
            <span className="text-center tnum text-muted-foreground">{player.apps}</span>
            <span className="text-center tnum text-muted-foreground">{player.avgRating != null ? player.avgRating.toFixed(2) : "—"}</span>
            <span className="text-center font-heading font-semibold tnum text-club">{player.fanta != null ? player.fanta.toFixed(2) : "—"}</span>
            <span className="text-center tnum text-muted-foreground">{player.goals}</span>
          </button>
        ))}
      </div>

      <div className="space-y-2 md:hidden">
        {players.map((player) => (
          <button
            key={player.id}
            type="button"
            onClick={() => onSelect(player)}
            className="w-full rounded-xl border border-border/80 bg-card/80 px-3 py-2.5 text-left active:bg-club/10"
          >
            <div className="flex items-start gap-2">
              <RoleTag role={player.role} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium leading-tight">{player.name}</p>
                <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                  {trimClub(player.club)} · {player.age} anni
                </p>
              </div>
              <div className="text-right">
                <p className="font-heading text-lg font-bold leading-none tnum text-club">{player.fanta != null ? player.fanta.toFixed(2) : "—"}</p>
                <p className="font-heading text-[9px] uppercase tracking-wider text-muted-foreground">FM</p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1 border-t border-border/50 pt-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>CA <b className="block font-heading text-[13px] text-foreground tnum">{player.ca}</b></span>
              <span>PR <b className="block font-heading text-[13px] text-foreground tnum">{player.apps}</b></span>
              <span>Voto <b className="block font-heading text-[13px] text-foreground tnum">{player.avgRating != null ? player.avgRating.toFixed(2) : "—"}</b></span>
              <span>Gol <b className="block font-heading text-[13px] text-foreground tnum">{player.goals}</b></span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}