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
  addDoc,
  deleteDoc
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
const catalogTypeCount = qs("#catalogTypeCount");
const btnCatalogReload = qs("#btnCatalogReload");

const typeFormTitle = qs("#typeFormTitle");
const typeCreateId = qs("#typeCreateId");
const typeCreateLabel = qs("#typeCreateLabel");
const typeCreateIcon = qs("#typeCreateIcon");
const typeCreateColor = qs("#typeCreateColor");
const typeCreateColorHex = qs("#typeCreateColorHex");
const typeCreateOrder = qs("#typeCreateOrder");
const typeCreateActive = qs("#typeCreateActive");
const btnCreateType = qs("#btnCreateType");
const btnCancelTypeEdit = qs("#btnCancelTypeEdit");
const typeCreateStatus = qs("#typeCreateStatus");
const typeCatalogSearch = qs("#typeCatalogSearch");
const typeCatalogList = qs("#typeCatalogList");

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
const btnCancelAchievementEdit = qs("#btnCancelAchievementEdit");
const achCreateStatus = qs("#achCreateStatus");
const achFormTitle = qs("#achFormTitle");
const achCatalogSearch = qs("#achCatalogSearch");
const achCatalogList = qs("#achCatalogList");

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
const btnCancelTierEdit = qs("#btnCancelTierEdit");
const tierCreateStatus = qs("#tierCreateStatus");
const tierFormTitle = qs("#tierFormTitle");
const tierCatalogSearch = qs("#tierCatalogSearch");
const tierCatalogList = qs("#tierCatalogList");

let CURRENT_SEASON = 1;
let XP_DIRECTORY = [];
let SELECTED_XP_USER = null;

let ACHIEVEMENT_CATALOG = [];
let TIER_CATALOG = [];
let ACHIEVEMENT_TYPE_CATALOG = [];
let EDITING_ACHIEVEMENT_ID = null;
let EDITING_TIER_ID = null;
let EDITING_TYPE_ID = null;
const LEGACY_TYPE_ORDER = { FUT:10, WWE:20, F1:30, LIVE:40, SOCIAL:50 };
const LEGACY_TYPE_COLOR = {
  FUT:"#B9FF00",
  WWE:"#FF3B30",
  F1:"#EF4444",
  LIVE:"#10D7FF",
  SOCIAL:"#FF2BD6"
};
const AUTO_TYPE_COLORS = [
  "#10D7FF","#B9FF00","#FF2BD6","#FFE500","#FF6B35",
  "#8B5CF6","#22C55E","#F43F5E","#06B6D4","#F59E0B",
  "#14B8A6","#A855F7"
];

