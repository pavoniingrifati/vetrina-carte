// docs/gamepass.js
// UI stile "Battle Pass" (layout simile allo screenshot).
// - Linea progresso con nodi (gpRoad)
// - Cards premio (gpTiersList) con immagini verticali
// - Auto-sblocco: quando raggiungi la soglia crea users/{uid}/gp_claims/{tierId}

import { onUser, login, logout, qs, el, db, auth } from "./common.js";

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const statusBox = qs("#status");
const achGrid = qs("#achGrid");
const reqList = qs("#reqList");
const btnLogin = qs("#btnLogin");
const btnLogout = qs("#btnLogout");
const userInfo = qs("#userInfo");


const achSearch = qs("#achSearch");
const achTypeSel = qs("#achType");
const achStateSel = qs("#achState");
const achClear = qs("#achClear");
const achCount = qs("#achCount");
const gpPointsValue = qs("#gpPointsValue");
const gpNextTitle = qs("#gpNextTitle");
const gpNextReq = qs("#gpNextReq");
const gpNextMissing = qs("#gpNextMissing");
const gpProgressBar = qs("#gpProgressBar");
const gpProgressPct = qs("#gpProgressPct");
const gpRewardText = qs("#gpRewardText");

const gpTiersList = qs("#gpTiersList");
const gpRoad = qs("#gpRoad");
const gpRoadScroll = qs("#gpRoadScroll");

// stats extra (optional)
const statLevel = qs("#statLevel");
const statXP = qs("#statXP");
const statUnlocked = qs("#statUnlocked");
const statTotalTiers = qs("#statTotalTiers");
const statUnlockedPct = qs("#statUnlockedPct");
const statChallenges = qs("#statChallenges");

btnLogin.onclick = () => login().catch(err => alert(err.message));
btnLogout.onclick = () => logout().catch(err => alert(err.message));

function setStatus(msg) { statusBox.textContent = msg; }

function badgeForStatus(s) {
  if (s === "approved") return "✅ approvata";
  if (s === "rejected") return "❌ rifiutata";
  return "⏳ in revisione";
}


/* ---------- Achievement filters ---------- */

let _achAll = [];
let _earnedSet = new Set();
let _reqByAch = new Map();
let _filtersReady = false;

const ORDER_TYPE = { FUT: 1, WWE: 2, F1: 3, LIVE: 4 };

function buildReqByAch(requests) {
  // requests è già ordinato DESC per createdAt
  const m = new Map();
  for (const r of (requests || [])) {
    const id = (r && r.achievementId) ? String(r.achievementId) : "";
    if (!id) continue;
    if (!m.has(id)) m.set(id, String(r.status || "pending"));
  }
  return m;
}

function norm(s) { return (s ?? "").toString().toLowerCase(); }

function debounce(fn, ms = 140) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function setupAchFilters() {
  if (_filtersReady) return;
  if (!achSearch || !achTypeSel || !achStateSel || !achClear) { _filtersReady = true; return; }

  const rerender = debounce(() => applyAchievementFilters(), 140);

  achSearch.addEventListener("input", rerender);
  achTypeSel.addEventListener("change", () => applyAchievementFilters());
  achStateSel.addEventListener("change", () => applyAchievementFilters());
  achClear.addEventListener("click", () => {
    achSearch.value = "";
    achTypeSel.value = "all";
    achStateSel.value = "all";
    applyAchievementFilters();
  });

  _filtersReady = true;
}

