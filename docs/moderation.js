// docs/moderation.js
// Moderazione richieste Game Pass + fallback nome da /users/{uid}/profile/main

import { onUser, login, logout, qs, el, db, auth } from "./common.js";
import {
  LEGACY_SEASON,
  normalizeSeason,
  recordSeason,
  seasonProgressPath,
  seasonEarnedDocPath
} from "./season-utils.js";

import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  setDoc,
  increment,
  runTransaction,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const statusBox = qs("#status");
const queue = qs("#queue");
const btnLogin = qs("#btnLogin");
const btnLogout = qs("#btnLogout");
const btnReload = qs("#btnReload");
const userInfo = qs("#userInfo");

// Gestione XP
const xpManager = qs("#xpManager");
const xpSeason = qs("#xpSeason");
const btnXpReload = qs("#btnXpReload");
const xpSearch = qs("#xpSearch");
const btnXpUid = qs("#btnXpUid");
const xpDirectoryHint = qs("#xpDirectoryHint");
const xpResults = qs("#xpResults");
const xpSelectedEmpty = qs("#xpSelectedEmpty");
const xpSelectedContent = qs("#xpSelectedContent");
const xpSelectedName = qs("#xpSelectedName");
const xpSelectedEmail = qs("#xpSelectedEmail");
const xpSelectedUid = qs("#xpSelectedUid");
const xpSelectedSeason = qs("#xpSelectedSeason");
const xpCurrentPoints = qs("#xpCurrentPoints");
const xpProgressHint = qs("#xpProgressHint");
const xpSetValue = qs("#xpSetValue");
const xpDeltaValue = qs("#xpDeltaValue");
const xpReason = qs("#xpReason");
const btnXpSet = qs("#btnXpSet");
const btnXpDelta = qs("#btnXpDelta");
const xpEditStatus = qs("#xpEditStatus");

// Creazione Achievement / Tier
const catalogManager = qs("#catalogManager");
const catalogAchCount = qs("#catalogAchCount");
const catalogTierCount = qs("#catalogTierCount");
const btnCatalogReload = qs("#btnCatalogReload");

const achCreateId = qs("#achCreateId");
const achCreateType = qs("#achCreateType");
const achCreateTitle = qs("#achCreateTitle");
const achCreateDesc = qs("#achCreateDesc");
const achCreatePoints = qs("#achCreatePoints");
const achCreatePrereq = qs("#achCreatePrereq");
const achCreateActive = qs("#achCreateActive");
const achCreateLinkRequest = qs("#achCreateLinkRequest");
const achCreateLinkUrl = qs("#achCreateLinkUrl");
const achLinkField = qs("#achLinkField");
const btnCreateAchievement = qs("#btnCreateAchievement");
const achCreateStatus = qs("#achCreateStatus");

const tierCreateId = qs("#tierCreateId");
const tierCreateRequired = qs("#tierCreateRequired");
const tierRewardType = qs("#tierRewardType");
const tierRewardRarity = qs("#tierRewardRarity");
const tierRewardLabel = qs("#tierRewardLabel");
const tierRewardTitle = qs("#tierRewardTitle");
const tierRewardImg = qs("#tierRewardImg");
const tierRewardOverall = qs("#tierRewardOverall");
const tierCreateActive = qs("#tierCreateActive");
const btnCreateTier = qs("#btnCreateTier");
const tierCreateStatus = qs("#tierCreateStatus");

let CURRENT_SEASON = 1;
let XP_DIRECTORY = [];
let SELECTED_XP_USER = null;

btnLogin.onclick = () => login().catch(err => alert(err.message));
btnLogout.onclick = () => logout().catch(err => alert(err.message));
btnReload.onclick = () => auth.currentUser && reloadModeratorData();

function setStatus(msg) { statusBox.textContent = msg; }
function setXpStatus(msg, cls = "") {
  if (!xpEditStatus) return;
  xpEditStatus.className = `small ${cls}`.trim();
  xpEditStatus.textContent = msg || "";
}

async function checkModerator(uid) {
  const modSnap = await getDoc(doc(db, "moderators", uid));
  return modSnap.exists();
}