function normalizeHexColor(raw, fallback="#10D7FF"){
  const v=(raw||"").toString().trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(v) ? v : fallback;
}
function autoTypeColor(id){
  const key=normalizeTypeId(id);
  if(LEGACY_TYPE_COLOR[key]) return LEGACY_TYPE_COLOR[key];
  let h=0;
  for(let i=0;i<key.length;i++) h=((h*31)+key.charCodeAt(i))>>>0;
  return AUTO_TYPE_COLORS[h%AUTO_TYPE_COLORS.length];
}
function shiftHexColor(hex, amount=-36){
  const c=normalizeHexColor(hex);
  const n=parseInt(c.slice(1),16);
  const r=Math.max(0,Math.min(255,(n>>16)+amount));
  const g=Math.max(0,Math.min(255,((n>>8)&255)+amount));
  const b=Math.max(0,Math.min(255,(n&255)+amount));
  return "#"+[r,g,b].map(v=>v.toString(16).padStart(2,"0")).join("").toUpperCase();
}
function typeColorOf(t){
  return normalizeHexColor(t?.color, autoTypeColor(t?.id||""));
}


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
    const [achSnap, tierSnap, typeSnap] = await Promise.all([
      getDocs(collection(db, "achievements")),
      getDocs(collection(db, "gp_tiers")),
      getDocs(collection(db, "achievement_types"))
    ]);
    ACHIEVEMENT_CATALOG = achSnap.docs.map(d => ({ id:d.id, ...(d.data()||{}) }));
    TIER_CATALOG = tierSnap.docs.map(d => ({ id:d.id, ...(d.data()||{}) }));
    const typeMap = new Map();
    for (const d of typeSnap.docs) {
      const data=d.data()||{}; const id=String(d.id||"").trim().toUpperCase(); if(!id) continue;
      typeMap.set(id,{id,label:(data.label||id).toString(),icon:(data.icon||"").toString(),color:normalizeHexColor(data.color,autoTypeColor(id)),order:Number.isFinite(Number(data.order))?Number(data.order):100,active:data.active!==false,_virtual:false});
    }
    for (const a of ACHIEVEMENT_CATALOG) {
      const id=String(a.type||a.category||a.game||"").trim().toUpperCase();
      if(!id||typeMap.has(id)) continue;
      typeMap.set(id,{id,label:id,icon:"",color:autoTypeColor(id),order:LEGACY_TYPE_ORDER[id]??100,active:true,_virtual:true});
    }
    if(!typeMap.size){
      for(const id of ["FUT","WWE","F1","LIVE","SOCIAL"]) typeMap.set(id,{id,label:id,icon:"",color:autoTypeColor(id),order:LEGACY_TYPE_ORDER[id]??100,active:true,_virtual:true});
    }
    ACHIEVEMENT_TYPE_CATALOG=[...typeMap.values()].sort((a,b)=>(Number(a.order||0)-Number(b.order||0))||a.label.localeCompare(b.label,"it"));
    ACHIEVEMENT_CATALOG.sort((a,b)=>{const ta=(a.type||"").toString(),tb=(b.type||"").toString();if(ta!==tb)return ta.localeCompare(tb,"it");return (a.title||a.name||a.id).toString().localeCompare((b.title||b.name||b.id).toString(),"it")});
    TIER_CATALOG.sort((a,b)=>(Number(a.requiredPoints||0)-Number(b.requiredPoints||0))||String(a.id).localeCompare(String(b.id),"it"));
    catalogAchCount.textContent=String(ACHIEVEMENT_CATALOG.length); catalogTierCount.textContent=String(TIER_CATALOG.length); if(catalogTypeCount) catalogTypeCount.textContent=String(ACHIEVEMENT_TYPE_CATALOG.length);
    populateAchievementTypeSelect(EDITING_ACHIEVEMENT_ID ? (ACHIEVEMENT_CATALOG.find(a=>a.id===EDITING_ACHIEVEMENT_ID)?.type||"") : "");
    renderAchievementCatalog(); renderTierCatalog(); renderTypeCatalog();
  } catch(e) {
    console.warn("loadCatalogSummary",e); catalogAchCount.textContent="?"; catalogTierCount.textContent="?"; if(catalogTypeCount)catalogTypeCount.textContent="?";
    if(achCatalogList)achCatalogList.textContent="Errore nel caricamento Achievement."; if(tierCatalogList)tierCatalogList.textContent="Errore nel caricamento Tier."; if(typeCatalogList)typeCatalogList.textContent="Errore nel caricamento categorie.";
  }
}


