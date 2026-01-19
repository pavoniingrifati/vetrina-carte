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
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const statusBox = qs("#status");
const achGrid = qs("#achGrid");
const reqList = qs("#reqList");
const btnLogin = qs("#btnLogin");
const btnLogout = qs("#btnLogout");
const userInfo = qs("#userInfo");

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

  const max = Number(list[list.length - 1].requiredPoints) || 100;
  const fillPct = Math.max(0, Math.min(100, Math.round((points / max) * 100)));

  // larghezza per scroll
  const px = Math.max(820, list.length * 150);
  gpRoad.style.width = px + "px";

  const line = el("div", { class: "roadline" }, [
    el("div", { class: "roadfill", style: `width:${fillPct}%` }, [])
  ]);

  const nodes = el("div", { class: "roadnodes" }, []);
  list.forEach((t, idx) => {
    const req = Number(t.requiredPoints) || 0;
    const unlocked = points >= req;
    const label = formatReward(t);
    nodes.append(el("div", { class: "node" }, [
      el("div", { class: `bubble ${unlocked ? "unlocked" : ""}` }, [document.createTextNode(String(idx + 1))]),
      el("div", { class: "lab" }, [document.createTextNode(label)]),
    ]));
  });

  const cursor = el("div", { class: "cursor", style: `left:${fillPct}%` }, [
    el("div", { class: "dot" }, [])
  ]);

  gpRoad.append(line, nodes, cursor);

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

function renderAchievements(achievements, earnedSet) {
  achGrid.innerHTML = "";

  for (const ach of achievements) {
    const missing = prereqMissing(ach, earnedSet);
    const locked = missing.length > 0;
    const already = earnedSet.has(ach.id);

    const evidenceText = el("textarea", { placeholder: "Prova (testo) — es: minuto della clip, contesto…" });
    const evidenceUrl = el("input", { placeholder: "Link prova (opzionale)", type: "url" });

    const btn = el("button", {
      class: "btn primary",
      onclick: async () => {
        if (!auth.currentUser) return alert("Devi fare login.");
        btn.disabled = true;
        try {
          await addDoc(collection(db, "requests"), {
            uid: auth.currentUser.uid,
            requesterEmail: auth.currentUser.email || "",
            requesterName: auth.currentUser.displayName || "",
            achievementId: ach.id,
            achievementTitle: ach.title || ach.id,
            status: "pending",
            evidenceText: evidenceText.value.trim(),
            evidenceUrl: evidenceUrl.value.trim(),
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
    }, [document.createTextNode("Richiedi")]);

    const state = already
      ? el("span", { class: "badge" }, [document.createTextNode("✅ già approvato")])
      : locked
        ? el("span", { class: "badge" }, [document.createTextNode("🔒 bloccato (mancano prereq)")])
        : el("span", { class: "badge" }, [document.createTextNode("🟦 richiedibile")]);

    const pointsText = (ach.points != null) ? `+${ach.points} XP` : "—";

    const card = el("div", { class: "card" }, [
      el("div", { class: "row" }, [
        el("strong", {}, [document.createTextNode(ach.title || ach.id)]),
        state
      ]),
      el("div", { class: "small" }, [document.createTextNode(ach.desc || "")]),
      el("div", { class: "sep" }),
      el("div", { class: "small" }, [document.createTextNode(`Punti: ${pointsText}`)]),
      locked ? el("div", { class: "small mono" }, [document.createTextNode(`Prereq mancanti: ${missing.join(", ")}`)]) : document.createTextNode(""),
      el("div", { class: "sep" }),
      already
        ? el("div", { class: "small" }, [document.createTextNode("Questo achievement è già stato approvato.")])
        : el("div", {}, [
            el("div", { class: "small" }, [document.createTextNode("Inserisci una prova (facoltativa ma consigliata):")]),
            evidenceText,
            el("div", { style: "height:8px" }),
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

  const gpSnap = await getDoc(doc(db, `users/${uid}/gamepass/progress`));
  const gpPoints = gpSnap.exists() ? (gpSnap.data().points || 0) : 0;

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

  renderAchievements(achievements, earnedSet);
  renderRequests(requests);

  setStatus(`Ok. XP: ${gpPoints} • Approvati: ${earnedSet.size} • Richieste: ${requests.length}`);
}

onUser(async (user) => {
  if (!user) {
    userInfo.textContent = "";
    btnLogin.style.display = "";
    btnLogout.style.display = "none";
    achGrid.innerHTML = "";
    reqList.innerHTML = "";
    if (gpTiersList) gpTiersList.innerHTML = "";
    if (gpRoad) gpRoad.innerHTML = "";
    setStatus("Fai login per vedere e richiedere achievement.");
    return;
  }

  btnLogin.style.display = "none";
  btnLogout.style.display = "";
  userInfo.textContent = user.email || user.uid;

  await loadAll(user.uid);
});