async function addPointsToSeasonProgress(uid, season, pts) {
  const seasonNum = normalizeSeason(season);
  const scopedRef = doc(db, seasonProgressPath(uid, seasonNum));
  const scopedSnap = await getDoc(scopedRef);

  if (scopedSnap.exists()) {
    await setDoc(scopedRef, {
      season: seasonNum,
      points: increment(pts),
      updatedAt: serverTimestamp()
    }, { merge: true });
    return;
  }

  // Prima scrittura nel nuovo schema: per la Stagione 1 recupera gli XP legacy.
  let basePoints = 0;
  let legacyDailyAt = null;
  if (seasonNum === LEGACY_SEASON) {
    const legacySnap = await getDoc(doc(db, `users/${uid}/gamepass/progress`));
    if (legacySnap.exists()) {
      const d = legacySnap.data() || {};
      if (recordSeason(d) === LEGACY_SEASON) {
        basePoints = Number(d.points || 0) || 0;
        legacyDailyAt = d.lastDailyAt || null;
      }
    }
  }

  const payload = {
    season: seasonNum,
    points: basePoints + pts,
    migratedFromLegacy: basePoints > 0 || !!legacyDailyAt,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  if (legacyDailyAt) payload.lastDailyAt = legacyDailyAt;

  await setDoc(scopedRef, payload, { merge: true });
}

// Cache profili (evita getDoc ripetuti)
const profileNameCache = new Map(); // uid -> string|null oppure Promise
async function getProfileName(uid) {
  if (profileNameCache.has(uid)) return await profileNameCache.get(uid);

  const p = (async () => {
    try {
      const snap = await getDoc(doc(db, `users/${uid}/profile/main`));
      if (snap.exists()) {
        const d = snap.data() || {};
        const n = (d.displayName || "").toString().trim();
        return n || null;
      }
    } catch (e) {
      console.warn("getProfileName error", uid, e);
    }
    return null;
  })();

  profileNameCache.set(uid, p);
  const v = await p;
  profileNameCache.set(uid, v);
  return v;
}



function setCatalogStatus(elm, msg, cls = "") {
  if (!elm) return;
  elm.className = `catalog-status ${cls}`.trim();
  elm.textContent = msg || "";
}

function cleanDocId(raw) {
  return (raw || "").toString().trim();
}

function validDocId(id) {
  return !!id && id.length <= 150 && !id.includes("/");
}

function parsePrereq(raw) {
  return Array.from(new Set(
    (raw || "")
      .toString()
      .split(",")
      .map(v => v.trim())
      .filter(Boolean)
  )).slice(0, 30);
}

async function loadCatalogSummary() {
  if (!catalogAchCount || !catalogTierCount) return;

  try {
    const [achSnap, tierSnap] = await Promise.all([
      getDocs(collection(db, "achievements")),
      getDocs(collection(db, "gp_tiers"))
    ]);

    catalogAchCount.textContent = String(achSnap.size);
    catalogTierCount.textContent = String(tierSnap.size);
  } catch (e) {
    console.warn("loadCatalogSummary", e);
    catalogAchCount.textContent = "?";
    catalogTierCount.textContent = "?";
  }
}

function resetAchievementForm() {
  achCreateId.value = "";
  achCreateTitle.value = "";
  achCreateDesc.value = "";
  achCreatePoints.value = "";
  achCreatePrereq.value = "";
  achCreateType.value = "FUT";
  achCreateActive.checked = true;
  achCreateLinkRequest.checked = false;
  achCreateLinkUrl.value = "";
  achLinkField.style.display = "none";
}

function resetTierForm() {
  tierCreateId.value = "";
  tierCreateRequired.value = "";
  tierRewardType.value = "card";
  tierRewardRarity.value = "common";
  tierRewardLabel.value = "";
  tierRewardTitle.value = "";
  tierRewardImg.value = "";
  tierRewardOverall.value = "";
  tierCreateActive.checked = true;
}

async function createAchievementFromPanel() {
  const id = cleanDocId(achCreateId.value);
  const title = (achCreateTitle.value || "").trim();
  const desc = (achCreateDesc.value || "").trim();
  const type = (achCreateType.value || "").trim().toUpperCase();
  const points = Number(achCreatePoints.value);
  const prereq = parsePrereq(achCreatePrereq.value);
  const active = !!achCreateActive.checked;
  const linkRequest = !!achCreateLinkRequest.checked;
  const linkUrl = (achCreateLinkUrl.value || "").trim();

  if (!validDocId(id)) {
    setCatalogStatus(achCreateStatus, "Inserisci un ID valido, senza '/'.", "catalog-warning");
    return;
  }

  if (!title) {
    setCatalogStatus(achCreateStatus, "Inserisci il titolo dell'achievement.", "catalog-warning");
    achCreateTitle.focus();
    return;
  }

  if (!Number.isInteger(points) || points < 0) {
    setCatalogStatus(achCreateStatus, "Gli XP devono essere un numero intero ≥ 0.", "catalog-warning");
    achCreatePoints.focus();
    return;
  }

  if (!["FUT","WWE","F1","LIVE","SOCIAL"].includes(type)) {
    setCatalogStatus(achCreateStatus, "Categoria non valida.", "catalog-warning");
    return;
  }

  if (linkRequest && !/^https?:\/\//i.test(linkUrl)) {
    setCatalogStatus(achCreateStatus, "Per un achievement con link inserisci un URL http/https valido.", "catalog-warning");
    achCreateLinkUrl.focus();
    return;
  }

  if (prereq.includes(id)) {
    setCatalogStatus(achCreateStatus, "Un achievement non può avere se stesso come prerequisito.", "catalog-warning");
    return;
  }

  btnCreateAchievement.disabled = true;
  setCatalogStatus(achCreateStatus, "Controllo ID…");

  try {
    const ref = doc(db, "achievements", id);
    const existing = await getDoc(ref);

    if (existing.exists()) {
      throw new Error(`Esiste già un achievement con ID "${id}".`);
    }

    const ok = confirm(
      `Creare questo Achievement?\n\n` +
      `ID: ${id}\n` +
      `Titolo: ${title}\n` +
      `Categoria: ${type}\n` +
      `XP: ${points}\n` +
      `Prerequisiti: ${prereq.length ? prereq.join(", ") : "nessuno"}\n` +
      `Attivo: ${active ? "sì" : "no"}`
    );
    if (!ok) return;

    await setDoc(ref, {
      title,
      desc,
      points,
      type,
      active,
      prereq,
      linkRequest,
      linkUrl: linkRequest ? linkUrl : "",
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid
    });

    setCatalogStatus(
      achCreateStatus,
      `✓ Achievement "${id}" creato.`,
      "catalog-ok"
    );

    resetAchievementForm();
    await loadCatalogSummary();
  } catch (e) {
    console.error(e);
    setCatalogStatus(
      achCreateStatus,
      e?.message || "Errore nella creazione dell'achievement.",
      "catalog-warning"
    );
  } finally {
    btnCreateAchievement.disabled = false;
  }
}

async function createTierFromPanel() {
  const id = cleanDocId(tierCreateId.value);
  const requiredPoints = Number(tierCreateRequired.value);
  const type = (tierRewardType.value || "").trim().toLowerCase();
  const rarity = (tierRewardRarity.value || "").trim().toLowerCase();
  const label = (tierRewardLabel.value || "").trim();
  const title = (tierRewardTitle.value || "").trim() || label;
  const imgUrl = (tierRewardImg.value || "").trim();
  const overallRaw = (tierRewardOverall.value || "").trim();
  const overall = overallRaw === "" ? null : Number(overallRaw);
  const active = !!tierCreateActive.checked;

  if (!validDocId(id)) {
    setCatalogStatus(tierCreateStatus, "Inserisci un ID valido, senza '/'.", "catalog-warning");
    return;
  }

  if (!Number.isInteger(requiredPoints) || requiredPoints <= 0) {
    setCatalogStatus(tierCreateStatus, "Gli XP richiesti devono essere un intero > 0.", "catalog-warning");
    tierCreateRequired.focus();
    return;
  }

  if (!["card","skin","color","item"].includes(type)) {
    setCatalogStatus(tierCreateStatus, "Tipo premio non valido.", "catalog-warning");
    return;
  }

  if (!["common","rare","epic","legendary"].includes(rarity)) {
    setCatalogStatus(tierCreateStatus, "Rarità non valida.", "catalog-warning");
    return;
  }

  if (!label) {
    setCatalogStatus(tierCreateStatus, "Inserisci la label del premio.", "catalog-warning");
    tierRewardLabel.focus();
    return;
  }

  if (imgUrl && !/^(https?:|data:)/i.test(imgUrl)) {
    setCatalogStatus(tierCreateStatus, "L'immagine deve essere un URL http/https oppure data:.", "catalog-warning");
    tierRewardImg.focus();
    return;
  }

  if (overall !== null && (!Number.isInteger(overall) || overall < 0 || overall > 999)) {
    setCatalogStatus(tierCreateStatus, "Overall non valido.", "catalog-warning");
    tierRewardOverall.focus();
    return;
  }

  btnCreateTier.disabled = true;
  setCatalogStatus(tierCreateStatus, "Controllo ID…");

  try {
    const ref = doc(db, "gp_tiers", id);
    const existing = await getDoc(ref);

    if (existing.exists()) {
      throw new Error(`Esiste già un Tier con ID "${id}".`);
    }

    const ok = confirm(
      `Creare questo Tier?\n\n` +
      `ID: ${id}\n` +
      `XP richiesti: ${requiredPoints}\n` +
      `Premio: ${label}\n` +
      `Tipo: ${type}\n` +
      `Rarità: ${rarity}\n` +
      `Attivo: ${active ? "sì" : "no"}`
    );
    if (!ok) return;

    const reward = {
      type,
      rarity,
      label,
      title,
      imgUrl
    };

    if (overall !== null) reward.overall = overall;

    await setDoc(ref, {
      active,
      requiredPoints,
      reward,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid
    });

    setCatalogStatus(
      tierCreateStatus,
      `✓ Tier "${id}" creato.`,
      "catalog-ok"
    );

    resetTierForm();
    await loadCatalogSummary();
  } catch (e) {
    console.error(e);
    setCatalogStatus(
      tierCreateStatus,
      e?.message || "Errore nella creazione del Tier.",
      "catalog-warning"
    );
  } finally {
    btnCreateTier.disabled = false;
  }
}

achCreateLinkRequest?.addEventListener("change", () => {
  const enabled = !!achCreateLinkRequest.checked;
  achLinkField.style.display = enabled ? "" : "none";
  if (!enabled) achCreateLinkUrl.value = "";
});

btnCreateAchievement?.addEventListener("click", createAchievementFromPanel);
btnCreateTier?.addEventListener("click", createTierFromPanel);
btnCatalogReload?.addEventListener("click", loadCatalogSummary);

async function getCurrentSeason() {
  try {
    const cfg = await getDoc(doc(db, "config", "gamepass"));
    return normalizeSeason(cfg.exists() ? cfg.data()?.season : 1);
  } catch (e) {
    console.warn("getCurrentSeason", e);
    return 1;
  }
}

function uidFromProfilePath(path) {
  const seg = String(path || "").split("/");
  return seg[0] === "users" && seg[2] === "profile" ? (seg[1] || "") : "";
}

function upsertDirectoryUser(map, uid, patch = {}) {
  uid = (uid || "").toString().trim();
  if (!uid) return;

  const current = map.get(uid) || {
    uid,
    name: "",
    email: ""
  };

  if (patch.name && !current.name) current.name = String(patch.name).trim();
  if (patch.email && !current.email) current.email = String(patch.email).trim();

  map.set(uid, current);
}

async function loadXpDirectory() {
  if (!xpDirectoryHint || !xpResults) return;

  xpDirectoryHint.textContent = "Carico profili utenti…";
  xpResults.innerHTML = "";

  const byUid = new Map();

  // Fonte principale: profile/main
  try {
    const profilesSnap = await getDocs(
      query(collectionGroup(db, "profile"), limit(5000))
    );

    for (const d of profilesSnap.docs) {
      if (d.id !== "main") continue;
      const uid = uidFromProfilePath(d.ref.path);
      if (!uid) continue;

      const data = d.data() || {};
      upsertDirectoryUser(byUid, uid, {
        name: data.displayName || ""
      });
    }
  } catch (e) {
    console.warn("load profiles for XP editor", e);
  }

  // Fallback nome/email: richieste inviate nel tempo.
  try {
    const reqSnap = await getDocs(
      query(collection(db, "requests"), limit(2000))
    );

    for (const d of reqSnap.docs) {
      const r = d.data() || {};
      upsertDirectoryUser(byUid, r.uid, {
        name: r.requesterName || "",
        email: r.requesterEmail || ""
      });
    }
  } catch (e) {
    console.warn("load requests for XP editor", e);
  }

  XP_DIRECTORY = Array.from(byUid.values())
    .sort((a, b) =>
      (a.name || a.email || a.uid).localeCompare(
        b.name || b.email || b.uid,
        "it",
        { sensitivity: "base" }
      )
    );

  xpDirectoryHint.textContent =
    `${XP_DIRECTORY.length} utenti trovati • cerca per nome, email o UID`;

  renderXpSearchResults();
}

function renderXpSearchResults() {
  if (!xpResults || !xpSearch) return;

  const term = (xpSearch.value || "").trim().toLowerCase();

  let rows = XP_DIRECTORY;
  if (term) {
    rows = rows.filter(u =>
      (u.uid || "").toLowerCase().includes(term) ||
      (u.name || "").toLowerCase().includes(term) ||
      (u.email || "").toLowerCase().includes(term)
    );
  }

  rows = rows.slice(0, 30);
  xpResults.innerHTML = "";

  if (!rows.length) {
    xpResults.append(
      el("div", { class: "small", style: "padding:10px;" }, [
        document.createTextNode(
          term
            ? "Nessun risultato. Se conosci l'UID esatto, usa “Carica UID”."
            : "Nessun utente trovato."
        )
      ])
    );
    return;
  }

  for (const u of rows) {
    const openBtn = el("button", {
      class: "btn",
      type: "button",
      onclick: () => selectXpUser(u.uid, u)
    }, [document.createTextNode("Seleziona")]);

    xpResults.append(
      el("div", { class: "xp-user-row" }, [
        el("div", {}, [
          el("div", { class: "xp-user-name" }, [
            document.createTextNode(u.name || u.email || "Utente senza nome")
          ]),
          el("div", { class: "xp-user-meta" }, [
            document.createTextNode(
              [u.email, u.uid].filter(Boolean).join(" • ")
            )
          ])
        ]),
        openBtn
      ])
    );
  }
}

async function resolveUserInfo(uid, hint = null) {
  const info = {
    uid,
    name: hint?.name || "",
    email: hint?.email || ""
  };

  if (!info.name) {
    try {
      const profileSnap = await getDoc(doc(db, `users/${uid}/profile/main`));
      if (profileSnap.exists()) {
        info.name = (profileSnap.data()?.displayName || "").toString().trim();
      }
    } catch (e) {
      console.warn("resolve profile", e);
    }
  }

  return info;
}

async function selectXpUser(uid, hint = null) {
  uid = (uid || "").toString().trim();
  if (!uid) return;

  setXpStatus("Carico XP utente…");

  try {
    const info = await resolveUserInfo(uid, hint);
    const progressRef = doc(db, seasonProgressPath(uid, CURRENT_SEASON));
    const progressSnap = await getDoc(progressRef);
    const data = progressSnap.exists() ? (progressSnap.data() || {}) : {};
    const points = Math.max(0, Number(data.points || 0) || 0);

    SELECTED_XP_USER = {
      ...info,
      points,
      progressExists: progressSnap.exists()
    };

    xpSelectedEmpty.style.display = "none";
    xpSelectedContent.style.display = "";

    xpSelectedName.textContent = info.name || "Utente senza nome";
    xpSelectedEmail.textContent = info.email || "Email non disponibile";
    xpSelectedUid.textContent = uid;
    xpSelectedSeason.textContent = `STAGIONE ${CURRENT_SEASON}`;
    xpCurrentPoints.textContent = String(points);
    xpProgressHint.textContent = progressSnap.exists()
      ? `Progress season_${CURRENT_SEASON} esistente`
      : `Nessun progress per season_${CURRENT_SEASON}: attualmente vale 0 XP`;

    xpSetValue.value = "";
    xpDeltaValue.value = "";
    xpReason.value = "";
    setXpStatus("");
  } catch (e) {
    console.error(e);
    setXpStatus(e?.message || "Errore nel caricamento dell'utente.", "xp-warning");
  }
}

async function writeXpAudit({ uid, name, oldPoints, newPoints, reason }) {
  const moderator = auth.currentUser;
  if (!moderator) return;

  await addDoc(collection(db, "xp_adjustments"), {
    uid,
    targetName: name || "",
    season: CURRENT_SEASON,
    oldPoints,
    newPoints,
    delta: newPoints - oldPoints,
    reason,
    moderatorUid: moderator.uid,
    moderatorEmail: moderator.email || "",
    createdAt: serverTimestamp()
  });
}

async function applyXpChange(mode) {
  if (!SELECTED_XP_USER) {
    setXpStatus("Seleziona prima un utente.", "xp-warning");
    return;
  }

  const reason = (xpReason.value || "").trim();
  if (reason.length < 3) {
    setXpStatus("Inserisci un motivo per la modifica.", "xp-warning");
    xpReason.focus();
    return;
  }

  let inputValue;
  if (mode === "set") {
    inputValue = Number(xpSetValue.value);
    if (!Number.isFinite(inputValue) || inputValue < 0 || !Number.isInteger(inputValue)) {
      setXpStatus("Inserisci un valore XP intero maggiore o uguale a 0.", "xp-warning");
      return;
    }
  } else {
    inputValue = Number(xpDeltaValue.value);
    if (!Number.isFinite(inputValue) || inputValue === 0 || !Number.isInteger(inputValue)) {
      setXpStatus("Inserisci una variazione intera diversa da 0, es. 500 oppure -200.", "xp-warning");
      return;
    }
  }

  const uid = SELECTED_XP_USER.uid;
  const progressRef = doc(db, seasonProgressPath(uid, CURRENT_SEASON));

  // Anteprima basata sul valore appena letto; la transazione ricalcolerà
  // comunque tutto sul dato Firestore più recente.
  const previewOld = Number(SELECTED_XP_USER.points || 0) || 0;
  const previewNew = mode === "set"
    ? inputValue
    : previewOld + inputValue;

  if (previewNew < 0) {
    setXpStatus("La modifica porterebbe gli XP sotto zero.", "xp-warning");
    return;
  }

  const shownName = SELECTED_XP_USER.name || uid;
  const ok = confirm(
    `Confermi la modifica XP?\n\n` +
    `Utente: ${shownName}\n` +
    `Stagione: ${CURRENT_SEASON}\n` +
    `XP attuali: ${previewOld}\n` +
    `XP dopo modifica: ${previewNew}\n\n` +
    `Motivo: ${reason}`
  );
  if (!ok) return;

  btnXpSet.disabled = true;
  btnXpDelta.disabled = true;
  setXpStatus("Salvataggio in corso…");

  try {
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(progressRef);
      const oldPoints = snap.exists()
        ? Math.max(0, Number(snap.data()?.points || 0) || 0)
        : 0;

      const newPoints = mode === "set"
        ? inputValue
        : oldPoints + inputValue;

      if (!Number.isInteger(newPoints) || newPoints < 0) {
        throw new Error("La modifica porterebbe gli XP a un valore non valido.");
      }

      const payload = {
        season: CURRENT_SEASON,
        points: newPoints,
        updatedAt: serverTimestamp()
      };

      if (snap.exists()) {
        tx.set(progressRef, payload, { merge: true });
      } else {
        tx.set(progressRef, {
          ...payload,
          createdAt: serverTimestamp()
        });
      }

      return { oldPoints, newPoints };
    });

    let auditOk = true;
    try {
      await writeXpAudit({
        uid,
        name: SELECTED_XP_USER.name,
        oldPoints: result.oldPoints,
        newPoints: result.newPoints,
        reason
      });
    } catch (auditError) {
      auditOk = false;
      console.error("Audit XP non salvato", auditError);
    }

    SELECTED_XP_USER.points = result.newPoints;
    SELECTED_XP_USER.progressExists = true;
    xpCurrentPoints.textContent = String(result.newPoints);
    xpProgressHint.textContent = `Progress season_${CURRENT_SEASON} aggiornato`;
    xpSetValue.value = "";
    xpDeltaValue.value = "";

    setXpStatus(
      auditOk
        ? `✓ XP aggiornati: ${result.oldPoints} → ${result.newPoints}`
        : `XP aggiornati: ${result.oldPoints} → ${result.newPoints}. ATTENZIONE: log audit non salvato.`,
      auditOk ? "xp-ok" : "xp-warning"
    );
  } catch (e) {
    console.error(e);
    setXpStatus(e?.message || "Errore durante la modifica XP.", "xp-warning");
  } finally {
    btnXpSet.disabled = false;
    btnXpDelta.disabled = false;
  }
}

