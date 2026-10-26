import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useUniverse } from "@/lib/universe-context";
import { ROLE_NAME, ROLE_ORDER, loadData } from "@/lib/fantaballa";
import PageHeader from "@/components/common/PageHeader";
import PageLoading from "@/components/common/PageLoading";
import FilterChips from "@/components/common/FilterChips";
import PlayerList from "@/components/players/PlayerList";
import PlayerSheet from "@/components/players/PlayerSheet";
import { Input } from "@/components/ui/input";

const ROLE_OPTIONS = [{ value: "all", label: "Tutti" }, ...ROLE_ORDER.map((role) => ({ value: role, label: ROLE_NAME[role] }))];

const SORT_OPTIONS = [
  { value: "ca", label: "Valore CA" },
  { value: "fanta", label: "Fantamedia" },
  { value: "avg", label: "Media voto" },
  { value: "goals", label: "Gol" },
  { value: "age", label: "Età" },
  { value: "cost", label: "Costo" },
];

const SORTERS = {
  ca: (a, b) => (b.ca || 0) - (a.ca || 0),
  fanta: (a, b) => (b.fanta ?? -1) - (a.fanta ?? -1),
  avg: (a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1),
  goals: (a, b) => (b.goals || 0) - (a.goals || 0),
  age: (a, b) => (a.age || 0) - (b.age || 0),
  cost: (a, b) => (b.cost || 0) - (a.cost || 0),
};

const PAGE_SIZE = 40;

export default function Players() {
  const { universe, loading, config, meta } = useUniverse();
  const [players, setPlayers] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [club, setClub] = useState("all");
  const [sort, setSort] = useState("ca");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let active = true;
    setFetching(true);
    loadData(universe, "players").then((list) => {
      if (!active) return;
      setPlayers(list);
      setFetching(false);
    });
    return () => {
      active = false;
    };
  }, [universe]);

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [query, role, club, sort]);

  const clubs = useMemo(() => [...new Set(players.map((p) => p.club))].sort((a, b) => a.localeCompare(b)), [players]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return players
      .filter((p) => (role === "all" ? true : p.role === role))
      .filter((p) => (club === "all" ? true : p.club === club))
      .filter((p) => (search ? p.name.toLowerCase().includes(search) : true))
      .sort(SORTERS[sort]);
  }, [players, role, club, query, sort]);

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader
        title="Database giocatori"
        subtitle={`${meta.competition} · ${(players.length || meta.playersCount).toLocaleString("it-IT")} giocatori osservati`}
      />

      <div className="space-y-3 rounded-xl border border-border/80 bg-card/70 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca un giocatore per nome…"
              className="h-9 border-border/80 bg-background/60 pl-8 text-[13px]"
            />
          </div>
          <select
            value={club}
            onChange={(event) => setClub(event.target.value)}
            className="h-9 max-w-full rounded-md border border-border/80 bg-background/60 px-2 text-[12px] text-foreground outline-none focus:ring-1 focus:ring-club sm:w-[190px]"
            aria-label="Filtra per squadra"
          >
            <option value="all">Tutte le squadre</option>
            {clubs.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="h-9 rounded-md border border-border/80 bg-background/60 px-2 font-heading text-[11px] uppercase tracking-wider text-foreground outline-none focus:ring-1 focus:ring-club"
            aria-label="Ordina per"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <FilterChips options={ROLE_OPTIONS} value={role} onChange={setRole} label="Ruolo" />
        <p className="font-heading text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {fetching ? "Caricamento…" : `${filtered.length.toLocaleString("it-IT")} giocatori trovati`}
        </p>
      </div>

      {fetching ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-club" />
        </div>
      ) : (
        <>
          <PlayerList players={filtered.slice(0, limit)} onSelect={setSelected} ownTeam={config.team} />
          {filtered.length > limit ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setLimit((value) => value + PAGE_SIZE)}
                className="rounded-lg border border-border/80 bg-card/80 px-4 py-2 font-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-club/50 hover:text-club"
              >
                Mostra altri {Math.min(PAGE_SIZE, filtered.length - limit)}
              </button>
            </div>
          ) : null}
          {!filtered.length ? <p className="py-10 text-center text-sm text-muted-foreground">Nessun giocatore corrisponde alla ricerca.</p> : null}
        </>
      )}

      <PlayerSheet player={selected} open={!!selected} onOpenChange={(next) => !next && setSelected(null)} />
    </div>
  );
}