function applyAchievementFilters() {
  if (!achGrid) return;

  const q = norm(achSearch?.value || "").trim();
  const typeSel = (achTypeSel?.value || "all").toString().trim().toUpperCase(); // ALL / FUT / WWE / F1 / LIVE
  const stateSel = (achStateSel?.value || "all").toString().trim().toLowerCase(); // all/available/locked/pending/approved/rejected

  const base = (_achAll || []).filter(a => a && a.active !== false);

  let out = base.filter(ach => {
    const title = norm(ach.title || ach.id);
    const desc = norm(ach.desc || "");
    const id = norm(ach.id || "");

    const rawType = (ach.type || ach.category || ach.game || "").toString().trim().toUpperCase();
    const type = (["FUT","WWE","F1","LIVE"].includes(rawType)) ? rawType : "LIVE";

    const missing = prereqMissing(ach, _earnedSet);
    const locked = missing.length > 0;
    const approved = _earnedSet.has(ach.id);
    const reqStatus = _reqByAch.get(ach.id) || null;

    // Search
    if (q && !(title.includes(q) || desc.includes(q) || id.includes(q))) return false;

    // Type
    if (typeSel !== "ALL" && type !== typeSel) return false;

    // State
    if (stateSel !== "all") {
      if (stateSel === "available") {
        // Richiedibile = non locked, non già approvato, e non c'è pending
        if (locked || approved || reqStatus === "pending") return false;
      } else if (stateSel === "locked") {
        if (!locked) return false;
      } else if (stateSel === "approved") {
        if (!approved) return false;
      } else if (stateSel === "pending") {
        if (reqStatus !== "pending") return false;
      } else if (stateSel === "rejected") {
        if (reqStatus !== "rejected") return false;
      }
    }

    return true;
  });

  // Ordina: per type (FUT/WWE/F1/LIVE) e poi per titolo
  out.sort((a, b) => {
    const ta = (a.type || a.category || a.game || "").toString().trim().toUpperCase();
    const tb = (b.type || b.category || b.game || "").toString().trim().toUpperCase();

    const ra = ORDER_TYPE[ta] ?? 99;
    const rb = ORDER_TYPE[tb] ?? 99;
    if (ra !== rb) return ra - rb;

    const aa = (a.title || a.id || "").toString().toLowerCase();
    const bb = (b.title || b.id || "").toString().toLowerCase();
    return aa.localeCompare(bb);
  });

  if (achCount) achCount.textContent = `${out.length} / ${base.length}`;

  renderAchievements(out, _earnedSet, _reqByAch);
}


/* ---------- Achievement type colors (FUT / WWE / F1 / LIVE) ---------- */

function ensureAchTypeStyles() {
  if (document.getElementById("gpAchTypeStyles")) return;

  const style = document.createElement("style");
  style.id = "gpAchTypeStyles";
  style.textContent = `
    /* Type tag */
    #achGrid .typeTag{
      font-size: 11px;
      font-weight: 950;
      letter-spacing: .45px;
      text-transform: uppercase;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.18);
      background: rgba(0,0,0,.18);
      color: rgba(255,255,255,.92);
      white-space: nowrap;
      box-shadow: 0 16px 26px rgba(0,0,0,.35),
                  inset 0 1px 0 rgba(255,255,255,.14);
    }

    /* Card tint + left stripe overrides */
    #achGrid .card.type-fut{
      background:
        radial-gradient(900px 520px at 18% 12%, rgba(34,197,94,.18), transparent 58%),
        radial-gradient(800px 520px at 92% 0%, rgba(16,185,129,.14), transparent 60%),
        linear-gradient(180deg, rgba(255,255,255,.10), rgba(0,0,0,.18));
      border-color: rgba(34,197,94,.22);
    }
    #achGrid .card.type-fut::before{
      background: linear-gradient(180deg, rgba(34,197,94,.95), rgba(16,185,129,.80));
    }
    #achGrid .typeTag.type-fut{ background: rgba(34,197,94,.16); border-color: rgba(34,197,94,.26); }

    #achGrid .card.type-wwe{
      background:
        radial-gradient(900px 520px at 18% 12%, rgba(255,59,48,.18), transparent 58%),
        radial-gradient(800px 520px at 92% 0%, rgba(251,191,36,.14), transparent 60%),
        linear-gradient(180deg, rgba(255,255,255,.10), rgba(0,0,0,.18));
      border-color: rgba(255,59,48,.22);
    }
    #achGrid .card.type-wwe::before{
      background: linear-gradient(180deg, rgba(255,59,48,.95), rgba(251,191,36,.78));
    }
    #achGrid .typeTag.type-wwe{ background: rgba(255,59,48,.16); border-color: rgba(255,59,48,.26); }

    #achGrid .card.type-f1{
      background:
        radial-gradient(900px 520px at 18% 12%, rgba(239,68,68,.18), transparent 58%),
        radial-gradient(800px 520px at 92% 0%, rgba(255,255,255,.08), transparent 60%),
        linear-gradient(180deg, rgba(255,255,255,.10), rgba(0,0,0,.18));
      border-color: rgba(239,68,68,.22);
    }
    #achGrid .card.type-f1::before{
      background: linear-gradient(180deg, rgba(239,68,68,.95), rgba(255,255,255,.26));
    }
    #achGrid .typeTag.type-f1{ background: rgba(239,68,68,.16); border-color: rgba(239,68,68,.26); }

    #achGrid .card.type-live{
      background:
        radial-gradient(900px 520px at 18% 12%, rgba(59,130,246,.18), transparent 58%),
        radial-gradient(800px 520px at 92% 0%, rgba(147,51,234,.14), transparent 60%),
        linear-gradient(180deg, rgba(255,255,255,.10), rgba(0,0,0,.18));
      border-color: rgba(59,130,246,.22);
    }
    #achGrid .card.type-live::before{
      background: linear-gradient(180deg, rgba(59,130,246,.95), rgba(147,51,234,.80));
    }
    #achGrid .typeTag.type-live{ background: rgba(59,130,246,.16); border-color: rgba(59,130,246,.26); }
  `;
  document.head.appendChild(style);
}


