// docs/gamepass.js
// Game Pass (utente) - punti totali + progresso verso il prossimo premio (tiers)
// Richieste su Firestore (no Cloud Functions)

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
  getDoc
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

function formatReward(tier) {
  // Preferisci un campo leggibile (reward.label), altrimenti costruisci una stringa semplice
  const r = tier?.reward || {};
  if (typeof r.label === "string" && r.label.trim()) return r.label.trim();

  const type = (r.type || tier.rewardType || "").toString();
  if (!type) return "—";

  if (type === "card") {
    const ov = r.overall ?? r.cardOverall;
    const cid = r.cardId || r.id || "";
    if (ov != null) return `Carta (overall ${ov})`;
    if (cid) return `Carta (${cid})`;
    return "Carta";
  }

  if (type === "skin") return r.skinName ? `Skin: ${r.skinName}` : "Skin";
  if (type === "color") return r.colorName ? `Colore: ${r.colorName}` : "Colore";
  if (type === "item") return r.itemName ? `Item: ${r.itemName}` : "Item";

  return type;
}

function renderProgress(points, tiers) {
  // Se non hai aggiunto gli elementi in HTML, non fare nulla
  if (!gpPointsValue && !gpProgressBar) return;

  if (gpPointsValue) gpPointsValue.textContent = String(points);

  const validTiers = (tiers || [])
    .filter(t => t && typeof t.requiredPoints === "number" && t.requiredPoints > 0 && t.active !== false)
    .sort((a, b) => a.requiredPoints - b.requiredPoints);

  // Prossimo premio = primo tier con requiredPoints > points
  // Se li hai tutti raggiunti, usa l'ultimo (così mostra 100%)
  const nextTier = validTiers.find(t => t.requiredPoints > points) || validTiers[validTiers.length - 1];

  if (!nextTier) {
    if (gpNextTitle) gpNextTitle.textContent = "Nessun premio configurato";
    if (gpNextReq) gpNextReq.textContent = "—";
    if (gpNextMissing) gpNextMissing.textContent = "—";
    if (gpRewardText) gpRewardText.textContent = "—";
    if (gpProgressBar) { gpProgressBar.max = 100; gpProgressBar.value = 0; }
    if (gpProgressPct) gpProgressPct.textContent = "0%";
    return;
  }

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

async function loadAll(uid) {
  setStatus("Carico achievements e stato…");

  // Achievements attivi
  const achSnap = await getDocs(collection(db, "achievements"));
  const achievements = achSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(a => a.active !== false);

  // Earned dell'utente
  const earnedSnap = await getDocs(collection(db, `users/${uid}/earned`));
  const earnedSet = new Set(earnedSnap.docs.map(d => d.id));

  // Punti Game Pass (doc: users/{uid}/gamepass/progress)
  const gpSnap = await getDoc(doc(db, `users/${uid}/gamepass/progress`));
  const gpPoints = gpSnap.exists() ? (gpSnap.data().points || 0) : 0;

  // Premi (tiers) - lettura semplice senza indici: leggiamo tutto e ordiniamo lato client
  const tiersSnap = await getDocs(collection(db, "gp_tiers"));
  const tiers = tiersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  renderProgress(gpPoints, tiers);

  // Requests dell'utente (ultime 50)
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

  // Status compatto (con next tier se c'e')
  const nextTier = (tiers || [])
    .filter(t => t && typeof t.requiredPoints === "number" && t.requiredPoints > 0 && t.active !== false)
    .sort((a, b) => a.requiredPoints - b.requiredPoints)
    .find(t => t.requiredPoints > gpPoints);
  const nextStr = nextTier ? ` • Prossimo: ${nextTier.title || nextTier.id} (${gpPoints}/${nextTier.requiredPoints})` : "";

  setStatus(`Ok. Punti GP: ${gpPoints} • Approvati: ${earnedSet.size} • Richieste: ${requests.length}${nextStr}`);
}

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

            // Dati utili per moderazione (nome/email)
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

    const pointsText = (ach.points != null) ? `+${ach.points} punti` : "—";

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

onUser(async (user) => {
  if (!user) {
    userInfo.textContent = "";
    btnLogin.style.display = "";
    btnLogout.style.display = "none";
    achGrid.innerHTML = "";
    reqList.innerHTML = "";
    setStatus("Fai login per vedere e richiedere achievement.");
    return;
  }

  btnLogin.style.display = "none";
  btnLogout.style.display = "";
  userInfo.textContent = user.email || user.uid;

  await loadAll(user.uid);
});
