import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useUniverse } from "@/lib/universe-context";
import { ROLE_NAME, ROLE_ORDER, average, formatAverage } from "@/lib/fantaballa";
import PageHeader from "@/components/common/PageHeader";
import FilterChips from "@/components/common/FilterChips";
import PageLoading from "@/components/common/PageLoading";
import SquadTable from "@/components/squad/SquadTable";
import PlayerSheet from "@/components/players/PlayerSheet";
import { Input } from "@/components/ui/input";

const GROUP_OPTIONS = [
  { value: "all", label: "Tutti" },
  { value: "Prima squadra", label: "Prima squadra" },
  { value: "Riserve / giovanili", label: "Riserve" },
];

const ROLE_OPTIONS = [{ value: "all", label: "Tutti" }, ...ROLE_ORDER.map((role) => ({ value: role, label: ROLE_NAME[role] }))];

const SORT_OPTIONS = [
  { value: "ca", label: "Valore CA" },
  { value: "fanta", label: "Fantamedia" },
  { value: "apps", label: "Presenze" },
  { value: "goals", label: "Gol" },
  { value: "age", label: "Età" },
  { value: "name", label: "Nome" },
];

const SORTERS = {
  ca: (a, b) => (b.ca || 0) - (a.ca || 0),
  fanta: (a, b) => (b.fanta ?? -1) - (a.fanta ?? -1),
  apps: (a, b) => (b.apps || 0) - (a.apps || 0),
  goals: (a, b) => (b.goals || 0) - (a.goals || 0),
  age: (a, b) => (a.age || 0) - (b.age || 0),
  name: (a, b) => a.name.localeCompare(b.name),
};

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/70 px-3 py-2">
      <p className="font-heading text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="font-heading text-lg font-bold leading-none tnum">{value}</p>
    </div>
  );
}

export default function Squad() {
  const { loading, squad, meta, config } = useUniverse();
  const [group, setGroup] = useState("all");
  const [role, setRole] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("ca");
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    if (!squad) return [];
    const search = query.trim().toLowerCase();
    return squad
      .filter((player) => (group === "all" ? true : player.group === group))
      .filter((player) => (role === "all" ? true : player.role === role))
      .filter((player) => (search ? player.name.toLowerCase().includes(search) : true))
      .sort(SORTERS[sort]);
  }, [squad, group, role, query, sort]);

  if (loading) return <PageLoading />;

  const firstTeam = squad.filter((p) => p.group === "Prima squadra").length;
  const avgAge = average(squad.map((p) => p.age));
  const avgCa = average(squad.map((p) => p.ca));
  const avgFanta = average(squad.filter((p) => p.apps > 0).map((p) => p.fanta));

  return (
    <div className="space-y-3 sm:space-y-4">
      <PageHeader title="Rosa" subtitle={`${config.team} · ${meta.competition} · ${meta.playersCount.toLocaleString("it-IT")} giocatori nel database`} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Tesserati" value={squad.length} />
        <MiniStat label="Prima squadra" value={firstTeam} />
        <MiniStat label="Età media" value={formatAverage(avgAge, 1)} />
        <MiniStat label="Fantamedia media" value={formatAverage(avgFanta)} />
      </div>

      <div className="space-y-3 rounded-xl border border-border/80 bg-card/70 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca giocatore…"
              className="h-9 border-border/80 bg-background/60 pl-8 text-[13px]"
            />
          </div>
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
        <FilterChips options={GROUP_OPTIONS} value={group} onChange={setGroup} label="Reparto di appartenenza" />
        <FilterChips options={ROLE_OPTIONS} value={role} onChange={setRole} label="Ruolo" />
        <p className="font-heading text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {filtered.length} giocatori · {formatAverage(avgCa, 0)} CA media rosa
        </p>
      </div>

      <SquadTable players={filtered} onSelect={setSelected} />
      {!filtered.length ? <p className="py-8 text-center text-sm text-muted-foreground">Nessun giocatore con questi filtri.</p> : null}

      <PlayerSheet player={selected} open={!!selected} onOpenChange={(next) => !next && setSelected(null)} />
    </div>
  );
}