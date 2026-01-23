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
// ==== Carte collegate (da cards.json) ====
const myCards = qs("#myCards");
const myCardsSub = qs("#myCardsSub");
const myCardsBtn = qs("#myCardsBtn");

let ALL_CARDS_CACHE = null;

function norm(s){ return (s||"").toString().trim().toLowerCase(); }

async function loadAllCardsJson(){
  if (Array.isArray(ALL_CARDS_CACHE)) return ALL_CARDS_CACHE;
  try{
    const res = await fetch("cards.json", { cache: "no-store" });
    if(!res.ok) throw new Error("cards.json non trovato");
    const data = await res.json();
    ALL_CARDS_CACHE = Array.isArray(data) ? data : [];
  }catch(e){
    console.warn("[profile] impossibile caricare cards.json", e);
    ALL_CARDS_CACHE = [];
  }
  return ALL_CARDS_CACHE;
}

function bestGameForRoot(root, cards){
  const key = norm(root);
  if(!key) return "";
  const games = Array.from(new Set(cards.map(c => c && c.game).filter(Boolean)));
  let best = "";
  let bestScore = 0;

  for (const g of games){
    const gl = norm(g);
    let score = 0;

    if (gl === key) score = 100;
    else if (gl.startsWith(key)) score = 90;      // "Fantaballa" -> "Fantaballa FC"
    else if (gl.includes(key)) score = 70;

    if (score > bestScore){
      bestScore = score;
      best = g;
    }
  }
  return best;
}

function chipClassForRarity(r){
  const s = norm(r);
  if (s.includes("legg")) return "legendary";
  if (s.includes("epic") || s.includes("ultra")) return "epic";
  if (s.includes("rara") || s.includes("non comune")) return "rare";
  return "common";
}

function renderLinkedCards(list, gameLabel){
  if(!myCards) return;

  myCards.innerHTML = "";

  if (!list.length){
    myCards.append(
      el("div", { class: "small", style: "padding:12px; color: rgba(255,255,255,.72);" }, [
        document.createTextNode("Nessuna carta trovata per questo nome. (Controlla che in cards.json il campo 'game' contenga la tua radice, es: 'Fantaballa FC'.)")
      ])
    );
    return;
  }

  for (const c of list){
    const href = gameLabel
      ? `./index.html?game=${encodeURIComponent(gameLabel)}&card=${encodeURIComponent(c.id)}`
      : `./index.html?card=${encodeURIComponent(c.id)}`;

    const cardNode = el("a", { class: "tier-card", href }, [
      el("div", { class: "tier-top" }, [
        el("span", { class: "chip " + chipClassForRarity(c.rarity) }, [document.createTextNode(c.rarity || "Carta")]),
        el("span", { class: "small" }, [document.createTextNode(c.role || "—")])
      ]),
      el("div", { class: "tier-imgwrap" }, [
        el("img", { class: "tier-img", src: c.img, alt: c.name || c.id || "Carta", loading: "lazy" })
      ]),
      el("div", { class: "tier-title" }, [document.createTextNode(c.name || c.id || "Carta")]),
      el("div", { class: "tier-foot" }, [
        el("span", { class: "mono" }, [document.createTextNode(c.game || "—")]),
        el("span", { class: "small" }, [document.createTextNode(`${c.series || "—"} • ${c.role || "—"}`)])
      ])
    ]);

    myCards.append(cardNode);
  }
}

async function updateLinkedCards(){
  if(!myCards) return;

  const root = (inpName?.value || "").trim();
  if(!root){
    myCardsSub && (myCardsSub.textContent = "Inserisci un nome per collegare le carte.");
    myCards.innerHTML = "";
    return;
  }

  const all = await loadAllCardsJson();

  const bestGame = bestGameForRoot(root, all);

  let list = [];
  if (bestGame){
    list = all.filter(c => c && c.game === bestGame);
  } else {
    const k = norm(root);
    list = all.filter(c => c && norm(c.game).includes(k));
  }

  list.sort((a,b)=> (a?.name||"").localeCompare(b?.name||"", "it"));

  if (myCardsSub){
    myCardsSub.textContent = bestGame
      ? `Trovate ${list.length} carte per: ${bestGame}`
      : `Trovate ${list.length} carte che contengono: "${root}"`;
  }
  if (myCardsBtn){
    myCardsBtn.href = bestGame ? `./index.html?game=${encodeURIComponent(bestGame)}` : "./index.html";
  }

  renderLinkedCards(list, bestGame);
}


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
    // aggiorna anche la sezione "Le tue carte" (debounce)
    try{
      clearTimeout(window.__cardsTimer);
      window.__cardsTimer = setTimeout(() => { updateLinkedCards(); }, 250);
    }catch(e){}
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
    if (myCardsSub) myCardsSub.textContent = "Fai login per vedere le tue carte."; 
    if (myCards) myCards.innerHTML = "";
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
  await updateLinkedCards();

  btnSave.onclick = async () => { await saveProfile(user.uid); await updateLinkedCards(); };

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
