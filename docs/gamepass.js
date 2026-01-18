// docs/gamepass.js
// Game Pass (utente) - punti totali + progresso + anteprima premi sulla linea (stile Battle Pass)
// Auto-sblocco: al raggiungimento soglia, registra users/{uid}/gp_claims/{tierId} (se consentito dalle rules).
// Nessuna Cloud Function.

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

// UI progress (se presenti in gamepass.html)
const gpPointsValue = qs("#gpPointsValue");
const gpNextTitle = qs("#gpNextTitle");
const gpNextReq = qs("#gpNextReq");
const gpNextMissing = qs("#gpNextMissing");
const gpProgressBar = qs("#gpProgressBar");
const gpProgressPct = qs("#gpProgressPct");
const gpRewardText = qs("#gpRewardText");

// UI lista premi (track)
const gpTiersList = qs("#gpTiersList");

// UI anteprima sulla linea del progresso
const gpRoad = qs("#gpRoad"); // inner
const gpRoadScroll = qs("#gpRoadScroll"); // wrapper scroll

btnLogin.onclick = () => login().catch(err => alert(err.message));
btnLogout.onclick = () => logout().catch(err => alert(err.message));

function setStatus(msg) {
  statusBox.textContent = msg;
}

function badgeForStatus(s) {
  if (s === "approved") return "✅ approvata";
  if (s === "rejected") return "❌ rifiutata";
  return "⏳ in revisione";
}

/* ---------- Reward label + default preview images ---------- */

function formatReward(tier) {
  const r = tier?.reward || {};
  if (typeof r.label === "string" && r.label.trim()) return r.label.trim();

  const type = (r.type || tier.rewardType || "").toString();
  if (!type) return tier?.title || tier?.id || "—";

  if (type === "card") {
    const ov = r.overall ?? r.cardOverall;
    const cid = r.cardId || "";
    if (ov != null) return `Carta overall ${ov}`;
    if (cid) return `Carta (${cid})`;
    return "Carta";
  }

  if (type === "skin") return r.skinName ? `Skin: ${r.skinName}` : (r.skinId ? `Skin (${r.skinId})` : "Skin");
  if (type === "color") return r.colorName ? `Colore: ${r.colorName}` : (r.colorId ? `Colore (${r.colorId})` : "Colore");
  if (type === "item") return r.itemName ? `Item: ${r.itemName}` : (r.itemId ? `Item (${r.itemId})` : "Item");

  return type;
}

function rewardType(tier) {
  const r = tier?.reward || {};
  return (r.type || tier.rewardType || "").toString() || "item";
}

