// docs/profile.js
import { onUser, login, logout, qs, el, db, auth } from "./common.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const statusBox = qs("#status");
const btnLogin = qs("#btnLogin");
const btnLogout = qs("#btnLogout");
const userInfo = qs("#userInfo");

const avatar = qs("#avatar");
const namePreview = qs("#namePreview");
const emailPreview = qs("#emailPreview");
const inpName = qs("#displayName");
const inpBio = qs("#bio");
const btnSave = qs("#btnSave");
const saveHint = qs("#saveHint");

// Key/Value boxes
const kvEmail = qs("#kvEmail");
const kvUid = qs("#kvUid");
const kvSeason = qs("#kvSeason");
const kvXP = qs("#kvXP");
const kvTier = qs("#kvTier");
const kvNext = qs("#kvNext");

const badgeGP = qs("#badgeGP");
const gpBar = qs("#gpBar");
const gpPct = qs("#gpPct");
const gpHint = qs("#gpHint");

// Stats
const statEarned = qs("#statEarned");
const statReq = qs("#statReq");
const statPending = qs("#statPending");
const statApproved = qs("#statApproved");

// Lists
const reqList = qs("#reqList");

btnLogin.onclick = () => login().catch(err => alert(err.message));
btnLogout.onclick = () => logout().catch(err => alert(err.message));

function setStatus(msg) {
  statusBox.textContent = msg;
}

async function getCurrentSeason() {
  try {
    const cfg = await getDoc(doc(db, "config", "gamepass"));
    return cfg.exists() ? (Number(cfg.data()?.season || 1) || 1) : 1;
  } catch {
    return 1;
  }
}

function fmt(n) {
  const x = Number(n || 0) || 0;
  return x.toLocaleString("it-IT");
}

function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function setHint(text, kind = "ok") {
  saveHint.textContent = text;
  saveHint.className = "small " + (kind === "ok" ? "hint-ok" : kind === "warn" ? "hint-warn" : "hint-err");
}

async function loadProfile(uid, user) {
  const ref = doc(db, `users/${uid}/profile/main`);
  const snap = await getDoc(ref);

  const defaultName =
    (user?.displayName || "") ||
    (user?.email ? user.email.split("@")[0] : "") ||
    "";

  const data = snap.exists() ? (snap.data() || {}) : {};

  inpName.value = (data.displayName || defaultName || "").toString();
  inpBio.value = (data.bio || "").toString();

  const display = inpName.value.trim() || "Senza nome";
  namePreview.textContent = display;
  emailPreview.textContent = user?.email || uid;

  // Avatar: Google photoURL (preferito) -> profile.photoURL -> placeholder
  const photo = user?.photoURL || data.photoURL || "https://api.dicebear.com/7.x/bottts-neutral/svg?seed=BattlePass";
  avatar.src = photo;

  setHint(snap.exists() ? "Profilo caricato." : "Imposta il tuo nome e salva.", snap.exists() ? "ok" : "warn");
}

async function saveProfile(uid) {
  const name = (inpName.value || "").trim();
  const bio = (inpBio.value || "").trim();

  if (name.length < 2) {
    setHint("Nome troppo corto (min 2 caratteri).", "err");
    return;
  }
  if (name.length > 24) {
    setHint("Nome troppo lungo (max 24 caratteri).", "err");
    return;
  }

  btnSave.disabled = true;
  try {
    await setDoc(doc(db, `users/${uid}/profile/main`), {
      displayName: name,
      bio: bio,
      // non forziamo photoURL: di default è quello Google
      updatedAt: serverTimestamp()
    }, { merge: true });

    namePreview.textContent = name;
    setHint("Salvato ✅", "ok");
  } catch (e) {
    console.error(e);
    setHint(e?.message || "Errore nel salvataggio", "err");
  } finally {
    btnSave.disabled = false;
  }
}

