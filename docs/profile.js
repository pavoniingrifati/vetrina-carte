// docs/profile.js
import { onUser, login, logout, qs, el, db, auth } from "./common.js";
import {
  LEGACY_SEASON,
  normalizeSeason,
  recordSeason,
  seasonProgressPath,
  seasonEarnedCollectionPath,
  seasonClaimsCollectionPath
} from "./season-utils.js";

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

const heroLevel = qs("#heroLevel");
const heroSeason = qs("#heroSeason");
const heroTierText = qs("#heroTierText");
const heroXpText = qs("#heroXpText");
const heroXpBar = qs("#heroXpBar");

const favoriteCardEmpty = qs("#favoriteCardEmpty");
const favoriteCardVisual = qs("#favoriteCardVisual");
const favoriteCardImg = qs("#favoriteCardImg");
const favoriteCardName = qs("#favoriteCardName");
const favoriteCardMeta = qs("#favoriteCardMeta");

const featuredGrid = qs("#featuredGrid");
const earnedPicker = qs("#earnedPicker");
const featuredHint = qs("#featuredHint");
const seasonHistory = qs("#seasonHistory");

// Stats
const statLevel = qs("#statLevel");
const statXP = qs("#statXP");
const statEarned = qs("#statEarned");
const statRewards = qs("#statRewards");
const statCards = qs("#statCards");
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
let PROFILE_PREFS = {
  featuredAchievementIds: [],
  favoriteCardId: ""
};
let CURRENT_UID = null;
let CURRENT_SEASON = 1;
let CURRENT_LINKED_CARDS = [];
let CURRENT_EARNED = [];
let CURRENT_TIERS = [];

function norm(s){ return (s||"").toString().trim().toLowerCase(); }


// --- Fix percorsi immagini locali (GitHub Pages + doppia-encoding) ---
// Problemi tipici:
// 1) "%2520" = spazio codificato due volte (dovrebbe essere "%20")
// 2) path relativo risolto nella cartella sbagliata (se la pagina non è in root)

function projectRootUrl(){
  // Su GitHub Pages "project site" l'app gira sotto "/<repo>/"
  try{
    const origin = location.origin;
    const seg = (location.pathname.split("/").filter(Boolean)[0] || "").trim();
    if (location.hostname.endsWith("github.io") && seg){
      return `${origin}/${seg}/`; // es: https://user.github.io/vetrina-carte/
    }
    return `${origin}/`;
  }catch(e){
    return "/";
  }
}

function decodeMany(s){
  let out = (s ?? "").toString().trim();
  // Decodifica più volte (max 3) per gestire casi come %2520 -> %20 -> " "
  for (let i = 0; i < 3; i++){
    try{
      const dec = decodeURIComponent(out);
      if (dec === out) break;
      out = dec;
    }catch(e){
      break;
    }
  }
  return out;
}

