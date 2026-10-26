import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { UNIVERSES, loadData } from "@/lib/fantaballa";

const UniverseContext = createContext(null);

const DATA_FILES = ["meta", "clubs", "standings", "fixtures", "squad", "leaders"];

export function UniverseProvider({ children }) {
  const [universe, setUniverse] = useState(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("fanta.universe") : null;
    return UNIVERSES.some((u) => u.key === saved) ? saved : UNIVERSES[0].key;
  });
  const [data, setData] = useState(null);

  useEffect(() => {
    const config = UNIVERSES.find((u) => u.key === universe) || UNIVERSES[0];
    document.documentElement.style.setProperty("--club", config.accentHsl);
    try {
      localStorage.setItem("fanta.universe", universe);
    } catch {
      /* storage non disponibile */
    }

    let active = true;
    setData(null);
    Promise.all(DATA_FILES.map((name) => loadData(universe, name))).then(([meta, clubs, standings, fixtures, squad, leaders]) => {
      if (!active) return;
      setData({
        meta,
        clubs,
        clubsMap: new Map(clubs.map((club) => [club.name, club])),
        standings,
        fixtures,
        squad,
        leaders,
      });
    });

    return () => {
      active = false;
    };
  }, [universe]);

  const value = useMemo(() => {
    const config = UNIVERSES.find((u) => u.key === universe) || UNIVERSES[0];
    return {
      universe,
      setUniverse,
      config,
      loading: !data,
      ...(data || {}),
    };
  }, [universe, data]);

  return <UniverseContext.Provider value={value}>{children}</UniverseContext.Provider>;
}

export function useUniverse() {
  const context = useContext(UniverseContext);
  if (!context) throw new Error("useUniverse deve essere usato dentro UniverseProvider");
  return context;
}