function svgDataUrl(svg) {
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function defaultRewardPreview(tier) {
  // Se in futuro vuoi usare immagini vere, basta mettere: tier.reward.imgUrl
  const r = tier?.reward || {};
  if (typeof r.imgUrl === "string" && r.imgUrl.trim()) return r.imgUrl.trim();

  const t = rewardType(tier);
  const label = (formatReward(tier) || "Reward").slice(0, 18);

  // Piccole preview SVG “gamey” (placeholder)
  const base = (accent1, accent2, icon) => svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="260" height="340" viewBox="0 0 260 340">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${accent1}" stop-opacity="0.95"/>
          <stop offset="1" stop-color="${accent2}" stop-opacity="0.95"/>
        </linearGradient>
        <radialGradient id="r" cx="30%" cy="25%" r="80%">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.25"/>
          <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
        <filter id="s" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity="0.35"/>
        </filter>
      </defs>
      <rect x="10" y="10" width="200" height="120" rx="18" fill="url(#g)" filter="url(#s)"/>
      <rect x="10" y="10" width="200" height="120" rx="18" fill="url(#r)"/>
      <rect x="16" y="16" width="188" height="108" rx="14" fill="rgba(0,0,0,0.18)" stroke="rgba(255,255,255,0.22)"/>
      ${icon}
      <text x="110" y="122" text-anchor="middle"
            font-family="ui-sans-serif,system-ui,Segoe UI,Roboto,Arial"
            font-size="12" fill="rgba(255,255,255,0.92)" font-weight="700">${label}</text>
    </svg>
  `);

  if (t === "card") {
    return base("#22d3ee", "#7c3aed", `
      <rect x="70" y="30" width="80" height="54" rx="10" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.35)"/>
      <rect x="78" y="38" width="64" height="38" rx="8" fill="rgba(0,0,0,0.18)" />
      <path d="M110 46 l6 12 13 2 -9 9 2 13 -12-6 -12 6 2-13 -9-9 13-2z"
            fill="rgba(255,255,255,0.70)"/>
    `);
  }
  if (t === "skin") {
    return base("#ff2bd6", "#7c3aed", `
      <circle cx="110" cy="55" r="28" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.35)"/>
      <circle cx="100" cy="53" r="4" fill="rgba(255,255,255,0.65)"/>
      <circle cx="120" cy="53" r="4" fill="rgba(255,255,255,0.65)"/>
      <path d="M92 65 q18 14 36 0" stroke="rgba(255,255,255,0.65)" stroke-width="3" fill="none" stroke-linecap="round"/>
    `);
  }
  if (t === "color") {
    return base("#fbbf24", "#ff2bd6", `
      <path d="M110 28
               C110 28, 80 64, 80 84
               a30 30 0 0 0 60 0
               C140 64,110 28,110 28Z"
            fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.35)"/>
      <path d="M122 62 q10 10 10 22" stroke="rgba(255,255,255,0.55)" stroke-width="3" fill="none" stroke-linecap="round"/>
    `);
  }
  // item/default
  return base("#22d3ee", "#ff2bd6", `
    <path d="M110 30 L145 48 L145 88 L110 106 L75 88 L75 48 Z"
          fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.35)"/>
    <path d="M110 30 L110 70 L75 88" fill="none" stroke="rgba(255,255,255,0.35)"/>
    <path d="M110 70 L145 48" fill="none" stroke="rgba(255,255,255,0.35)"/>
  `);
}

/* ---------- Progress + Track render ---------- */

function renderProgress(points, tiers) {
  if (gpPointsValue) gpPointsValue.textContent = String(points);

  const validTiers = (tiers || [])
    .filter(t => t && typeof t.requiredPoints === "number" && t.requiredPoints > 0 && t.active !== false)
    .sort((a, b) => a.requiredPoints - b.requiredPoints);

  const nextTier = validTiers.find(t => t.requiredPoints > points) || validTiers[validTiers.length - 1];

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
}

function renderTrack(points, tiers, claimedSet) {
  if (!gpTiersList) return;
  gpTiersList.innerHTML = "";

  const list = (tiers || [])
    .filter(t => t && typeof t.requiredPoints === "number" && t.active !== false)
    .sort((a, b) => a.requiredPoints - b.requiredPoints);

  if (!list.length) {
    gpTiersList.append(el("div", { class: "card small" }, [document.createTextNode("Nessun premio configurato.")]));
    return;
  }

  for (const t of list) {
    const req = Number(t.requiredPoints) || 0;
    const unlocked = points >= req;
    const recorded = claimedSet.has(t.id);

    const badge = unlocked ? (recorded ? "✅ sbloccato" : "🎁 sbloccato") : "🔒 bloccato";
    const missing = Math.max(0, req - points);

    gpTiersList.append(el("div", { class: "card" }, [
      el("div", { class: "row" }, [
        el("strong", {}, [document.createTextNode(formatReward(t))]),
        el("span", { class: "badge" }, [document.createTextNode(badge)])
      ]),
      el("div", { class: "small" }, [document.createTextNode(`Soglia: ${req} XP`)]),
      el("div", { class: "small" }, [document.createTextNode(unlocked ? "Hai raggiunto la soglia." : `Ti mancano ${missing} XP.`)])
    ]));
  }
}

function renderRoad(points, tiers, claimedSet) {
  if (!gpRoad) return;

  const list = (tiers || [])
    .filter(t => t && typeof t.requiredPoints === "number" && t.requiredPoints > 0 && t.active !== false)
    .sort((a, b) => a.requiredPoints - b.requiredPoints);

  gpRoad.innerHTML = "";
  if (!list.length) return;

  const max = Number(list[list.length - 1].requiredPoints) || 100;
  const fillPct = Math.max(0, Math.min(100, Math.round((points / max) * 100)));

  // width dinamica (se molti tiers -> scroll)
  const px = Math.max(980, list.length * 250);
  gpRoad.style.width = px + "px";

  const line = el("div", { class: "bp-roadline" }, [
    el("div", { class: "bp-roadfill", style: `width:${fillPct}%` }, [])
  ]);

  const nodes = el("div", { class: "bp-roadnodes" }, []);

  for (const t of list) {
    const req = Number(t.requiredPoints) || 0;
    const unlocked = points >= req;
    const preview = defaultRewardPreview(t);
    const label = formatReward(t);

    nodes.append(el("div", { class: `bp-node ${unlocked ? "is-unlocked" : "is-locked"}` }, [
      el("div", { class: "bp-node-top" }, [
        el("span", { class: `bp-node-chip ${unlocked ? "ok" : ""}` }, [document.createTextNode(unlocked ? "UNLOCKED" : "LOCKED")])
      ]),
      el("div", { class: "bp-node-body" }, [
        el("img", { class: "bp-node-img", src: preview, alt: label }),
        el("div", { class: "bp-node-label" }, [document.createTextNode(label)])
      ]),
      el("div", { class: "bp-node-req" }, [document.createTextNode(String(req))])
    ]));
  }

  const cursor = el("div", { class: "bp-roadcursor", style: `left:${fillPct}%` }, [
    el("div", { class: "bp-roadcursor-dot" }, [])
  ]);

  gpRoad.append(line, nodes, cursor);

  // auto-scroll verso la posizione corrente
  if (gpRoadScroll && gpRoadScroll.scrollWidth > gpRoadScroll.clientWidth) {
    const target = (gpRoad.scrollWidth * (fillPct / 100)) - (gpRoadScroll.clientWidth / 2);
    gpRoadScroll.scrollLeft = Math.max(0, target);
  }
}

/* ---------- Auto record unlocked ---------- */

async function autoRecordUnlocked(uid, points, tiers, claimedSet) {
  const list = (tiers || [])
    .filter(t => t && typeof t.requiredPoints === "number" && t.active !== false)
    .sort((a, b) => a.requiredPoints - b.requiredPoints);

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
      // Se non hai ancora messo le rules per gp_claims, qui vedrai "permission denied"
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

  const gpSnap = await getDoc(doc(db, `users/${uid}/gamepass/progress`));
  const gpPoints = gpSnap.exists() ? (gpSnap.data().points || 0) : 0;

  const tiersSnap = await getDocs(collection(db, "gp_tiers"));
  const tiers = tiersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const claimsSnap = await getDocs(collection(db, `users/${uid}/gp_claims`));
  const claimedSet = new Set(claimsSnap.docs.map(d => d.id));

  await autoRecordUnlocked(uid, gpPoints, tiers, claimedSet);

  renderProgress(gpPoints, tiers);
  renderRoad(gpPoints, tiers, claimedSet);
  renderTrack(gpPoints, tiers, claimedSet);

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
