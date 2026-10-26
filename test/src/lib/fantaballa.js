export const UNIVERSES = [
  { key: "fantaballafc", team: "Fantaballa FC", monogram: "FB", tag: "S3", accentHsl: "356 68% 52%", accentHex: "#d7353e" },
  { key: "gothamcity", team: "Gotham City", monogram: "GC", tag: "S2", accentHsl: "259 42% 58%", accentHex: "#6c55b5" },
];

export const ROLE_ORDER = ["P", "D", "C", "A"];

export const ROLE_LABEL = { P: "POR", D: "DIF", C: "CEN", A: "ATT" };

export const ROLE_NAME = { P: "Portieri", D: "Difensori", C: "Centrocampisti", A: "Attaccanti" };

export const ROLE_PILL = {
  P: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  D: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  C: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  A: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export const RESULT_PILL = {
  win: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  draw: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  loss: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export const RESULT_LETTER = { win: "V", draw: "P", loss: "S" };

const BASE = import.meta.env.BASE_URL || "/";

const cache = new Map();

export function loadData(universe, name) {
  const key = `${universe}/${name}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      fetch(`${BASE}data/${key}.json`)
        .then((res) => {
          if (!res.ok) throw new Error(`Impossibile caricare ${name}`);
          return res.json();
        })
        .catch((err) => {
          cache.delete(key);
          throw err;
        })
    );
  }
  return cache.get(key);
}

export function trimClub(value) {
  return String(value || "")
    .replace(/^Futbol Club /, "")
    .replace(/^FC /, "")
    .replace(/^A\.S\. /, "")
    .replace(/^A\.C\. /, "")
    .replace(/^Sport Lisboa e /, "")
    .replace(/ Football Club$/, "")
    .replace(/ Hotspur$/, "")
    .replace(/ Saint-Germain FC$/, " SG");
}

export function monogram(value) {
  const words = String(value || "")
    .replace(/[^A-Za-zÀ-ÿ0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !/^(fc|cf|ac|afc|as|club|de|da|e|ss|ssc|sc)$/i.test(w));
  const short = words.slice(0, 2).map((w) => w[0]).join("");
  return (short || String(value || "?").slice(0, 2)).toUpperCase();
}

export function shortDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export function longDate(iso) {
  if (!iso) return "—";
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return iso;
  return new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(date);
}

export function mediumDate(iso) {
  if (!iso) return "—";
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return iso;
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(date);
}

export function dayDiff(from, to) {
  if (!from || !to) return null;
  const a = Date.parse(`${from}T12:00:00`);
  const b = Date.parse(`${to}T12:00:00`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

export function resultFor(fixture, team) {
  const home = fixture.h === team;
  const goals = home ? fixture.hg : fixture.ag;
  const against = home ? fixture.ag : fixture.hg;
  const kind = goals > against ? "win" : goals === against ? "draw" : "loss";
  return { home, goals, against, kind, opponent: home ? fixture.a : fixture.h };
}

export function teamFixtures(fixtures, team) {
  return fixtures.filter((f) => f.h === team || f.a === team);
}

export function formOf(fixtures, team, size = 5) {
  return teamFixtures(fixtures, team)
    .filter((f) => f.p)
    .sort((a, b) => b.d.localeCompare(a.d))
    .slice(0, size)
    .map((f) => ({ ...resultFor(f, team), date: f.d }));
}

export function seasonLabel(season) {
  if (season == null) return "—";
  return `${season}/${String(Number(season) + 1).slice(-2)}`;
}

export function average(values) {
  const list = values.filter((v) => typeof v === "number" && !Number.isNaN(v));
  if (!list.length) return null;
  return list.reduce((sum, v) => sum + v, 0) / list.length;
}

export function formatAverage(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}