function buildImgCandidates(rawSrc){
  const src0 = (rawSrc ?? "").toString().trim();
  if (!src0) return [];

  // Tutte le carte sono ora WebP. Se arriva ancora un vecchio riferimento PNG,
  // prova PRIMA la stessa risorsa con estensione .webp.
  const preferWebp = (src) => src.replace(/\.png(?=([?#]|$))/i, ".webp");

  // URL esterne: preferisci WebP, mantenendo comunque il vecchio path come fallback.
  if (/^(https?:|data:|blob:)/i.test(src0)) {
    if (/^(data:|blob:)/i.test(src0)) return [src0];
    return Array.from(new Set([preferWebp(src0), src0]));
  }

  // Normalizza: elimina doppia codifica e prefissi tipo "./"
  let clean = preferWebp(decodeMany(src0)).replace(/^\.\/+/, "").replace(/^\/+/, "");
  // Se qualcuno ha messo "vetrina-carte/img/..." nel JSON, togli il prefisso repo per evitare duplicati
  const repoSeg = (location.pathname.split("/").filter(Boolean)[0] || "").trim();
  if (repoSeg && clean.startsWith(repoSeg + "/")) clean = clean.slice(repoSeg.length + 1);

  // Se nel JSON manca la cartella (es: "Fork Altezza.webp"), prova anche dentro "img/"
  const cleanImg = (!clean.includes("/") && !clean.startsWith("img/")) ? ("img/" + clean) : null;

  const rootBase = projectRootUrl();               // .../vetrina-carte/
  const pageBase = new URL("./", document.baseURI).href; // cartella corrente della pagina

  // NB: usando new URL() lasciamo che il browser codifichi gli spazi una sola volta (%20)
  const candidates = [
    new URL(clean, rootBase).href,  // ✅ quello “giusto” per la tua struttura: /vetrina-carte/img/...
    new URL(clean, pageBase).href   // fallback: relativo alla cartella della pagina
  ];

  if (cleanImg){
    candidates.push(new URL(cleanImg, rootBase).href);
    candidates.push(new URL(cleanImg, pageBase).href);
  }

  // Se la pagina è in sottocartella e il JSON è "img/...", prova anche "../img/..."
  if (clean.startsWith("img/")){
    candidates.push(new URL("../" + clean, pageBase).href);
  }

  // Se pubblichi da root ma tieni assets in /docs/
  candidates.push(new URL("docs/" + clean, rootBase).href);

  // Dedup
  return Array.from(new Set(candidates));
}

function setImgSrcWithFallback(imgEl, rawSrc){
  const candidates = buildImgCandidates(rawSrc);
  if (!candidates.length) return;

  let i = 0;
  const tryNext = () => {
    if (i >= candidates.length) {
      imgEl.onerror = null;
      return;
    }
    imgEl.src = candidates[i++];
  };

  imgEl.onerror = () => tryNext();
  tryNext();
}

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

function renderFavoriteShowcase(){
  if (!favoriteCardVisual || !favoriteCardEmpty) return;
  const favoriteId = PROFILE_PREFS.favoriteCardId || "";
  const card = CURRENT_LINKED_CARDS.find(c => String(c?.id || "") === String(favoriteId));

  if (!card){
    favoriteCardVisual.style.display = "none";
    favoriteCardEmpty.style.display = "";
    return;
  }

  favoriteCardEmpty.style.display = "none";
  favoriteCardVisual.style.display = "";
  favoriteCardName.textContent = card.name || card.id || "Carta";
  favoriteCardMeta.textContent = [card.rarity, card.series, card.role].filter(Boolean).join(" • ") || "Fantaballa";
  setImgSrcWithFallback(favoriteCardImg, card.img);
}

async function saveProfilePreferences(patch){
  if (!CURRENT_UID) return;
  const next = { ...PROFILE_PREFS, ...patch };
  next.featuredAchievementIds = Array.from(new Set(
    Array.isArray(next.featuredAchievementIds) ? next.featuredAchievementIds.map(String) : []
  )).slice(0, 3);
  next.favoriteCardId = (next.favoriteCardId || "").toString();

  const displayName = (inpName?.value || "").trim();
  if (displayName.length < 2) {
    throw new Error("Salva prima un nickname di almeno 2 caratteri.");
  }

  await setDoc(doc(db, `users/${CURRENT_UID}/profile/main`), {
    displayName,
    bio: (inpBio?.value || "").trim(),
    featuredAchievementIds: next.featuredAchievementIds,
    favoriteCardId: next.favoriteCardId,
    updatedAt: serverTimestamp()
  }, { merge: true });

  PROFILE_PREFS = next;
}

async function setFavoriteCard(cardId){
  try{
    const nextId = PROFILE_PREFS.favoriteCardId === String(cardId) ? "" : String(cardId);
    await saveProfilePreferences({ favoriteCardId: nextId });
    renderLinkedCards(CURRENT_LINKED_CARDS, (inpName?.value || "").trim());
    renderFavoriteShowcase();
  }catch(e){
    console.error(e);
    setStatus(e?.message || "Non riesco a salvare la carta preferita.");
  }
}

function renderLinkedCards(list, query){
  if(!myCards) return;

  CURRENT_LINKED_CARDS = Array.isArray(list) ? list : [];
  if (statCards) statCards.textContent = String(CURRENT_LINKED_CARDS.length);
  myCards.innerHTML = "";

  if (!list.length){
    myCards.append(
      el("div", { class: "small", style: "padding:12px; color: rgba(255,255,255,.72);" }, [
        document.createTextNode("Nessuna carta trovata per questo testo. (Controlla che in cards.json il campo 'name' delle carte inizi con la radice che hai inserito, es: 'Fork'.)")
      ])
    );
    renderFavoriteShowcase();
    return;
  }

  for (const c of list){
    const href = query
      ? `./index.html?q=${encodeURIComponent(query)}&card=${encodeURIComponent(c.id)}`
      : `./index.html?card=${encodeURIComponent(c.id)}`;

    const cardLink = el("a", { class: "tier-card", href }, [
      el("div", { class: "tier-top" }, [
        el("span", { class: "chip " + chipClassForRarity(c.rarity) }, [document.createTextNode(c.rarity || "Carta")]),
        el("span", { class: "small" }, [document.createTextNode(c.role || "—")])
      ]),
      (() => {
        const imgEl = el("img", { class: "tier-img", alt: c.name || c.id || "Carta", loading: "lazy" });
        setImgSrcWithFallback(imgEl, c.img);
        return el("div", { class: "tier-imgwrap" }, [ imgEl ]);
      })(),
      el("div", { class: "tier-title" }, [document.createTextNode(c.name || c.id || "Carta")]),
      el("div", { class: "tier-foot" }, [
        el("span", { class: "mono" }, [document.createTextNode(c.game || "—")]),
        el("span", { class: "small" }, [document.createTextNode(`${c.series || "—"} • ${c.role || "—"}`)])
      ])
    ]);

    const favBtn = el("button", {
      class: "favorite-toggle" + (PROFILE_PREFS.favoriteCardId === String(c.id) ? " active" : ""),
      type: "button",
      title: "Imposta come carta preferita"
    }, [document.createTextNode(PROFILE_PREFS.favoriteCardId === String(c.id) ? "★ Preferita" : "☆ Preferita")]);

    favBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      setFavoriteCard(c.id);
    });

    myCards.append(el("div", { class: "tier-card-wrap" }, [cardLink, favBtn]));
  }

  renderFavoriteShowcase();
}

async function updateLinkedCards(){
  if(!myCards) return;

  const root = (inpName?.value || "").trim();
  if(!root){
    myCardsSub && (myCardsSub.textContent = "Inserisci una radice nel campo Nome per collegare le carte (in base al campo 'name' di cards.json).");
    myCards.innerHTML = "";
    CURRENT_LINKED_CARDS = [];
    if (statCards) statCards.textContent = "0";
    renderFavoriteShowcase();
    return;
  }

  const all = await loadAllCardsJson();
  const k = norm(root);

  // 1) Preferisci i match "radice" (startsWith), es: "Fork" -> "Fork X", "Fork-1"
  let prefix = all.filter(c => c && norm(c.name).startsWith(k));

  // 2) Se non ci sono match, fai fallback su "contiene"
  let list = prefix.length ? prefix : all.filter(c => c && norm(c.name).includes(k));

  list.sort((a,b)=> (a?.name||"").localeCompare(b?.name||"", "it"));

  if (myCardsSub){
    myCardsSub.textContent = prefix.length
      ? `Trovate ${list.length} carte con nome che inizia con: "${root}"`
      : `Trovate ${list.length} carte con nome che contiene: "${root}"`;
  }
  if (myCardsBtn){
    myCardsBtn.href = `./index.html?q=${encodeURIComponent(root)}`;
  }

  renderLinkedCards(list, root);
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

async function getSeasonProgressData(uid, season) {
  const scopedSnap = await getDoc(doc(db, seasonProgressPath(uid, season)));
  if (scopedSnap.exists()) return scopedSnap.data() || {};

  // Compatibilità: i progress precedenti al nuovo schema sono Stagione 1.
  if (normalizeSeason(season) === LEGACY_SEASON) {
    const legacySnap = await getDoc(doc(db, `users/${uid}/gamepass/progress`));
    if (legacySnap.exists()) {
      const d = legacySnap.data() || {};
      if (recordSeason(d) === LEGACY_SEASON) return d;
    }
  }

  return null;
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

  PROFILE_PREFS = {
    featuredAchievementIds: Array.isArray(data.featuredAchievementIds)
      ? data.featuredAchievementIds.map(String).slice(0, 3)
      : [],
    favoriteCardId: (data.favoriteCardId || "").toString()
  };

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

  const progressData = await getSeasonProgressData(uid, season);
  const xp = Number(progressData?.points || 0) || 0;

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

  CURRENT_SEASON = season;
  CURRENT_TIERS = tiers;
  if (statLevel) statLevel.textContent = String(tierIdx);
  if (statXP) statXP.textContent = fmt(xp);
  if (heroLevel) heroLevel.textContent = `LV. ${tierIdx}`;
  if (heroSeason) heroSeason.textContent = `STAGIONE ${season}`;
  if (heroTierText) heroTierText.textContent = tiers.length ? `Livello ${tierIdx} / ${tiers.length}` : "Game Pass";
  if (heroXpText) heroXpText.textContent = `${fmt(xp)} XP`;

  if (tiers.length) {
    if (tierIdx >= tiers.length) {
      kvNext.textContent = "Completato ✅";
      badgeGP.textContent = "🏁 Pass completato";
      gpBar.style.width = "100%";
      if (heroXpBar) heroXpBar.style.width = "100%";
      gpPct.textContent = "100%";
      gpHint.textContent = "Hai raggiunto l’ultima soglia.";
    } else {
      kvNext.textContent = `${fmt(nextReq)} XP`;
      badgeGP.textContent = `🎯 Prossimo tier: ${tierIdx + 1}`;
      const frac = clamp01((xp - prevReq) / Math.max(1, (nextReq - prevReq)));
      gpBar.style.width = `${Math.round(frac * 100)}%`;
      if (heroXpBar) heroXpBar.style.width = `${Math.round(frac * 100)}%`;
      gpPct.textContent = `${Math.round(frac * 100)}%`;
      gpHint.textContent = `Mancano ${fmt(Math.max(0, nextReq - xp))} XP`;
    }
  } else {
    kvNext.textContent = "—";
    badgeGP.textContent = "Configura i tiers";
    gpBar.style.width = "0%";
    if (heroXpBar) heroXpBar.style.width = "0%";
    gpPct.textContent = "0%";
    gpHint.textContent = "Crea i documenti in gp_tiers.";
  }

  return { season, xp, tiers, tierIdx };
}

function badgeForStatus(s) {
  if (s === "approved") return "✅ approvata";
  if (s === "rejected") return "❌ rifiutata";
  return "⏳ pending";
}

async function loadRequests(uid, season) {
  reqList.innerHTML = "";

  // Nessun nuovo indice necessario: prendiamo le richieste dell'utente e
  // separiamo la stagione lato client. Le richieste legacy = Stagione 1.
  const snap = await getDocs(query(
    collection(db, "requests"),
    where("uid", "==", uid)
  ));

  const allSeasonRows = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => recordSeason(r) === normalizeSeason(season))
    .sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });

  // Stats realmente riferite alla stagione corrente, non solo alle ultime 10.
  statReq.textContent = String(allSeasonRows.length);

  let pending = 0, approved = 0;
  for (const r of allSeasonRows) {
    if (r.status === "pending") pending++;
    if (r.status === "approved") approved++;
  }
  statPending.textContent = String(pending);
  statApproved.textContent = String(approved);

  const rows = allSeasonRows.slice(0, 10);

  if (!rows.length) {
    reqList.append(el("div", { class: "item small" }, [document.createTextNode("Nessuna richiesta in questa stagione.")]));
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

async function loadEarned(uid, season) {
  const earnedMap = new Map();

  const scopedSnap = await getDocs(
    collection(db, seasonEarnedCollectionPath(uid, season))
  );
  for (const d of scopedSnap.docs) earnedMap.set(d.id, { id: d.id, ...d.data() });

  // I vecchi earned sono considerati Stagione 1.
  if (normalizeSeason(season) === LEGACY_SEASON) {
    const legacySnap = await getDocs(collection(db, `users/${uid}/earned`));
    for (const d of legacySnap.docs) {
      if (!earnedMap.has(d.id)) earnedMap.set(d.id, { id: d.id, ...d.data() });
    }
  }

  let catalog = new Map();
  try{
    const achSnap = await getDocs(collection(db, "achievements"));
    catalog = new Map(achSnap.docs.map(d => [d.id, { id:d.id, ...d.data() }]));
  }catch(e){
    console.warn("[profile] catalogo achievement non disponibile", e);
  }

  CURRENT_EARNED = Array.from(earnedMap.values()).map(row => ({
    ...row,
    ...(catalog.get(row.id) || {}),
    id: row.id
  }));

  statEarned.textContent = String(CURRENT_EARNED.length);
  renderFeaturedAchievements();
  return CURRENT_EARNED;
}

function achievementTitle(a){
  return (a?.title || a?.name || a?.label || a?.achievementTitle || a?.id || "Achievement").toString();
}

function achievementDescription(a){
  return (a?.description || a?.desc || a?.subtitle || "").toString();
}

function renderFeaturedAchievements(){
  if (!featuredGrid || !earnedPicker) return;

  const earnedById = new Map(CURRENT_EARNED.map(a => [String(a.id), a]));
  const selected = PROFILE_PREFS.featuredAchievementIds
    .map(String)
    .filter(id => earnedById.has(id))
    .slice(0, 3);

  // Pulisce in memoria eventuali riferimenti ad achievement non più earned.
  PROFILE_PREFS.featuredAchievementIds = selected;

  featuredGrid.innerHTML = "";
  for (let i = 0; i < 3; i++){
    const id = selected[i];
    const a = id ? earnedById.get(id) : null;

    if (!a){
      featuredGrid.append(el("div", { class:"featured-ach empty" }, [
        document.createTextNode(`Slot ${i + 1} • scegli un achievement sotto`)
      ]));
      continue;
    }

    const removeBtn = el("button", { class:"ach-remove", type:"button", title:"Rimuovi dagli achievement in evidenza" }, [
      document.createTextNode("×")
    ]);
    removeBtn.addEventListener("click", async () => {
      try{
        const next = PROFILE_PREFS.featuredAchievementIds.filter(x => String(x) !== String(id));
        await saveProfilePreferences({ featuredAchievementIds: next });
        renderFeaturedAchievements();
      }catch(e){
        console.error(e);
        setStatus(e?.message || "Errore nel salvataggio degli achievement in evidenza.");
      }
    });

    const xp = Number(a.xp || a.points || a.rewardXp || 0) || 0;
    featuredGrid.append(el("div", { class:"featured-ach" }, [
      removeBtn,
      el("div", { class:"ach-icon" }, [document.createTextNode("🏆")]),
      el("div", { class:"ach-title" }, [document.createTextNode(achievementTitle(a))]),
      el("div", { class:"ach-desc" }, [document.createTextNode(achievementDescription(a) || "Achievement completato.")]),
      el("div", { class:"ach-meta" }, [document.createTextNode(xp ? `+${fmt(xp)} XP` : "Completato")])
    ]));
  }

  earnedPicker.innerHTML = "";
  if (!CURRENT_EARNED.length){
    featuredHint.textContent = "Completa un achievement per poterlo mettere in evidenza.";
    return;
  }

  featuredHint.textContent = `Selezionati ${selected.length}/3 • clicca un achievement per aggiungerlo o rimuoverlo.`;

  const pickerRows = CURRENT_EARNED
    .slice()
    .sort((a,b) => achievementTitle(a).localeCompare(achievementTitle(b), "it"))
    .slice(0, 30);

  for (const a of pickerRows){
    const id = String(a.id);
    const active = selected.includes(id);
    const btn = el("button", {
      class:"earned-choice" + (active ? " active" : ""),
      type:"button"
    }, [document.createTextNode((active ? "✓ " : "+ ") + achievementTitle(a))]);

    btn.addEventListener("click", async () => {
      try{
        let next = PROFILE_PREFS.featuredAchievementIds.map(String);
        if (next.includes(id)){
          next = next.filter(x => x !== id);
        }else{
          if (next.length >= 3){
            setStatus("Puoi mettere in evidenza al massimo 3 achievement.");
            return;
          }
          next.push(id);
        }
        await saveProfilePreferences({ featuredAchievementIds: next });
        renderFeaturedAchievements();
        setStatus(`Achievement in evidenza: ${PROFILE_PREFS.featuredAchievementIds.length}/3.`);
      }catch(e){
        console.error(e);
        setStatus(e?.message || "Errore nel salvataggio.");
      }
    });

    earnedPicker.append(btn);
  }
}

async function getSeasonEarnedCount(uid, season){
  const ids = new Set();
  try{
    const scoped = await getDocs(collection(db, seasonEarnedCollectionPath(uid, season)));
    for (const d of scoped.docs) ids.add(d.id);
  }catch(e){}

  if (normalizeSeason(season) === LEGACY_SEASON){
    try{
      const legacy = await getDocs(collection(db, `users/${uid}/earned`));
      for (const d of legacy.docs) ids.add(d.id);
    }catch(e){}
  }
  return ids.size;
}

async function getSeasonClaimsCount(uid, season){
  const ids = new Set();
  try{
    const scoped = await getDocs(collection(db, seasonClaimsCollectionPath(uid, season)));
    for (const d of scoped.docs) ids.add(d.id);
  }catch(e){}

  if (normalizeSeason(season) === LEGACY_SEASON){
    try{
      const legacy = await getDocs(collection(db, `users/${uid}/gp_claims`));
      for (const d of legacy.docs) ids.add(d.id);
    }catch(e){}
  }
  return ids.size;
}

function tierIndexForXp(xp, tiers){
  let idx = 0;
  for (let i = 0; i < tiers.length; i++){
    if (xp >= Number(tiers[i].requiredPoints || 0)) idx = i + 1;
  }
  return idx;
}

async function loadSeasonHistory(uid, currentSeason, tiers){
  if (!seasonHistory) return;
  seasonHistory.innerHTML = "";

  const rows = [];
  for (let season = 1; season <= normalizeSeason(currentSeason); season++){
    const [progress, earnedCount, claimsCount] = await Promise.all([
      getSeasonProgressData(uid, season),
      getSeasonEarnedCount(uid, season),
      getSeasonClaimsCount(uid, season)
    ]);

    const xp = Number(progress?.points || 0) || 0;
    const level = tierIndexForXp(xp, tiers);
    const hasData = !!progress || earnedCount > 0 || claimsCount > 0;

    if (hasData || season === normalizeSeason(currentSeason)){
      rows.push({ season, xp, level, earnedCount, claimsCount });
    }
  }

  rows.sort((a,b) => b.season - a.season);

  if (!rows.length){
    seasonHistory.append(el("div", { class:"small" }, [document.createTextNode("Nessuno storico disponibile.")]));
    return;
  }

  for (const row of rows){
    const card = el("div", { class:"history-card" + (row.season === normalizeSeason(currentSeason) ? " current" : "") }, [
      el("div", { class:"history-season" }, [
        document.createTextNode(`Stagione ${row.season}${row.season === normalizeSeason(currentSeason) ? " • IN CORSO" : ""}`)
      ]),
      el("div", { class:"history-xp" }, [document.createTextNode(`${fmt(row.xp)} XP`)]),
      el("div", { class:"history-meta" }, [
        el("div", {}, [
          el("b", {}, [document.createTextNode(String(row.level))]),
          el("span", {}, [document.createTextNode("Livello")])
        ]),
        el("div", {}, [
          el("b", {}, [document.createTextNode(String(row.earnedCount))]),
          el("span", {}, [document.createTextNode("Achievement")])
        ]),
        el("div", {}, [
          el("b", {}, [document.createTextNode(String(row.claimsCount))]),
          el("span", {}, [document.createTextNode("Premi")])
        ])
      ])
    ]);
    seasonHistory.append(card);
  }
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
    if (statLevel) statLevel.textContent = "0";
    if (statXP) statXP.textContent = "0";
    statEarned.textContent = "0";
    if (statRewards) statRewards.textContent = "0";
    if (statCards) statCards.textContent = "0";
    statReq.textContent = "0";
    statPending.textContent = "0";
    statApproved.textContent = "0";
    if (heroLevel) heroLevel.textContent = "LV. —";
    if (heroSeason) heroSeason.textContent = "STAGIONE —";
    if (heroTierText) heroTierText.textContent = "Livello Game Pass";
    if (heroXpText) heroXpText.textContent = "0 XP";
    if (heroXpBar) heroXpBar.style.width = "0%";
    if (featuredGrid) featuredGrid.innerHTML = "";
    if (earnedPicker) earnedPicker.innerHTML = "";
    if (seasonHistory) seasonHistory.innerHTML = "";
    PROFILE_PREFS = { featuredAchievementIds: [], favoriteCardId: "" };
    CURRENT_UID = null;
    CURRENT_LINKED_CARDS = [];
    CURRENT_EARNED = [];
    renderFavoriteShowcase();
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
  CURRENT_UID = user.uid;

  kvEmail.textContent = user.email || "—";
  kvUid.textContent = user.uid;

  setStatus("Carico profilo…");

  // Carica tutto
  await loadProfile(user.uid, user);
  await updateLinkedCards();

  btnSave.onclick = async () => { await saveProfile(user.uid); await updateLinkedCards(); };

  try {
    const { season, tiers } = await loadGamepass(user.uid);
    await Promise.all([
      loadRequests(user.uid, season),
      loadEarned(user.uid, season)
    ]);
    const rewardCount = await getSeasonClaimsCount(user.uid, season);
    if (statRewards) statRewards.textContent = String(rewardCount);
    await loadSeasonHistory(user.uid, season, tiers);
    renderFavoriteShowcase();
    setStatus(`Profilo aggiornato • Stagione ${season}.`);
  } catch (e) {
    console.error(e);
    setStatus(e?.message || "Errore nel caricare i dati.");
  }
});
