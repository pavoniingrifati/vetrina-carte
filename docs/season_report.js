// docs/season_report.js
// Report stagione per moderatori: legge season, tiers e progress di tutti gli utenti (collectionGroup)
// e permette export CSV.

import { onUser, login, logout, qs, el, db, auth } from "./common.js";

import {
  doc,
  getDoc,
  getDocs,
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const statusBox = qs("#status");
const btnLogin = qs("#btnLogin");
const btnLogout = qs("#btnLogout");
const btnReload = qs("#btnReload");
const btnCSV = qs("#btnCSV");
const userInfo = qs("#userInfo");
const tbody = qs("#tbody");
const qInput = qs("#q");
const hint = qs("#hint");

const statSeason = qs("#statSeason");
const statPlayers = qs("#statPlayers");
const statMaxXP = qs("#statMaxXP");
const statMaxTier = qs("#statMaxTier");
const statTotalTiers = qs("#statTotalTiers");

btnLogin.onclick = () => login().catch(err => alert(err.message));
btnLogout.onclick = () => logout().catch(err => alert(err.message));

function setStatus(msg) { statusBox.textContent = msg; }

async function checkModerator(uid) {
  const modSnap = await getDoc(doc(db, "moderators", uid));
  return modSnap.exists();
}

async function getCurrentSeason() {
  try {
    const cfg = await getDoc(doc(db, "config", "gamepass"));
    const s = cfg.exists() ? Number(cfg.data()?.season || 1) : 1;
    return Number.isFinite(s) && s > 0 ? s : 1;
  } catch {
    return 1;
  }
}

function computeTier(points, tiersSorted) {
  let tier = 0;
  for (const t of tiersSorted) {
    const req = Number(t.requiredPoints) || 0;
    if (req > 0 && points >= req) tier++;
  }
  return tier;
}

function nextThreshold(points, tiersSorted) {
  for (const t of tiersSorted) {
    const req = Number(t.requiredPoints) || 0;
    if (req > points) return req;
  }
  return null;
}

function chipFor(points, maxReq) {
  if (!maxReq) return { text: "—", cls: "chip low" };
  const pct = Math.max(0, Math.min(100, Math.round((points / maxReq) * 100)));
  if (pct >= 100) return { text: "COMPLETATO", cls: "chip good" };
  if (pct >= 60) return { text: "IN CORSA", cls: "chip mid" };
  return { text: "START", cls: "chip low" };
}

let rowsAll = [];
let tiersSorted = [];

function renderTable(list) {
  tbody.innerHTML = "";
  if (!list.length) {
    tbody.append(el("tr", {}, [
      el("td", { colspan: "8", class: "muted" }, [document.createTextNode("Nessun dato da mostrare.")])
    ]));
    return;
  }

  const maxReq = tiersSorted.length ? Number(tiersSorted[tiersSorted.length - 1].requiredPoints) : 0;

  list.forEach((r, idx) => {
    const tier = computeTier(r.points, tiersSorted);
    const nextReq = nextThreshold(r.points, tiersSorted);
    const st = chipFor(r.points, maxReq);

    tbody.append(el("tr", {}, [
      el("td", {}, [document.createTextNode(String(idx + 1))]),
      el("td", {}, [document.createTextNode(r.name || "—")]),
      el("td", {}, [document.createTextNode(r.email || "—")]),
      el("td", { class: "mono" }, [document.createTextNode(r.uid)]),
      el("td", {}, [document.createTextNode(String(r.points))]),
      el("td", {}, [document.createTextNode(`${tier}/${tiersSorted.length}`)]),
      el("td", {}, [document.createTextNode(nextReq ? String(nextReq) : "—")]),
      el("td", {}, [el("span", { class: st.cls }, [document.createTextNode(st.text)])]),
    ]));
  });

  statPlayers.textContent = String(list.length);
  statMaxXP.textContent = String(list[0]?.points || 0);
  statMaxTier.textContent = String(computeTier(list[0]?.points || 0, tiersSorted));
  statTotalTiers.textContent = String(tiersSorted.length);
}

function applyFilter() {
  const term = (qInput.value || "").trim().toLowerCase();
  if (!term) {
    renderTable(rowsAll);
    hint.textContent = `${rowsAll.length} righe`;
    return;
  }
  const filtered = rowsAll.filter(r =>
    (r.uid || "").toLowerCase().includes(term) ||
    (r.email || "").toLowerCase().includes(term) ||
    (r.name || "").toLowerCase().includes(term)
  );
  renderTable(filtered);
  hint.textContent = `${filtered.length}/${rowsAll.length}`;
}

qInput.addEventListener("input", applyFilter);

btnReload.onclick = () => auth.currentUser && loadReport();

btnCSV.onclick = () => {
  if (!rowsAll.length) return alert("Nessun dato.");
  const header = ["rank","name","email","uid","points","tier","totalTiers"];
  const lines = [header.join(",")];

  rowsAll.forEach((r, idx) => {
    const tier = computeTier(r.points, tiersSorted);
    const cols = [
      idx + 1,
      (r.name || "").replaceAll('"','""'),
      (r.email || "").replaceAll('"','""'),
      r.uid,
      r.points,
      tier,
      tiersSorted.length
    ];
    lines.push(cols.map(v => (typeof v === "string" ? `"${v}"` : v)).join(","));
  });

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "season_report.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

async function loadReport() {
  setStatus("Carico season, tiers e progress utenti…");

  const season = await getCurrentSeason();
  statSeason.textContent = String(season);

  const tiersSnap = await getDocs(collection(db, "gp_tiers"));
  tiersSorted = tiersSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(t => t && typeof t.requiredPoints === "number" && t.active !== false)
    .sort((a,b) => a.requiredPoints - b.requiredPoints);

  let snap;
  try {
    const q = query(
      collectionGroup(db, "gamepass"),
      where("season", "==", season),
      orderBy("points", "desc"),
      limit(2000)
    );
    snap = await getDocs(q);
  } catch (e) {
    console.error(e);
    setStatus("Errore nel caricare progress. Se vedi un errore 'index', crea l'indice richiesto in Firestore.");
    return;
  }

  rowsAll = snap.docs
    .filter(d => d.id === "progress")
    .map(d => {
      const seg = d.ref.path.split("/");
      const uid = seg[1] || "";
      const data = d.data() || {};
      return {
        uid,
        points: Number(data.points || 0) || 0,
        name: data.name || data.displayName || "",
        email: data.email || ""
      };
    });

  rowsAll.sort((a,b) => b.points - a.points);

  hint.textContent = `${rowsAll.length} righe`;
  renderTable(rowsAll);
  setStatus(`Ok. Season ${season} • Utenti: ${rowsAll.length} • Tiers: ${tiersSorted.length}`);
}

onUser(async (user) => {
  if (!user) {
    userInfo.textContent = "";
    btnLogin.style.display = "";
    btnLogout.style.display = "none";
    tbody.innerHTML = '<tr><td colspan="8" class="muted">Fai login (moderatore).</td></tr>';
    setStatus("Fai login. Serve essere presente in /moderators/{uid}.");
    return;
  }

  btnLogin.style.display = "none";
  btnLogout.style.display = "";
  userInfo.textContent = user.email || user.uid;

  const ok = await checkModerator(user.uid);
  if (!ok) {
    tbody.innerHTML = '<tr><td colspan="8" class="muted">Non autorizzato: non sei in /moderators/{uid}.</td></tr>';
    setStatus("Non autorizzato: non sei in /moderators/{tuoUID}.");
    return;
  }

  await loadReport();
});