async function loadGamepass(uid) {
  const season = await getCurrentSeason();

  const progSnap = await getDoc(doc(db, `users/${uid}/gamepass/progress`));
  let xp = 0;
  if (progSnap.exists()) {
    const d = progSnap.data() || {};
    if (Number(d.season || 0) === season) xp = Number(d.points || 0) || 0;
  }

  // tiers
  const tiersSnap = await getDocs(collection(db, "gp_tiers"));
  const tiers = tiersSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(t => typeof t.requiredPoints === "number")
    .sort((a, b) => a.requiredPoints - b.requiredPoints);

  // calcola tier attuale e prossimo
  let tierIdx = 0;
  for (let i = 0; i < tiers.length; i++) {
    if (xp >= tiers[i].requiredPoints) tierIdx = i + 1;
  }
  const nextTier = tiers[Math.min(tierIdx, Math.max(0, tiers.length - 1))];
  const prevReq = tierIdx <= 0 ? 0 : tiers[tierIdx - 1].requiredPoints;
  const nextReq = nextTier ? nextTier.requiredPoints : prevReq;

  kvSeason.textContent = String(season);
  kvXP.textContent = fmt(xp);
  kvTier.textContent = tiers.length ? `${tierIdx}/${tiers.length}` : "—";

  if (tiers.length) {
    if (tierIdx >= tiers.length) {
      kvNext.textContent = "Completato ✅";
      badgeGP.textContent = "🏁 Pass completato";
      gpBar.style.width = "100%";
      gpPct.textContent = "100%";
      gpHint.textContent = "Hai raggiunto l’ultima soglia.";
    } else {
      kvNext.textContent = `${fmt(nextReq)} XP`;
      badgeGP.textContent = `🎯 Prossimo tier: ${tierIdx + 1}`;
      const frac = clamp01((xp - prevReq) / Math.max(1, (nextReq - prevReq)));
      gpBar.style.width = `${Math.round(frac * 100)}%`;
      gpPct.textContent = `${Math.round(frac * 100)}%`;
      gpHint.textContent = `Mancano ${fmt(Math.max(0, nextReq - xp))} XP`;
    }
  } else {
    kvNext.textContent = "—";
    badgeGP.textContent = "Configura i tiers";
    gpBar.style.width = "0%";
    gpPct.textContent = "0%";
    gpHint.textContent = "Crea i documenti in gp_tiers.";
  }

  return { season, xp };
}

function badgeForStatus(s) {
  if (s === "approved") return "✅ approvata";
  if (s === "rejected") return "❌ rifiutata";
  return "⏳ pending";
}

async function loadRequests(uid) {
  reqList.innerHTML = "";
  const q = query(
    collection(db, "requests"),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(10)
  );

  const snap = await getDocs(q);
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // stats richieste
  statReq.textContent = String(rows.length);

  let pending = 0, approved = 0;
  for (const r of rows) {
    if (r.status === "pending") pending++;
    if (r.status === "approved") approved++;
  }
  statPending.textContent = String(pending);
  statApproved.textContent = String(approved);

  if (!rows.length) {
    reqList.append(el("div", { class: "item small" }, [document.createTextNode("Nessuna richiesta ancora.")]));
    return;
  }

  for (const r of rows) {
    const title = r.achievementTitle || r.achievementId || "Richiesta";
    const status = badgeForStatus(r.status);
    const card = el("div", { class: "item" }, [
      el("div", { class: "top" }, [
        el("strong", {}, [document.createTextNode(title)]),
        el("span", { class: "badge" }, [document.createTextNode(status)])
      ]),
      r.note ? el("div", { class: "small" }, [document.createTextNode(`Nota mod: ${r.note}`)]) : el("div", { class: "small" }, [document.createTextNode(" ")])
    ]);
    reqList.append(card);
  }
}

async function loadEarned(uid) {
  // Conta earned (può essere molti doc: per ora facciamo getDocs e length)
  const snap = await getDocs(collection(db, `users/${uid}/earned`));
  statEarned.textContent = String(snap.size);
}

on_attach_listeners();

function on_attach_listeners() {
  inpName.addEventListener("input", () => {
    namePreview.textContent = inpName.value.trim() || "Senza nome";
  });
}

onUser(async (user) => {
  if (!user) {
    userInfo.textContent = "";
    btnLogin.style.display = "";
    btnLogout.style.display = "none";
    kvEmail.textContent = "—";
    kvUid.textContent = "—";
    kvSeason.textContent = "—";
    kvXP.textContent = "—";
    kvTier.textContent = "—";
    kvNext.textContent = "—";
    gpBar.style.width = "0%";
    gpPct.textContent = "0%";
    gpHint.textContent = "—";
    reqList.innerHTML = "";
    statEarned.textContent = "0";
    statReq.textContent = "0";
    statPending.textContent = "0";
    statApproved.textContent = "0";
    avatar.removeAttribute("src");
    namePreview.textContent = "—";
    emailPreview.textContent = "—";
    setStatus("Fai login per vedere e modificare il tuo profilo.");
    return;
  }

  btnLogin.style.display = "none";
  btnLogout.style.display = "";
  userInfo.textContent = user.email || user.uid;

  kvEmail.textContent = user.email || "—";
  kvUid.textContent = user.uid;

  setStatus("Carico profilo…");

  // Carica tutto
  await loadProfile(user.uid, user);

  btnSave.onclick = () => saveProfile(user.uid);

  try {
    await loadGamepass(user.uid);
    await loadRequests(user.uid);
    await loadEarned(user.uid);
    setStatus("Ok.");
  } catch (e) {
    console.error(e);
    setStatus(e?.message || "Errore nel caricare i dati.");
  }
});