function normalizeTypeId(raw){return (raw||"").toString().trim().toUpperCase().replace(/\s+/g,"_")}
function validTypeId(id){return /^[A-Z0-9_-]{1,32}$/.test(id)}
function typeLabel(t){return t?`${t.icon?t.icon+" ":""}${t.label||t.id}`.trim():""}
function populateAchievementTypeSelect(preferred=""){
  if(!achCreateType)return; const wanted=normalizeTypeId(preferred||achCreateType.value||""); achCreateType.innerHTML="";
  let rows=ACHIEVEMENT_TYPE_CATALOG.filter(t=>t.active!==false);
  if(wanted&&!rows.some(t=>t.id===wanted)){const x=ACHIEVEMENT_TYPE_CATALOG.find(t=>t.id===wanted);if(x)rows=[...rows,x]}
  if(!rows.length){const o=document.createElement("option");o.value="";o.textContent="Nessuna categoria disponibile";achCreateType.append(o);return}
  for(const t of rows){const o=document.createElement("option");o.value=t.id;o.textContent=typeLabel(t)+(t.active===false?" (disattiva)":"");achCreateType.append(o)}
  const fallback=rows.find(t=>t.id==="FUT")?.id||rows[0]?.id||""; achCreateType.value=rows.some(t=>t.id===wanted)?wanted:fallback;
}
function resetTypeForm(){EDITING_TYPE_ID=null;typeCreateId.value="";typeCreateId.disabled=false;typeCreateId.classList.remove("catalog-id-locked");typeCreateLabel.value="";typeCreateIcon.value="";typeCreateColor.value="#10d7ff";typeCreateColorHex.value="#10D7FF";typeCreateOrder.value="100";typeCreateActive.checked=true;if(typeFormTitle)typeFormTitle.textContent="Gestione categorie Achievement";btnCreateType.textContent="Crea categoria";if(btnCancelTypeEdit)btnCancelTypeEdit.style.display="none"}
function renderTypeCatalog(){
  if(!typeCatalogList)return;const term=(typeCatalogSearch?.value||"").trim().toLowerCase();const rows=ACHIEVEMENT_TYPE_CATALOG.filter(t=>!term||[t.id,t.label,t.icon].some(v=>(v||"").toString().toLowerCase().includes(term)));typeCatalogList.innerHTML="";
  if(!rows.length){typeCatalogList.append(el("div",{class:"small",style:"padding:10px;"},[document.createTextNode("Nessuna categoria trovata.")]));return}
  for(const t of rows){const used=ACHIEVEMENT_CATALOG.filter(a=>normalizeTypeId(a.type||a.category||a.game||"")===t.id).length;const eb=el("button",{class:"btn",type:"button",onclick:()=>startEditType(t.id)},[document.createTextNode(t._virtual?"Configura":"Modifica")]);const db=el("button",{class:"btn danger",type:"button",onclick:()=>deleteTypeFromPanel(t.id)},[document.createTextNode("Elimina")]);typeCatalogList.append(el("div",{class:"catalog-existing-row"+(EDITING_TYPE_ID===t.id?" catalog-editing":"")},[el("div",{class:"catalog-existing-main"},[el("div",{class:"catalog-existing-name"},[el("span",{class:"category-badge-preview",style:`background:linear-gradient(135deg,${typeColorOf(t)},${shiftHexColor(typeColorOf(t),-42)});`},[document.createTextNode(typeLabel(t))])]),el("div",{class:"catalog-existing-meta"},[document.createTextNode(`${t.id} • ordine ${t.order} • ${used} achievement • ${t.active?"attiva":"disattiva"}${t._virtual?" • legacy/non salvata":""}`)])]),el("div",{class:"catalog-existing-actions"},[eb,db])]))}
}
function startEditType(id){const t=ACHIEVEMENT_TYPE_CATALOG.find(x=>x.id===id);if(!t)return;EDITING_TYPE_ID=id;typeCreateId.value=id;typeCreateId.disabled=true;typeCreateId.classList.add("catalog-id-locked");typeCreateLabel.value=t.label||id;typeCreateIcon.value=t.icon||"";typeCreateColor.value=typeColorOf(t).toLowerCase();typeCreateColorHex.value=typeColorOf(t);typeCreateOrder.value=String(Number(t.order||0));typeCreateActive.checked=t.active!==false;if(typeFormTitle)typeFormTitle.textContent=`Modifica categoria • ${id}`;btnCreateType.textContent=t._virtual?"Salva categoria":"Salva modifiche";if(btnCancelTypeEdit)btnCancelTypeEdit.style.display="";setCatalogStatus(typeCreateStatus,t._virtual?"Categoria legacy: salvando verrà creata in achievement_types.":"Modalità modifica: il codice non può essere cambiato.");renderTypeCatalog();typeCreateLabel.scrollIntoView({behavior:"smooth",block:"center"})}
async function createOrUpdateTypeFromPanel(){
  const id=normalizeTypeId(typeCreateId.value),label=(typeCreateLabel.value||"").trim(),icon=(typeCreateIcon.value||"").trim(),color=normalizeHexColor(typeCreateColorHex?.value||typeCreateColor?.value,autoTypeColor(id)),order=Number(typeCreateOrder.value),active=!!typeCreateActive.checked;
  if(!validTypeId(id)){setCatalogStatus(typeCreateStatus,"Codice non valido. Usa solo lettere, numeri, - e _ (max 32).","catalog-warning");return} if(!label||label.length>50){setCatalogStatus(typeCreateStatus,"Inserisci un nome visualizzato valido.","catalog-warning");return} if(!Number.isInteger(order)||order<0||order>9999){setCatalogStatus(typeCreateStatus,"L'ordine deve essere un intero tra 0 e 9999.","catalog-warning");return}
  const ref=doc(db,"achievement_types",id); try{btnCreateType.disabled=true;const existing=await getDoc(ref),editing=EDITING_TYPE_ID===id;if(!editing&&existing.exists())throw new Error(`Esiste già una categoria con codice "${id}".`);if(!confirm(`${editing||existing.exists()?"Salvare":"Creare"} questa categoria?\n\nCodice: ${id}\nNome: ${label}\nIcona: ${icon||"—"}\nColore: ${color}\nOrdine: ${order}\nAttiva: ${active?"sì":"no"}`))return;if(existing.exists())await updateDoc(ref,{label,icon,color,order,active,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid});else await setDoc(ref,{label,icon,color,order,active,createdAt:serverTimestamp(),createdBy:auth.currentUser.uid});resetTypeForm();setCatalogStatus(typeCreateStatus,`✓ Categoria "${id}" salvata.`,"catalog-ok");await loadCatalogSummary()}catch(e){console.error(e);setCatalogStatus(typeCreateStatus,e?.message||"Errore nel salvataggio della categoria.","catalog-warning")}finally{btnCreateType.disabled=false}
}
async function deleteTypeFromPanel(id){const t=ACHIEVEMENT_TYPE_CATALOG.find(x=>x.id===id);if(!t)return;const used=ACHIEVEMENT_CATALOG.filter(a=>normalizeTypeId(a.type||a.category||a.game||"")===id);if(used.length){alert(`Non puoi eliminare "${id}" perché è usata da ${used.length} Achievement.\n\nSposta prima quegli Achievement in un'altra categoria oppure disattiva la categoria.`);return}if(t._virtual){alert("Questa è una categoria legacy non ancora salvata in achievement_types: non c'è alcun documento da eliminare.");return}if(!confirm(`Eliminare definitivamente la categoria "${typeLabel(t)}" (${id})?`))return;try{await deleteDoc(doc(db,"achievement_types",id));if(EDITING_TYPE_ID===id)resetTypeForm();setCatalogStatus(typeCreateStatus,`✓ Categoria "${id}" eliminata.`,"catalog-ok");await loadCatalogSummary()}catch(e){console.error(e);setCatalogStatus(typeCreateStatus,e?.message||"Errore durante l'eliminazione della categoria.","catalog-warning")}}