/* ---------- Season + Daily bonus (una volta ogni 24h) ---------- */

const DAILY_XP = 100; // <-- cambia qui il bonus giornaliero (deve combaciare con le Rules)

async function getCurrentSeason() {
  try {
    const snap = await getDoc(doc(db, "config", "gamepass"));
    if (!snap.exists()) return 1;
    return Number(snap.data()?.season || 1) || 1;
  } catch {
    return 1;
  }
}

function msToHMS(ms) {
  ms = Math.max(0, ms);
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}

let dailyTicker = null;

function ensureDailyCard() {
  let box = document.querySelector("#dailyCard");
  if (box) return box;

  // Prova a inserirlo sotto la card XP principale, se esiste
  const anchor = document.querySelector(".level-card") || document.querySelector("#status");
  const parent = anchor?.parentElement || document.body;

  box = document.createElement("div");
  box.id = "dailyCard";
  box.className = "level-card";
  box.style.marginTop = "12px";

  box.innerHTML = `
    <div class="level-top">
      <div class="lvl-left">
        <div class="bolt" style="background: linear-gradient(135deg, rgba(251,191,36,.95), rgba(255,43,214,.65)); box-shadow: 0 18px 38px rgba(251,191,36,.14);">
          <span>🎁</span>
        </div>
        <div>
          <div class="lvl-label">Bonus giornaliero</div>
          <div class="lvl-val" style="font-size:20px">+${DAILY_XP} XP</div>
        </div>
      </div>
      <div class="nextbox">
        <div class="lbl">Stato</div>
        <div class="val" id="dailyState">—</div>
      </div>
    </div>

    <div class="sep"></div>

    <div class="row" style="align-items:center; gap:10px; flex-wrap:wrap;">
      <div class="small mono" id="dailyHint">—</div>
      <div style="flex:1"></div>
      <button class="btn primary" id="btnDaily">Riscatta</button>
    </div>
  `;

  if (anchor && anchor.parentElement) {
    anchor.parentElement.insertBefore(box, anchor.nextSibling);
  } else {
    parent.appendChild(box);
  }

  return box;
}

function removeDailyCard() {
  if (dailyTicker) { clearInterval(dailyTicker); dailyTicker = null; }
  const box = document.querySelector("#dailyCard");
  if (box) box.remove();
}

