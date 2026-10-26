import React from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ArrowRight, MapPin } from "lucide-react";
import { useUniverse } from "@/lib/universe-context";
import { dayDiff, longDate, teamFixtures, trimClub } from "@/lib/fantaballa";
import ClubCrest from "@/components/common/ClubCrest";
import { cn } from "@/lib/utils";

function TeamBlock({ name, colors, own, side }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <ClubCrest name={name} colors={colors} size={54} className={cn(own && "ring-2 ring-club/70")} />
      <p className={cn("line-clamp-2 font-heading text-[15px] font-semibold uppercase leading-tight tracking-wide", own ? "text-foreground" : "text-muted-foreground")}>
        {trimClub(name)}
      </p>
      <span className={cn("font-heading text-[9px] uppercase tracking-[0.24em]", own ? "text-club" : "text-muted-foreground/70")}>
        {own ? "La tua squadra" : side}
      </span>
    </div>
  );
}

export default function NextMatchPanel() {
  const { meta, fixtures, config, clubsMap } = useUniverse();
  const upcoming = teamFixtures(fixtures, config.team)
    .filter((f) => !f.p)
    .sort((a, b) => a.d.localeCompare(b.d));
  const next = upcoming[0];

  return (
    <section className="relative overflow-hidden rounded-xl border border-border/80 bg-card">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 12% -30%, hsl(var(--club) / 0.5), transparent 58%), radial-gradient(circle at 92% 130%, hsl(199 70% 50% / 0.18), transparent 55%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16 opacity-[0.16]"
        style={{ backgroundImage: "repeating-linear-gradient(90deg, hsl(var(--foreground)) 0 2px, transparent 2px 46px)" }}
      />

      <div className="relative p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-club/40 bg-club/15 px-2.5 py-1">
            <CalendarDays className="h-3.5 w-3.5 text-club" />
            <span className="font-heading text-[10px] font-semibold uppercase tracking-[0.22em] text-club">
              {upcoming.length ? "Prossima partita" : "Stagione conclusa"}
            </span>
          </div>
          {next ? (
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <span>{next.r != null ? `Giornata ${next.r + 1}` : "Campionato"}</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
              <span>{longDate(next.d)}</span>
            </div>
          ) : null}
        </div>

        {next ? (
          <>
            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <TeamBlock name={next.h} colors={clubsMap.get(next.h)?.colors} own={next.h === config.team} side="Casa" />
              <div className="flex flex-col items-center">
                <span className="font-heading text-2xl font-bold tracking-[0.1em] text-muted-foreground/70 sm:text-3xl">VS</span>
                <span className="mt-1 rounded border border-border/80 bg-background/60 px-1.5 py-0.5 font-heading text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  {next.h === config.team ? "In casa" : "Trasferta"}
                </span>
              </div>
              <TeamBlock name={next.a} colors={clubsMap.get(next.a)?.colors} own={next.a === config.team} side="Trasferta" />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {next.h === config.team ? trimClub(next.h) : trimClub(next.a)}
                </span>
                <span className="hidden h-1 w-1 rounded-full bg-muted-foreground/50 sm:block" />
                <span className="hidden sm:block">
                  {(() => {
                    const days = dayDiff(meta?.saveDate, next.d);
                    if (days == null) return "Data da definire";
                    if (days === 0) return "Si gioca oggi (nel salvataggio)";
                    if (days > 0) return `Tra ${days} ${days === 1 ? "giorno" : "giorni"} nel salvataggio`;
                    return "In attesa di aggiornamento";
                  })()}
                </span>
              </div>
              <Link
                to="/calendario"
                className="inline-flex items-center gap-1.5 rounded-lg bg-club px-3 py-1.5 font-heading text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-foreground transition-opacity hover:opacity-90"
              >
                Calendario
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </>
        ) : (
          <div className="py-8 text-center">
            <p className="font-heading text-lg uppercase tracking-widest text-foreground">Calendario terminato</p>
            <p className="mt-1 text-sm text-muted-foreground">Nessuna partita da giocare in questo salvataggio.</p>
            <Link to="/calendario" className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-club">
              Vedi tutti i risultati <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}