function resetAchievementForm() {
  EDITING_ACHIEVEMENT_ID = null;

  achCreateId.value = "";
  achCreateId.disabled = false;
  achCreateId.classList.remove("catalog-id-locked");

  achCreateTitle.value = "";
  achCreateDesc.value = "";
  achCreatePoints.value = "";
  achCreatePrereq.value = "";
  populateAchievementTypeSelect("FUT");
  achCreateActive.checked = true;
  achCreateLinkRequest.checked = false;
  achCreateLinkUrl.value = "";
  achLinkField.style.display = "none";

  if (achFormTitle) achFormTitle.textContent = "Crea Achievement";
  btnCreateAchievement.textContent = "Crea Achievement";
  if (btnCancelAchievementEdit) btnCancelAchievementEdit.style.display = "none";
}

function resetTierForm() {
  EDITING_TIER_ID = null;

  tierCreateId.value = "";
  tierCreateId.disabled = false;
  tierCreateId.classList.remove("catalog-id-locked");

  tierCreateRequired.value = "";
  tierRewardType.value = "card";
  tierRewardRarity.value = "common";
  tierRewardLabel.value = "";
  tierRewardTitle.value = "";
  tierRewardImg.value = "";
  tierRewardOverall.value = "";
  tierCreateActive.checked = true;

  if (tierFormTitle) tierFormTitle.textContent = "Crea Tier";
  btnCreateTier.textContent = "Crea Tier";
  if (btnCancelTierEdit) btnCancelTierEdit.style.display = "none";
}