function renderDaily(season, progressData, uid) {
  const box = ensureDailyCard();
  const state = box.querySelector("#dailyState");
  const hint = box.querySelector("#dailyHint");
  const btn = box.querySelector("#btnDaily");

  if (dailyTicker) { clearInterval(dailyTicker); dailyTicker = null; }

  const lastDaily = progressData?.lastDailyAt?.toDate ? progressData.lastDailyAt.toDate() : null;
  const now = new Date();

  let can = true;
  let nextAt = null;

  if (lastDaily instanceof Date && !isNaN(lastDaily.getTime())) {
    nextAt = new Date(lastDaily.getTime() + 24*60*60*1000);
    can = now.getTime() >= nextAt.getTime();
  }

  if (can) {
    state.textContent = "✅ disponibile";
    hint.textContent = "Puoi riscattare ora.";
    btn.disabled = false;
  } else {
    state.textContent = "⏳ in cooldown";
    btn.disabled = true;

    const tick = () => {
      const ms = nextAt.getTime() - Date.now();
      hint.textContent = `Disponibile tra ${msToHMS(ms)}`;
      if (ms <= 0) {
        clearInterval(dailyTicker);
        dailyTicker = null;
        renderDaily(season, progressData, uid);
      }
    };
    tick();
    dailyTicker = setInterval(tick, 1000);
  }

  btn.onclick = async () => {
    if (!auth.currentUser) return alert("Devi fare login.");
    btn.disabled = true;

    try {
      const progRef = doc(db, `users/${uid}/gamepass/progress`);
      const snap = await getDoc(progRef);

      if (!snap.exists() || Number(snap.data()?.season || 0) !== season) {
        // Prima claim della season (o reset soft): set punti = DAILY_XP
        await setDoc(progRef, {
          season,
          points: DAILY_XP,
          lastDailyAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        await updateDoc(progRef, {
          season,
          points: increment(DAILY_XP),
          lastDailyAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      await loadAll(uid); // ricarica UI e aggiorna cooldown
    } catch (e) {
      console.error(e);
      alert(e?.message || "Errore bonus giornaliero");
    }
  };
}


/* ---------- Reward helpers ---------- */

function rewardType(tier){
  const r = tier?.reward || {};
  return (r.type || tier.rewardType || "").toString() || "item";
}

function rewardRarity(tier){
  const r = tier?.reward || {};
  const v = (r.rarity || tier.rarity || "common").toString().toLowerCase();
  if (["common","rare","epic","legendary"].includes(v)) return v;
  return "common";
}

function formatReward(tier) {
  const r = tier?.reward || {};
  if (typeof r.label === "string" && r.label.trim()) return r.label.trim();

  const t = rewardType(tier);
  if (t === "card") {
    const ov = r.overall ?? r.cardOverall;
    if (ov != null) return `Carta overall ${ov}`;
    return "Carta";
  }
  if (t === "skin") return "Nuova skin";
  if (t === "color") return "Nuovo colore";
  return "Premio";
}

function svgDataUrl(svg) {
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function defaultRewardPreview(tier) {
  const r = tier?.reward || {};
  if (typeof r.imgUrl === "string" && r.imgUrl.trim()) return r.imgUrl.trim();

  const label = (formatReward(tier) || "Reward").slice(0, 18);
  const rar = rewardRarity(tier);

  const colors = {
    common: ["#6b7280", "#111827"],
    rare: ["#28d7ff", "#2563eb"],
    epic: ["#ff2bd6", "#7c3aed"],
    legendary: ["#fbbf24", "#ff2bd6"]
  }[rar] || ["#28d7ff", "#7c3aed"];

  const icon = (rewardType(tier) === "card") ? "⭐" :
               (rewardType(tier) === "skin") ? "🧩" :
               (rewardType(tier) === "color") ? "🎨" : "🎁";

  return svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="260" height="340" viewBox="0 0 260 340">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${colors[0]}" stop-opacity="0.95"/>
          <stop offset="1" stop-color="${colors[1]}" stop-opacity="0.95"/>
        </linearGradient>
        <radialGradient id="r" cx="30%" cy="22%" r="80%">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>
          <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
        <filter id="s" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity="0.35"/>
        </filter>
      </defs>

      <rect x="16" y="16" width="228" height="308" rx="26" fill="url(#g)" filter="url(#s)"/>
      <rect x="16" y="16" width="228" height="308" rx="26" fill="url(#r)"/>
      <rect x="24" y="24" width="212" height="292" rx="22" fill="rgba(0,0,0,0.18)" stroke="rgba(255,255,255,0.22)"/>

      <text x="130" y="165" text-anchor="middle"
        font-family="ui-sans-serif,system-ui,Segoe UI,Roboto,Arial"
        font-size="72" fill="rgba(255,255,255,0.82)" font-weight="900">${icon}</text>

      <text x="130" y="306" text-anchor="middle"
        font-family="ui-sans-serif,system-ui,Segoe UI,Roboto,Arial"
        font-size="14" fill="rgba(255,255,255,0.92)" font-weight="800">${label}</text>
    </svg>
  `);
}

/* ---------- Progress + UI ---------- */

function renderProgress(points, tiers) {
  if (gpPointsValue) gpPointsValue.textContent = String(points);
  if (statXP) statXP.textContent = String(points);

  const list = (tiers || [])
    .filter(t => t && typeof t.requiredPoints === "number" && t.requiredPoints > 0 && t.active !== false)
    .sort((a,b) => a.requiredPoints - b.requiredPoints);

  const nextTier = list.find(t => t.requiredPoints > points) || list[list.length - 1];
  if (!nextTier) return;

  const req = Number(nextTier.requiredPoints) || 0;
  const pct = req > 0 ? Math.max(0, Math.min(100, Math.round((points / req) * 100))) : 0;
  const missing = Math.max(0, req - points);

  if (gpNextTitle) gpNextTitle.textContent = nextTier.title || nextTier.id || "Premio";
  if (gpNextReq) gpNextReq.textContent = String(req);
  if (gpNextMissing) gpNextMissing.textContent = String(missing);
  if (gpRewardText) gpRewardText.textContent = formatReward(nextTier);

  if (gpProgressBar) {
    gpProgressBar.max = req > 0 ? req : 100;
    gpProgressBar.value = Math.min(points, gpProgressBar.max);
  }
  if (gpProgressPct) gpProgressPct.textContent = `${pct}%`;

  // Livello "stimato": quanti tiers hai superato (1..N)
  const lvl = list.filter(t => points >= (Number(t.requiredPoints)||0)).length;
  if (statLevel) statLevel.textContent = String(Math.max(1, lvl || 1));
}

/* ---------- Road line (nodes only) ---------- */

function renderRoad(points, tiers) {
  if (!gpRoad) return;

  const list = (tiers || [])
    .filter(t => t && typeof t.requiredPoints === "number" && t.requiredPoints > 0 && t.active !== false)
    .sort((a,b) => a.requiredPoints - b.requiredPoints);

  gpRoad.innerHTML = "";
  if (!list.length) return;

  // Spaziatura: evita sovrapposizioni. (Con scroll se serve)
  const minW = Math.max(820, list.length * 140);
  gpRoad.style.minWidth = `${minW}px`;

  const max = Number(list[list.length - 1].requiredPoints) || 100;
  const fillPct = Math.max(0, Math.min(100, (Number(points || 0) / max) * 100));

  // Barra
  const line = el("div", { class: "roadline" }, [
    el("div", { class: "roadbar" }, [
      el("div", { class: "roadfill", style: `width:${fillPct}%` }, [])
    ])
  ]);

  // Markers (tier numbers) integrati e ben allineati
  const marks = el("div", { class: "roadmarks" }, []);
  const n = list.length;

  list.forEach((t, idx) => {
    const req = Number(t.requiredPoints) || 0;
    const unlocked = Number(points || 0) >= req;

    // Distribuzione uniforme lungo la track (stile Battle Pass)
    const leftPct = (n <= 1) ? 0 : (idx / (n - 1)) * 100;

    // Numero mostrato: di default 1..N (se vuoi 1,10,20..., metti un campo t.displayNumber)
    const num = (t.displayNumber != null) ? String(t.displayNumber) : String(idx + 1);

    const node = el("div", {
      class: `mark ${unlocked ? "unlocked" : ""}`,
      style: `left:${leftPct}%`,
      title: `${num} • soglia: ${req} XP`
    }, [
      el("div", { class: "tag" }, [document.createTextNode(num)]),
      el("div", { class: "req" }, [document.createTextNode(`${req} XP`)]),
      el("div", { class: "stem" }, []),
      el("div", { class: "pin" }, []),
    ]);

    marks.append(node);
  });

  // Cursore (posizione XP)
  const cursor = el("div", { class: "cursor", style: `left:${fillPct}%` }, [
    el("div", { class: "dot" }, [])
  ]);

  gpRoad.append(line, marks, cursor);

  // Auto-scroll verso la posizione dell'utente
  if (gpRoadScroll && gpRoadScroll.scrollWidth > gpRoadScroll.clientWidth) {
    const target = (gpRoad.scrollWidth * (fillPct / 100)) - (gpRoadScroll.clientWidth / 2);
    gpRoadScroll.scrollLeft = Math.max(0, target);
  }
}

/* ---------- Rewards cards ---------- */

function renderTiersCards(points, tiers, claimedSet){
  if (!gpTiersList) return;
  gpTiersList.innerHTML = "";

  const list = (tiers || [])
    .filter(t => t && typeof t.requiredPoints === "number" && t.active !== false)
    .sort((a,b) => a.requiredPoints - b.requiredPoints);

  if (statTotalTiers) statTotalTiers.textContent = String(list.length);

  let unlockedCount = 0;

  list.forEach((t, idx) => {
    const req = Number(t.requiredPoints) || 0;
    const unlocked = points >= req;
    if (unlocked) unlockedCount++;

    const rar = rewardRarity(t);
    const title = formatReward(t);
    const img = defaultRewardPreview(t);

    const card = el("div", { class: `tier-card ${unlocked ? "" : "locked"}` }, [
      el("div", { class: "tier-top" }, [
        el("span", { class: "chip" }, [document.createTextNode(`LV.${idx+1}`)]),
        el("span", { class: `chip ${rar}` }, [document.createTextNode(rar)])
      ]),
      el("div", { class: "tier-imgwrap" }, [
        el("img", { class: "tier-img", src: img, alt: title })
      ]),
      unlocked ? document.createTextNode("") : el("div", { class: "lock" }, [
        el("div", { class: "lk" }, [document.createTextNode("🔒")])
      ]),
      el("div", { class: "tier-title" }, [document.createTextNode(title)]),
      el("div", { class: "tier-foot" }, [
        el("span", {}, [document.createTextNode(`${req} XP`)]),
        el("span", { class: `okdot ${unlocked ? "ok" : ""}` }, [document.createTextNode(unlocked ? "✓" : "•")])
      ])
    ]);

    gpTiersList.append(card);
  });

  if (statUnlocked) statUnlocked.textContent = String(unlockedCount);
  if (statUnlockedPct) {
    const pct = list.length ? Math.round((unlockedCount / list.length) * 100) : 0;
    statUnlockedPct.textContent = `${pct}%`;
  }
}

/* ---------- Auto record unlocked ---------- */

async function autoRecordUnlocked(uid, points, tiers, claimedSet) {
  const list = (tiers || [])
    .filter(t => t && typeof t.requiredPoints === "number" && t.active !== false)
    .sort((a,b) => a.requiredPoints - b.requiredPoints);

  const toCreate = list.filter(t => points >= (Number(t.requiredPoints) || 0) && !claimedSet.has(t.id));
  if (!toCreate.length) return;

  for (const t of toCreate) {
    try {
      await setDoc(doc(db, `users/${uid}/gp_claims/${t.id}`), {
        unlockedAt: serverTimestamp(),
        pointsAtUnlock: points,
        requiredPoints: Number(t.requiredPoints) || 0,
        rewardLabel: formatReward(t)
      }, { merge: true });
      claimedSet.add(t.id);
    } catch (e) {
      console.warn("Auto-claim fallito per tier", t.id, e);
    }
  }
}

/* ---------- Achievements + Requests ---------- */

function prereqMissing(ach, earnedSet) {
  const prereq = ach.prereq || [];
  return prereq.filter(id => !earnedSet.has(id));
}

function renderAchievements(achievements, earnedSet, reqByAch = new Map()) {
  ensureAchTypeStyles();
  achGrid.innerHTML = "";

  if (!achievements || !achievements.length) {
    achGrid.append(el("div", { class: "card small" }, [document.createTextNode("Nessun achievement trovato con questi filtri.")]));
    return;
  }

  for (const ach of achievements) {
    const missing = prereqMissing(ach, earnedSet);
    const locked = missing.length > 0;
    const already = earnedSet.has(ach.id);
    const reqStatus = reqByAch.get(ach.id) || null;
    const pending = (!already && reqStatus === "pending");

    const evidenceText = el("textarea", { placeholder: "Prova (testo) — es: minuto della clip, contesto…" });
    const evidenceUrl = el("input", { placeholder: "Link prova (opzionale)", type: "url" });

    // Achievement "link request": clicchi un link e invii la richiesta ai moderatori (senza punti automatici)
    const linkUrl = (ach.linkUrl || ach.url || ach.link || "").toString().trim();
    const isLinkRequest = (ach.linkRequest === true) && !!linkUrl;
    if (isLinkRequest) {
      // precompila il link (l'utente può comunque aggiungere una nota)
      evidenceUrl.value = linkUrl;
      evidenceUrl.disabled = true;
    }

    const btn = el("button", {
      class: "btn primary",
      onclick: async () => {
        if (!auth.currentUser) return alert("Devi fare login.");
        if (pending) return alert("Hai già una richiesta in revisione per questo achievement.");
        btn.disabled = true;
        try {
          if (isLinkRequest) {
            // Apri il link in una nuova scheda (azione utente -> meno blocchi popup)
            try { window.open(linkUrl, "_blank", "noopener"); } catch {}
          }
          await addDoc(collection(db, "requests"), {
            uid: auth.currentUser.uid,
            requesterEmail: auth.currentUser.email || "",
            requesterName: auth.currentUser.displayName || "",
            achievementId: ach.id,
            achievementTitle: ach.title || ach.id,
            status: "pending",
            evidenceText: evidenceText.value.trim(),
            evidenceUrl: (isLinkRequest ? linkUrl : evidenceUrl.value.trim()),
            createdAt: serverTimestamp(),
            reviewedAt: null,
            reviewedBy: null,
            note: null
          });

          alert("Richiesta inviata!");
          await loadAll(auth.currentUser.uid);
        } catch (e) {
          alert(e?.message || "Errore");
          console.error(e);
        } finally {
          btn.disabled = false;
        }
      }
    }, [document.createTextNode(isLinkRequest ? "Apri link e Richiedi" : "Richiedi")]);

    const state = already
      ? el("span", { class: "badge" }, [document.createTextNode("✅ già approvato")])
      : pending
        ? el("span", { class: "badge" }, [document.createTextNode("⏳ in revisione")])
      : (!already && reqStatus === "rejected")
        ? el("span", { class: "badge" }, [document.createTextNode("❌ rifiutata")])
        : locked
          ? el("span", { class: "badge" }, [document.createTextNode("🔒 bloccato (mancano prereq)")])
          : el("span", { class: "badge" }, [document.createTextNode("🟦 richiedibile")]);

    const pointsText = (ach.points != null) ? `+${ach.points} XP` : "—";

    // Tipo achievement: FUT / WWE / F1 / LIVE (fallback LIVE)
    const rawType = (ach.type || ach.category || ach.game || "").toString().trim().toUpperCase();
    const type = (["FUT","WWE","F1","LIVE"].includes(rawType)) ? rawType : "LIVE";
    const typeCls = `type-${type.toLowerCase()}`;
    const typeTag = el("span", { class: `typeTag ${typeCls}` }, [document.createTextNode(type)]);

    const card = el("div", { class: `card ${typeCls}` }, [
      el("div", { class: "row" }, [
        el("strong", {}, [document.createTextNode(ach.title || ach.id)]),
        el("div", { style: "display:flex; align-items:center; gap:8px;" }, [typeTag, state])
      ]),
      el("div", { class: "small" }, [document.createTextNode(ach.desc || "")]),
      el("div", { class: "sep" }),
      el("div", { class: "small" }, [document.createTextNode(`Punti: ${pointsText}`)]),
      locked ? el("div", { class: "small mono" }, [document.createTextNode(`Prereq mancanti: ${missing.join(", ")}`)]) : document.createTextNode(""),
      el("div", { class: "sep" }),
      already
        ? el("div", { class: "small" }, [document.createTextNode("Questo achievement è già stato approvato.")])
        : pending
          ? el("div", { class: "small" }, [document.createTextNode("Hai già inviato una richiesta per questo achievement. Attendi la revisione.")])
          : el("div", {}, [
            isLinkRequest
              ? el("div", { class: "small" }, [document.createTextNode("Apri il link e invia la richiesta ai moderatori (il link viene allegato automaticamente).")])
              : el("div", { class: "small" }, [document.createTextNode("Inserisci una prova (facoltativa ma consigliata):")]),
            // Nota opzionale (per linkRequest è consigliata)
            el("div", { class: "small", style: "margin-top:8px" }, [
              document.createTextNode(isLinkRequest ? "Nota (opzionale):" : "")
            ]),
            evidenceText,
            el("div", { style: "height:8px" }),
            // Link prova (per linkRequest è precompilato e bloccato)
            evidenceUrl,
            el("div", { style: "height:10px" }),
            locked
              ? el("button", { class: "btn", disabled: "true" }, [document.createTextNode("Non disponibile")])
              : btn
          ])
    ]);

    achGrid.append(card);
  }
}

function renderRequests(requests) {
  reqList.innerHTML = "";
  if (!requests.length) {
    reqList.append(el("div", { class: "card small" }, [document.createTextNode("Nessuna richiesta ancora.")]));
    return;
  }

  for (const r of requests) {
    const card = el("div", { class: "card" }, [
      el("div", { class: "row" }, [
        el("strong", {}, [document.createTextNode(r.achievementTitle || r.achievementId)]),
        el("span", { class: "badge" }, [document.createTextNode(badgeForStatus(r.status))])
      ]),
      r.note
        ? el("div", { class: "small" }, [document.createTextNode(`Nota mod: ${r.note}`)])
        : el("div", { class: "small" }, [document.createTextNode(" ")])
    ]);
    reqList.append(card);
  }
}

/* ---------- Load ---------- */

async function loadAll(uid) {
  setStatus("Carico achievements e stato…");

  const achSnap = await getDocs(collection(db, "achievements"));
  const achievements = achSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(a => a.active !== false);

  const earnedSnap = await getDocs(collection(db, `users/${uid}/earned`));
  const earnedSet = new Set(earnedSnap.docs.map(d => d.id));

  if (statChallenges) statChallenges.textContent = String(earnedSet.size);

  const season = await getCurrentSeason();

  const gpSnap = await getDoc(doc(db, `users/${uid}/gamepass/progress`));
  let gpPoints = 0;
  let gpDataCurrent = null;

  if (gpSnap.exists()) {
    const data = gpSnap.data() || {};
    const s = Number(data.season || 0);
    // Se la season non combacia, per questa pagina i punti sono 0 (reset "soft")
    if (s === season) {
      gpPoints = Number(data.points || 0) || 0;
      gpDataCurrent = data; // include lastDailyAt
    }
  }

  const tiersSnap = await getDocs(collection(db, "gp_tiers"));
  const tiers = tiersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const claimsSnap = await getDocs(collection(db, `users/${uid}/gp_claims`));
  const claimedSet = new Set(claimsSnap.docs.map(d => d.id));

  await autoRecordUnlocked(uid, gpPoints, tiers, claimedSet);

  renderProgress(gpPoints, tiers);
  renderRoad(gpPoints, tiers);
  renderTiersCards(gpPoints, tiers, claimedSet);

  const reqQ = query(
    collection(db, "requests"),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  const reqSnap = await getDocs(reqQ);
  const requests = reqSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  _achAll = achievements;
  _earnedSet = earnedSet;
  _reqByAch = buildReqByAch(requests);
  setupAchFilters();
  applyAchievementFilters();

  renderRequests(requests);

  setStatus(`Ok. Season ${season} • XP: ${gpPoints} • Approvati: ${earnedSet.size} • Richieste: ${requests.length}`);

  // Bonus giornaliero
  renderDaily(season, gpDataCurrent, uid);
}

onUser(async (user) => {
  if (!user) {
    userInfo.textContent = "";
    btnLogin.style.display = "";
    btnLogout.style.display = "none";
    achGrid.innerHTML = "";
    reqList.innerHTML = "";
    _achAll = [];
    _earnedSet = new Set();
    _reqByAch = new Map();
    if (achCount) achCount.textContent = "—";
    if (gpTiersList) gpTiersList.innerHTML = "";
    if (gpRoad) gpRoad.innerHTML = "";
    removeDailyCard();
    setStatus("Fai login per vedere e richiedere achievement.");
    return;
  }

  btnLogin.style.display = "none";
  btnLogout.style.display = "";
  userInfo.textContent = user.email || user.uid;

  await loadAll(user.uid);
});
