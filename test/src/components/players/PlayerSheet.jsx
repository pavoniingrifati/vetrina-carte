import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useUniverse } from "@/lib/universe-context";
import { skillGroups, skillTone } from "@/lib/skills";
import { mediumDate } from "@/lib/fantaballa";
import ClubCrest from "@/components/common/ClubCrest";
import RoleTag from "@/components/common/RoleTag";
import { cn } from "@/lib/utils";

function Stat({ label, value, accent = false }) {
  return (
    <div className="rounded-lg border border-border/70 bg-white/[0.02] px-2.5 py-2">
      <p className="font-heading text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-heading text-lg font-bold leading-none tnum", accent ? "text-club" : "text-foreground")}>{value}</p>
    </div>
  );
}

function Bar({ item }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[92px] shrink-0 truncate text-[11px] text-muted-foreground">{item.label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
        <span className={cn("block h-full rounded-full", skillTone(item.value))} style={{ width: `${Math.min(100, (item.value / 20) * 100)}%` }} />
      </span>
      <span className="w-5 shrink-0 text-right font-heading text-[11px] font-semibold tnum text-foreground">{item.value}</span>
    </div>
  );
}

export default function PlayerSheet({ player, open, onOpenChange }) {
  const { clubsMap, config } = useUniverse();
  const club = player ? clubsMap?.get(player.club) : null;
  const groups = player ? skillGroups(player.skills, player.role) : [];
  const scores = player?.scores ? Object.entries(player.scores) : [];
  const strongFoot = player?.profile
    ? (player.profile.rightFoot || 0) >= (player.profile.leftFoot || 0)
      ? `Destro (${player.profile.rightFoot ?? "—"})`
      : `Sinistro (${player.profile.leftFoot ?? "—"})`
    : "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto border-border/80 bg-card p-0 sm:max-w-md">
        {player ? (
          <div>
            <div className="relative border-b border-border/70 px-4 pb-4 pt-5">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{ background: "radial-gradient(circle at 0% 0%, hsl(var(--club) / 0.28), transparent 62%)" }}
              />
              <div className="relative flex items-start gap-3">
                <ClubCrest name={player.club} colors={club?.colors} size={46} />
                <div className="min-w-0 flex-1 pr-6">
                  <SheetHeader className="p-0 text-left">
                    <SheetTitle className="truncate font-heading text-xl font-bold uppercase tracking-wide">{player.name}</SheetTitle>
                  </SheetHeader>
                  <p className="mt-0.5 truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                    {player.club === config.team ? "La tua squadra" : player.club}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <RoleTag role={player.role} />
                    <span className="rounded border border-border/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{player.position}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{player.age} anni</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="CA" value={player.ca ?? "—"} accent />
                <Stat label="Presenze" value={player.apps ?? 0} />
                <Stat label="Minuti" value={player.minutes ?? 0} />
                <Stat label="Media voto" value={player.avgRating != null ? player.avgRating.toFixed(2) : "—"} />
                <Stat label="Fantamedia" value={player.fanta != null ? player.fanta.toFixed(2) : "—"} accent />
                <Stat label="Costo" value={player.cost ?? "—"} />
              </div>

              <div className="grid grid-cols-4 gap-2">
                <Stat label="Gol" value={player.goals ?? 0} />
                <Stat label="Assist" value={player.assists ?? 0} />
                <Stat label="Amm." value={player.yellow ?? 0} />
                <Stat label="Esp." value={player.red ?? 0} />
              </div>

              {scores.length ? (
                <div>
                  <p className="mb-2 font-heading text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Profilo migliore · {player.best || "—"}</p>
                  <div className="space-y-1.5">
                    {scores.map(([key, value]) => (
                      <Bar key={key} item={{ label: key, value: Math.round(value) }} />
                    ))}
                  </div>
                </div>
              ) : null}

              {groups.length ? (
                <div className="space-y-3">
                  {groups.map((group) => (
                    <div key={group.label}>
                      <p className="mb-1.5 font-heading text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{group.label}</p>
                      <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                        {group.items.map((item) => (
                          <Bar key={item.key} item={item} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-border/70 px-3 py-3 text-center text-[11px] text-muted-foreground">
                  Scheda tecnica dettagliata disponibile per i giocatori della rosa.
                </p>
              )}

              <div className="rounded-lg border border-border/70 bg-white/[0.02] px-3 py-2.5 text-[11px]">
                <p className="mb-1.5 font-heading text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Anagrafica</p>
                <dl className="space-y-1">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Nome completo</dt>
                    <dd className="truncate text-right text-foreground">{player.profile?.fullName || player.name}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Nascita</dt>
                    <dd className="text-right text-foreground">{player.profile?.birthDate ? mediumDate(player.profile.birthDate) + " " + player.profile.birthDate.slice(0, 4) : "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Piede</dt>
                    <dd className="text-right text-foreground">{strongFoot}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Ruoli naturali</dt>
                    <dd className="text-right text-foreground">{(player.profile?.natural || []).join(", ") || player.positions || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Contratto</dt>
                    <dd className="text-right text-foreground">{player.profile?.contractEnd || "—"}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <SheetHeader>
              <SheetTitle>Giocatore</SheetTitle>
            </SheetHeader>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}