function renderAchievementCatalog() {
  if (!achCatalogList) return;

  const term = (achCatalogSearch?.value || "").trim().toLowerCase();
  const rows = ACHIEVEMENT_CATALOG.filter(a => {
    if (!term) return true;
    return [
      a.id,
      a.title,
      a.name,
      a.desc,
      a.description,
      a.type
    ].some(v => (v || "").toString().toLowerCase().includes(term));
  });

  achCatalogList.innerHTML = "";

  if (!rows.length) {
    achCatalogList.append(
      el("div", { class:"small", style:"padding:10px;" }, [
        document.createTextNode("Nessun Achievement trovato.")
      ])
    );
    return;
  }

  for (const a of rows) {
    const title = (a.title || a.name || a.id || "Achievement").toString();
    const type = (a.type || "—").toString();
    const points = Number(a.points ?? a.xp ?? 0) || 0;
    const active = a.active !== false;

    const editBtn = el("button", {
      class:"btn",
      type:"button",
      onclick:() => startEditAchievement(a.id)
    }, [document.createTextNode("Modifica")]);

    const deleteBtn = el("button", {
      class:"btn danger",
      type:"button",
      onclick:() => deleteAchievementFromPanel(a.id)
    }, [document.createTextNode("Elimina")]);

    achCatalogList.append(
      el("div", {
        class:"catalog-existing-row" +
          (EDITING_ACHIEVEMENT_ID === a.id ? " catalog-editing" : "")
      }, [
        el("div", { class:"catalog-existing-main" }, [
          el("div", { class:"catalog-existing-name" }, [
            document.createTextNode(title)
          ]),
          el("div", { class:"catalog-existing-meta" }, [
            document.createTextNode(
              `${a.id} • ${type} • ${points} XP • ${active ? "attivo" : "non attivo"}`
            )
          ])
        ]),
        el("div", { class:"catalog-existing-actions" }, [editBtn, deleteBtn])
      ])
    );
  }
}