async function loadXpManager() {
  CURRENT_SEASON = await getCurrentSeason();
  xpSeason.textContent = String(CURRENT_SEASON);
  xpSelectedSeason.textContent = `STAGIONE ${CURRENT_SEASON}`;
  await loadXpDirectory();
}

async function reloadModeratorData() {
  await Promise.all([
    loadQueue(),
    loadXpManager(),
    loadCatalogSummary()
  ]);
}

xpSearch?.addEventListener("input", renderXpSearchResults);

btnXpUid?.addEventListener("click", async () => {
  const uid = (xpSearch?.value || "").trim();
  if (!uid) {
    setXpStatus("Scrivi prima l'UID esatto nel campo di ricerca.", "xp-warning");
    return;
  }
  await selectXpUser(uid, XP_DIRECTORY.find(u => u.uid === uid) || null);
});

btnXpReload?.addEventListener("click", () => {
  if (auth.currentUser) loadXpDirectory();
});

btnXpSet?.addEventListener("click", () => applyXpChange("set"));
btnXpDelta?.addEventListener("click", () => applyXpChange("delta"));

async function loadQueue() {
  setStatus("Carico richieste pending…");
  queue.innerHTML = "";

  const q = query(
    collection(db, "requests"),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    limit(100)
  );

  let snap;
  try {
    snap = await getDocs(q);
  } catch (e) {
    console.error(e);
    setStatus("Errore nel caricare la queue. Se vedi un errore index, crea l'indice richiesto in Firestore.");
    return;
  }

  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  setStatus(`Pending: ${items.length}`);

  if (!items.length) {
    queue.append(el("div", { class: "card small" }, [document.createTextNode("Nessuna richiesta in attesa.")]));
    return;
  }

  // Precarica profili per le richieste senza requesterName
  const uidsNeedingProfile = [...new Set(
    items
      .filter(r => !(r.requesterName && String(r.requesterName).trim()))
      .map(r => r.uid)
      .filter(Boolean)
  )];

  await Promise.all(uidsNeedingProfile.map(uid => getProfileName(uid)));

  for (const r of items) {
    const note = el("textarea", { placeholder: "Nota (opzionale)" });

    const approveBtn = el("button", {
      class: "btn primary",
      onclick: async () => {
        approveBtn.disabled = true;
        rejectBtn.disabled = true;

        try {
          // 1) prendo i punti dall'achievement
          const achSnap = await getDoc(doc(db, "achievements", r.achievementId));
          if (!achSnap.exists()) throw new Error("Achievement non trovato");
          const ach = achSnap.data() || {};

          const reqSeason = recordSeason(r);

          // 2) aggiorno la richiesta -> approved mantenendo la sua stagione
          await updateDoc(doc(db, "requests", r.id), {
            season: reqSeason,
            status: "approved",
            note: note.value.trim(),
            reviewedAt: serverTimestamp(),
            reviewedBy: auth.currentUser.uid
          });

          // 3) segno earned nella stagione della richiesta
          await setDoc(doc(db, seasonEarnedDocPath(r.uid, reqSeason, r.achievementId)), {
            season: reqSeason,
            achievementId: r.achievementId,
            requestId: r.id,
            approvedAt: serverTimestamp(),
            approvedBy: auth.currentUser.uid
          }, { merge: true });

          // 4) aggiungo i punti solo al progress della stagione corretta
          const pts = Number(ach.points) || 0;
          if (pts) {
            await addPointsToSeasonProgress(r.uid, reqSeason, pts);
          }

          await loadQueue();
        } catch (e) {
          alert(e?.message || "Errore");
          console.error(e);
        } finally {
          approveBtn.disabled = false;
          rejectBtn.disabled = false;
        }
      }
    }, [document.createTextNode("Approva")]);

    const rejectBtn = el("button", {
      class: "btn danger",
      onclick: async () => {
        rejectBtn.disabled = true;
        approveBtn.disabled = true;

        try {
          const reqSeason = recordSeason(r);
          await updateDoc(doc(db, "requests", r.id), {
            season: reqSeason,
            status: "rejected",
            note: note.value.trim(),
            reviewedAt: serverTimestamp(),
            reviewedBy: auth.currentUser.uid
          });
          await loadQueue();
        } catch (e) {
          alert(e?.message || "Errore");
          console.error(e);
        } finally {
          rejectBtn.disabled = false;
          approveBtn.disabled = false;
        }
      }
    }, [document.createTextNode("Rifiuta")]);

    // Prove
    const evidence = [];
    if (r.evidenceText) evidence.push(el("div", { class: "small" }, [document.createTextNode(`Prova: ${r.evidenceText}`)]));
    if (r.evidenceUrl) evidence.push(el("div", { class: "small" }, [
      document.createTextNode("Link: "),
      el("a", { href: r.evidenceUrl, target: "_blank", rel: "noopener" }, [document.createTextNode(r.evidenceUrl)])
    ]));

    // Nome: 1) requesterName nella request 2) profile/main.displayName 3) fallback
    const profileName = await getProfileName(r.uid);
    const shownName =
      (r.requesterName && String(r.requesterName).trim())
        ? String(r.requesterName).trim()
        : (profileName || "Senza nome");

    const shownEmail =
      (r.requesterEmail && String(r.requesterEmail).trim())
        ? String(r.requesterEmail).trim()
        : "Senza email";

    const card = el("div", { class: "card" }, [
      el("div", { class: "row" }, [
        el("strong", {}, [document.createTextNode(r.achievementTitle || r.achievementId)]),
        el("span", { class: "badge" }, [document.createTextNode(`STAGIONE ${recordSeason(r)}`)]),
        el("span", { class: "badge" }, [document.createTextNode("⏳ pending")]),
      ]),
      el("div", { class: "small" }, [
        document.createTextNode(`Utente: ${shownName} — ${shownEmail}`)
      ]),
      el("div", { class: "small mono" }, [
        document.createTextNode(`uid: ${r.uid}`)
      ]),
      ...evidence,
      el("div", { class: "sep" }),
      note,
      el("div", { style: "height:10px" }),
      el("div", { class: "row" }, [approveBtn, rejectBtn])
    ]);

    queue.append(card);
  }
}

onUser(async (user) => {
  if (!user) {
    userInfo.textContent = "";
    btnLogin.style.display = "";
    btnLogout.style.display = "none";
    btnReload.style.display = "none";
    if (xpManager) xpManager.style.display = "none";
    if (catalogManager) catalogManager.style.display = "none";
    queue.innerHTML = "";
    SELECTED_XP_USER = null;
    setStatus("Fai login. Serve essere presente in /moderators/{uid}.");
    return;
  }

  btnLogin.style.display = "none";
  btnLogout.style.display = "";
  userInfo.textContent = user.email || user.uid;

  const ok = await checkModerator(user.uid);
  if (!ok) {
    btnReload.style.display = "none";
    if (xpManager) xpManager.style.display = "none";
    if (catalogManager) catalogManager.style.display = "none";
    queue.innerHTML = "";
    setStatus("Non autorizzato: non sei in /moderators/{tuoUID}.");
    return;
  }

  btnReload.style.display = "";
  if (xpManager) xpManager.style.display = "";
  if (catalogManager) catalogManager.style.display = "";
  await reloadModeratorData();
});