function renderTierCatalog() {
  if (!tierCatalogList) return;

  const term = (tierCatalogSearch?.value || "").trim().toLowerCase();
  const rows = TIER_CATALOG.filter(t => {
    if (!term) return true;
    const reward = t.reward || {};
    return [
      t.id,
      t.requiredPoints,
      reward.label,
      reward.title,
      reward.type,
      reward.rarity
    ].some(v => (v ?? "").toString().toLowerCase().includes(term));
  });

  tierCatalogList.innerHTML = "";

  if (!rows.length) {
    tierCatalogList.append(
      el("div", { class:"small", style:"padding:10px;" }, [
        document.createTextNode("Nessun Tier trovato.")
      ])
    );
    return;
  }

  for (const t of rows) {
    const reward = t.reward || {};
    const label = (reward.label || reward.title || t.id || "Tier").toString();
    const requiredPoints = Number(t.requiredPoints || 0) || 0;
    const active = t.active !== false;

    const editBtn = el("button", {
      class:"btn",
      type:"button",
      onclick:() => startEditTier(t.id)
    }, [document.createTextNode("Modifica")]);

    const deleteBtn = el("button", {
      class:"btn danger",
      type:"button",
      onclick:() => deleteTierFromPanel(t.id)
    }, [document.createTextNode("Elimina")]);

    tierCatalogList.append(
      el("div", {
        class:"catalog-existing-row" +
          (EDITING_TIER_ID === t.id ? " catalog-editing" : "")
      }, [
        el("div", { class:"catalog-existing-main" }, [
          el("div", { class:"catalog-existing-name" }, [
            document.createTextNode(label)
          ]),
          el("div", { class:"catalog-existing-meta" }, [
            document.createTextNode(
              `${t.id} • ${requiredPoints} XP • ${reward.rarity || "—"} • ${active ? "attivo" : "non attivo"}`
            )
          ])
        ]),
        el("div", { class:"catalog-existing-actions" }, [editBtn, deleteBtn])
      ])
    );
  }
}

function startEditAchievement(id) {
  const a = ACHIEVEMENT_CATALOG.find(x => x.id === id);
  if (!a) return;

  EDITING_ACHIEVEMENT_ID = id;

  achCreateId.value = id;
  achCreateId.disabled = true;
  achCreateId.classList.add("catalog-id-locked");

  achCreateTitle.value = (a.title || a.name || "").toString();
  achCreateDesc.value = (a.desc || a.description || "").toString();
  achCreatePoints.value = String(Number(a.points ?? a.xp ?? 0) || 0);

  const type = normalizeTypeId(a.type || a.category || a.game || "FUT");
  populateAchievementTypeSelect(type);
  achCreateType.value = type;

  const prereq = Array.isArray(a.prereq)
    ? a.prereq
    : (Array.isArray(a.prerequisites) ? a.prerequisites : []);
  achCreatePrereq.value = prereq.join(", ");

  achCreateActive.checked = a.active !== false;
  achCreateLinkRequest.checked = !!a.linkRequest;
  achCreateLinkUrl.value = (a.linkUrl || "").toString();
  achLinkField.style.display = achCreateLinkRequest.checked ? "" : "none";

  if (achFormTitle) achFormTitle.textContent = `Modifica Achievement • ${id}`;
  btnCreateAchievement.textContent = "Salva modifiche";
  if (btnCancelAchievementEdit) btnCancelAchievementEdit.style.display = "";

  setCatalogStatus(achCreateStatus, "Modalità modifica: l'ID non può essere cambiato.");
  renderAchievementCatalog();

  achCreateTitle.scrollIntoView({ behavior:"smooth", block:"center" });
}

function startEditTier(id) {
  const t = TIER_CATALOG.find(x => x.id === id);
  if (!t) return;

  const reward = t.reward || {};
  EDITING_TIER_ID = id;

  tierCreateId.value = id;
  tierCreateId.disabled = true;
  tierCreateId.classList.add("catalog-id-locked");

  tierCreateRequired.value = String(Number(t.requiredPoints || 0) || 0);

  const type = (reward.type || "card").toString().toLowerCase();
  tierRewardType.value = ["card","skin","color","item"].includes(type)
    ? type
    : "item";

  const rarity = (reward.rarity || "common").toString().toLowerCase();
  tierRewardRarity.value = ["common","rare","epic","legendary"].includes(rarity)
    ? rarity
    : "common";

  tierRewardLabel.value = (reward.label || reward.title || "").toString();
  tierRewardTitle.value = (reward.title || reward.label || "").toString();
  tierRewardImg.value = (reward.imgUrl || "").toString();
  tierRewardOverall.value =
    reward.overall === undefined || reward.overall === null
      ? ""
      : String(reward.overall);

  tierCreateActive.checked = t.active !== false;

  if (tierFormTitle) tierFormTitle.textContent = `Modifica Tier • ${id}`;
  btnCreateTier.textContent = "Salva modifiche";
  if (btnCancelTierEdit) btnCancelTierEdit.style.display = "";

  setCatalogStatus(tierCreateStatus, "Modalità modifica: l'ID non può essere cambiato.");
  renderTierCatalog();

  tierCreateRequired.scrollIntoView({ behavior:"smooth", block:"center" });
}

async function deleteAchievementFromPanel(id) {
  const a = ACHIEVEMENT_CATALOG.find(x => x.id === id);
  if (!a) return;

  const usedBy = ACHIEVEMENT_CATALOG
    .filter(other => {
      const prereq = Array.isArray(other.prereq)
        ? other.prereq
        : (Array.isArray(other.prerequisites) ? other.prerequisites : []);
      return other.id !== id && prereq.map(String).includes(String(id));
    })
    .map(other => other.id);

  const title = (a.title || a.name || id).toString();
  let warning =
    `ELIMINARE DEFINITIVAMENTE questo Achievement?\n\n` +
    `ID: ${id}\nTitolo: ${title}\n`;

  if (usedBy.length) {
    warning +=
      `\nATTENZIONE: è usato come prerequisito da:\n` +
      `${usedBy.slice(0,10).join(", ")}${usedBy.length > 10 ? "…" : ""}\n`;
  }

  warning +=
    `\nLe richieste/earned già registrate agli utenti non verranno cancellate automaticamente.` +
    `\n\nPremi OK per confermare.`;

  if (!confirm(warning)) return;

  try {
    await deleteDoc(doc(db, "achievements", id));

    if (EDITING_ACHIEVEMENT_ID === id) resetAchievementForm();

    setCatalogStatus(
      achCreateStatus,
      `✓ Achievement "${id}" eliminato.`,
      "catalog-ok"
    );
    await loadCatalogSummary();
  } catch (e) {
    console.error(e);
    setCatalogStatus(
      achCreateStatus,
      e?.message || "Errore durante l'eliminazione dell'Achievement.",
      "catalog-warning"
    );
  }
}

async function deleteTierFromPanel(id) {
  const t = TIER_CATALOG.find(x => x.id === id);
  if (!t) return;

  const reward = t.reward || {};
  const label = (reward.label || reward.title || id).toString();

  const warning =
    `ELIMINARE DEFINITIVAMENTE questo Tier?\n\n` +
    `ID: ${id}\n` +
    `XP richiesti: ${Number(t.requiredPoints || 0) || 0}\n` +
    `Premio: ${label}\n\n` +
    `ATTENZIONE: eventuali gp_claims già creati per gli utenti NON verranno cancellati automaticamente.` +
    `\n\nPremi OK per confermare.`;

  if (!confirm(warning)) return;

  try {
    await deleteDoc(doc(db, "gp_tiers", id));

    if (EDITING_TIER_ID === id) resetTierForm();

    setCatalogStatus(
      tierCreateStatus,
      `✓ Tier "${id}" eliminato.`,
      "catalog-ok"
    );
    await loadCatalogSummary();
  } catch (e) {
    console.error(e);
    setCatalogStatus(
      tierCreateStatus,
      e?.message || "Errore durante l'eliminazione del Tier.",
      "catalog-warning"
    );
  }
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

  const typeEntry = ACHIEVEMENT_TYPE_CATALOG.find(t => t.id === type);
  if (!typeEntry) { setCatalogStatus(achCreateStatus, "Categoria non valida o non caricata.", "catalog-warning"); return; }
  if (typeEntry.active === false && EDITING_ACHIEVEMENT_ID !== id) { setCatalogStatus(achCreateStatus, "La categoria selezionata è disattivata.", "catalog-warning"); return; }

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
    const isEditing = EDITING_ACHIEVEMENT_ID === id;

    if (!isEditing && existing.exists()) {
      throw new Error(`Esiste già un achievement con ID "${id}".`);
    }
    if (isEditing && !existing.exists()) {
      throw new Error(`L'Achievement "${id}" non esiste più.`);
    }

    const actionLabel = isEditing ? "Salvare le modifiche a" : "Creare";
    const ok = confirm(
      `${actionLabel} questo Achievement?\n\n` +
      `ID: ${id}\n` +
      `Titolo: ${title}\n` +
      `Categoria: ${type}\n` +
      `XP: ${points}\n` +
      `Prerequisiti: ${prereq.length ? prereq.join(", ") : "nessuno"}\n` +
      `Attivo: ${active ? "sì" : "no"}`
    );
    if (!ok) return;

    if (isEditing) {
      await updateDoc(ref, {
        title,
        desc,
        points,
        type,
        active,
        prereq,
        linkRequest,
        linkUrl: linkRequest ? linkUrl : "",
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.uid
      });
    } else {
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
    }

    setCatalogStatus(
      achCreateStatus,
      `✓ Achievement "${id}" ${isEditing ? "aggiornato" : "creato"}.`,
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
    const isEditing = EDITING_TIER_ID === id;

    if (!isEditing && existing.exists()) {
      throw new Error(`Esiste già un Tier con ID "${id}".`);
    }
    if (isEditing && !existing.exists()) {
      throw new Error(`Il Tier "${id}" non esiste più.`);
    }

    const ok = confirm(
      `${isEditing ? "Salvare le modifiche a" : "Creare"} questo Tier?\n\n` +
      `ID: ${id}\n` +
      `XP richiesti: ${requiredPoints}\n` +
      `Premio: ${label}\n` +
      `Tipo: ${type}\n` +
      `Rarità: ${rarity}\n` +
      `Attivo: ${active ? "sì" : "no"}`
    );
    if (!ok) return;

    const existingReward =
      isEditing && existing.exists() && existing.data()?.reward
        ? existing.data().reward
        : {};

    const reward = {
      ...existingReward,
      type,
      rarity,
      label,
      title,
      imgUrl
    };

    if (overall !== null) reward.overall = overall;
    else delete reward.overall;

    if (isEditing) {
      await updateDoc(ref, {
        active,
        requiredPoints,
        reward,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.uid
      });
    } else {
      await setDoc(ref, {
        active,
        requiredPoints,
        reward,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid
      });
    }

    setCatalogStatus(
      tierCreateStatus,
      `✓ Tier "${id}" ${isEditing ? "aggiornato" : "creato"}.`,
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
btnCreateType?.addEventListener("click", createOrUpdateTypeFromPanel);
btnCatalogReload?.addEventListener("click", loadCatalogSummary);
btnCancelTypeEdit?.addEventListener("click", () => { resetTypeForm(); setCatalogStatus(typeCreateStatus, ""); renderTypeCatalog(); });
typeCatalogSearch?.addEventListener("input", renderTypeCatalog);

typeCreateColor?.addEventListener("input", () => {
  if (typeCreateColorHex) typeCreateColorHex.value = typeCreateColor.value.toUpperCase();
});
typeCreateColorHex?.addEventListener("input", () => {
  const v=(typeCreateColorHex.value||"").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v) && typeCreateColor) {
    typeCreateColor.value=v.toLowerCase();
  }
});

btnCancelAchievementEdit?.addEventListener("click", () => {
  resetAchievementForm();
  setCatalogStatus(achCreateStatus, "");
  renderAchievementCatalog();
});

btnCancelTierEdit?.addEventListener("click", () => {
  resetTierForm();
  setCatalogStatus(tierCreateStatus, "");
  renderTierCatalog();
});

achCatalogSearch?.addEventListener("input", renderAchievementCatalog);
tierCatalogSearch?.addEventListener("input", renderTierCatalog);

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
