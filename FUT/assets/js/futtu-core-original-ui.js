'use strict';

/* Motore unico: mantiene DOM, classi, animazioni e grafica del FUTTUFC originale. */
var FUTTU_CONFIG = window.FUTTU_CONFIG;
if (!FUTTU_CONFIG) throw new Error('Configurazione FUTTU_CONFIG non caricata.');

var db = firebase.firestore();
var VALID_GAMES = FUTTU_CONFIG.packs.map(p => p.name);
var PACK_CONFIG_BY_GAME = Object.fromEntries(FUTTU_CONFIG.packs.map(p => [p.name, p]));
var PACK_BACK_BY_GAME = Object.fromEntries(FUTTU_CONFIG.packs.map(p => [p.name, p.cover]));
var PACK_COST_PER_GAME = Object.fromEntries(FUTTU_CONFIG.packs.map(p => [p.name, Number(p.cost || 0)])); // solo valore indicativo
var PACK_LIKE_COST_PER_GAME = Object.fromEntries(FUTTU_CONFIG.packs.map(p => [p.name, Number(p.likeCost ?? p.cost ?? 0)])); // solo valore indicativo
var PACK_SIZE_PER_GAME = Object.fromEntries(FUTTU_CONFIG.packs.map(p => [p.name, Number(p.size || 1)]));
var CONFIG = { CARDS_JSON: FUTTU_CONFIG.cardsSources[0], FETCH_TIMEOUT_MS: 8000 };

var rarityRank={'Comune':0,'Non Comune':1,'Rara':2,'Epica':3,'Ultra Rara':4,'Season':5,'Leggendaria':6};
var norm = (v)=>String(v||'').trim().toLowerCase();
var delay = ms => new Promise(r=>setTimeout(r,ms));
var STORAGE_KEYS = {
  cursors: `futtu_cursors_${FUTTU_CONFIG.id}`,
  finite: `futtu_finite_packs_${FUTTU_CONFIG.id}_v2`
};

var GAME_STATE = {
  selected: FUTTU_CONFIG.defaultPack || VALID_GAMES[0],
  pools: Object.fromEntries(VALID_GAMES.map(g => [g, []])),
  packs: Object.fromEntries(VALID_GAMES.map(g => [g, []])),
  cursor: Object.fromEntries(VALID_GAMES.map(g => [g, 0])),
  opening:false,
  loaded:false
};

Object.assign(window, {
  FUTTU_CONFIG, VALID_GAMES, PACK_CONFIG_BY_GAME, PACK_BACK_BY_GAME,
  PACK_COST_PER_GAME, PACK_LIKE_COST_PER_GAME, PACK_SIZE_PER_GAME, GAME_STATE
});

document.title = FUTTU_CONFIG.pageTitle || document.title;
var metaDescription = document.querySelector('meta[name="description"]');
if (metaDescription) metaDescription.content = FUTTU_CONFIG.description || metaDescription.content;
var staticTitle = document.querySelector('header h1');
var staticSubtitle = document.querySelector('header .subtitle');
if (staticTitle) staticTitle.textContent = `${FUTTU_CONFIG.brand} – Pack Unico`;
if (staticSubtitle) staticSubtitle.innerHTML = `Pacchetti esclusivi <b>${FUTTU_CONFIG.brand}</b>.`;
var myCardsLink = document.getElementById('myCardsBtn');
if (myCardsLink && FUTTU_CONFIG.myCardsUrl) myCardsLink.href = FUTTU_CONFIG.myCardsUrl;
var homeLinks = Array.from(document.querySelectorAll('a.btn')).filter(a => /Torna alla Home/i.test(a.textContent || ''));
homeLinks.forEach(a => { if (FUTTU_CONFIG.homeUrl) a.href = FUTTU_CONFIG.homeUrl; });

/** AUTH */
function waitForFirebaseAuth() {
  const auth = firebase.auth();
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    let unsub = null;
    const done = (user) => {
      try { if (unsub) unsub(); } catch(e) {}
      resolve(user || null);
    };
    unsub = auth.onAuthStateChanged(done, function(err){
      console.warn('[auth state]', err);
      done(null);
    });
  });
}

async function completeGoogleRedirect() {
  const auth = firebase.auth();
  try {
    const result = await auth.getRedirectResult();
    if (result && result.user) {
      await result.user.getIdToken(true);
      return result.user;
    }
  } catch (e) {
    console.error('[Google redirect result]', e);
    throw e;
  }
  return await waitForFirebaseAuth();
}

async function ensureGoogleUser() {
  const auth = firebase.auth();
  let u = auth.currentUser || await waitForFirebaseAuth();

  if (u && !u.isAnonymous) {
    await u.getIdToken(true);
    return u;
  }

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    sessionStorage.setItem('futtu_google_redirect_pending', '1');

    if (u && u.isAnonymous) {
      await u.linkWithRedirect(provider);
    } else {
      await auth.signInWithRedirect(provider);
    }

    throw new Error('redirecting');
  } catch (e) {
    if (e && e.message === 'redirecting') throw e;
    sessionStorage.removeItem('futtu_google_redirect_pending');

    if (e && e.code === 'auth/unauthorized-domain') {
      throw new Error('Dominio fantaballa.it non autorizzato in Firebase Authentication.');
    }
    throw e;
  }
}

/** WALLET */
async function ensureWallet10() {
  const uid = firebase.auth().currentUser.uid;
  const ref = db.collection('users').doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      const now = firebase.firestore.FieldValue.serverTimestamp();
      tx.set(ref, { points: 10, createdAt: now, updatedAt: now });
    }
  });
}
async function debitPackCostOrThrow(cost) {
  // I costi dei pack sono SOLO indicativi: l'apertura non scala mai punti/monete/like.
  return await getCurrentPoints();
}
async function getCurrentPoints(){
  const u = firebase.auth().currentUser;
  if (!u) return 0;
  const snap = await db.collection('users').doc(u.uid).get();
  return snap.exists ? Number(snap.data().points || 0) : 0;
}

/** PUNTI UI */
var pointsBadge = document.getElementById('pointsBadge');
var openBtn = document.getElementById('openBtn');
var bonusBtn = document.getElementById('bonusBtn');
var unsubPoints = null;
var lastDailyAtMs = 0;
function formatHhMm(ms){
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function updateBonusUI(){
  if (!bonusBtn) return;
  const DAY_MS = 24*60*60*1000;
  const elapsed = lastDailyAtMs ? Date.now() - lastDailyAtMs : Infinity;
  bonusBtn.textContent = elapsed >= DAY_MS ? '🎁 Apri' : `⏱️ Attendi ${formatHhMm(DAY_MS-elapsed)}`;
  bonusBtn.disabled = false;
  bonusBtn.style.display = '';
}
setInterval(updateBonusUI, 60*1000);
async function initPointsUI(){
  try{
    const user = firebase.auth().currentUser || await waitForFirebaseAuth();
    if (!user || user.isAnonymous){
      pointsBadge.innerHTML = '🔐 Accedi con Google';
      pointsBadge.style.cursor = 'pointer';
      pointsBadge.onclick = async ()=>{
        try{ const u=await ensureGoogleUser(); if(!u)return; await ensureWallet10(); setTimeout(initPointsUI,0); }
        catch(e){ if(e.message!=='redirecting') console.error(e); }
      };
      openBtn.disabled = true;
      updateBonusUI();
      return;
    }
    await ensureWallet10();
    const ref = db.collection('users').doc(user.uid);
    if (unsubPoints) unsubPoints();
    unsubPoints = ref.onSnapshot((snap)=>{
      const data=snap.exists?snap.data():{};
      const pts=Number(data.points||0);
      const last=data.lastDailyAt;
      lastDailyAtMs=last&&typeof last.toMillis==='function'?last.toMillis():(typeof last==='number'?last:0);
      pointsBadge.textContent=`Punti: ${pts}`;
      updateBonusUI();
      updateOpenBtnEnabled();
    });
  }catch(e){
    if(e.message==='redirecting')return;
    console.error('[initPointsUI]',e);
    if(pointsBadge)pointsBadge.textContent='Punti: —';
    if(openBtn)openBtn.disabled=true;
  }
}
if (bonusBtn){
  bonusBtn.addEventListener('click',async()=>{
    const log=document.getElementById('log');
    try{
      let u=firebase.auth().currentUser;
      if(!u||u.isAnonymous)u=await ensureGoogleUser();
      await ensureWallet10();
      const ref=db.collection('users').doc(u.uid);
      await db.runTransaction(async(tx)=>{
        const snap=await tx.get(ref); if(!snap.exists)throw new Error('wallet-missing');
        const pts=Number(snap.data().points||0); const now=firebase.firestore.FieldValue.serverTimestamp();
        tx.update(ref,{points:pts+1,lastDailyAt:now,updatedAt:now});
      });
      lastDailyAtMs=Date.now(); updateBonusUI(); log.textContent='🎉 Bonus ottenuto! (max 1 ogni 24h)'; bonusBtn.disabled=true;
    }catch(e){
      if((e&&e.code)==='permission-denied')log.textContent='⏱️ Bonus già usato nelle ultime 24 ore.';
      else{log.textContent='⚠️ Impossibile ottenere il bonus ora.';console.error(e);}
    }finally{setTimeout(()=>{bonusBtn.disabled=false;},800);}
  });
}

/** AUDIO ORIGINALE */
var audioCtx=null;
function ensureAudio(){try{if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();}catch{}}
function tone(f,d=.15,g=.08,t='sine'){if(!audioCtx)return;const o=audioCtx.createOscillator(),A=audioCtx.createGain();o.type=t;o.frequency.value=f;A.gain.value=g;o.connect(A).connect(audioCtx.destination);o.start();A.gain.setTargetAtTime(0,audioCtx.currentTime+d,.3);o.stop(audioCtx.currentTime+d+.08);}
function noiseBoom(d=.5,g=.15){if(!audioCtx)return;const N=audioCtx.sampleRate*d,b=audioCtx.createBuffer(1,N,audioCtx.sampleRate),x=b.getChannelData(0);for(let i=0;i<N;i++)x[i]=(Math.random()*2-1)*Math.pow(1-i/N,2);const s=audioCtx.createBufferSource();s.buffer=b;const A=audioCtx.createGain();A.gain.value=g;const F=audioCtx.createBiquadFilter();F.type='lowpass';F.frequency.value=400;s.connect(F).connect(A).connect(audioCtx.destination);s.start();A.gain.setTargetAtTime(0,audioCtx.currentTime+d*.7,2);}
function playByRarity(r){if(r==='Comune'||r==='Non Comune'){tone(520,.07,.06,'triangle');tone(660,.07,.05,'triangle');}else if(r==='Rara'){tone(660,.12,.08,'sine');tone(880,.16,.06,'sine');}else if(r==='Epica'){tone(660,.18,.09,'sine');tone(990,.22,.08,'sine');tone(1320,.24,.06,'sine');}else if(r==='Ultra Rara'||r==='Season'){noiseBoom(.7,.18);tone(880,.18,1,'square');tone(1320,.22,.08,'square');}else if(r==='Leggendaria'){noiseBoom(.9,.22);tone(1320,.22,.9,'square');tone(1760,.26,.09,'square');}}

/** INVENTARIO */
var safeDocId=(id)=>String(id||Math.random().toString(36).slice(2)).replace(/[\/#?\[\]]/g,'_').slice(0,120);
async function saveInventario(cards){
  const u=firebase.auth().currentUser;
  if(!u||u.isAnonymous)throw new Error('login-required');
  const batch=db.batch();const now=firebase.firestore.FieldValue.serverTimestamp();
  for(const c of cards){
    const ref=db.collection('users').doc(u.uid).collection('inventory').doc(safeDocId(c.id));
    batch.set(ref,{name:c.name,rarity:c.rarity,series:c.series||'',game:c.game||'',mode:FUTTU_CONFIG.id,img:c.img||'',count:firebase.firestore.FieldValue.increment(1),updatedAt:now},{merge:true});
  }
  await batch.commit();
}

/** FILTRI CONFIGURABILI */
function normalizeCard(c){
  return {
    id:String(c.id??`${c.name||'card'}-${Math.random().toString(36).slice(2,8)}`),
    name:String(c.name||''),rarity:String(c.rarity||''),img:String(c.img||''),
    series:String(c.series||''),game:String(c.game||''),text:String(c.text||''),
    role:String(c.role||''),quantity:Number(c.quantity||0),tags:Array.isArray(c.tags)?c.tags.map(String):[]
  };
}
function isModeCard(c){return (FUTTU_CONFIG.cardGameNames||[]).map(norm).includes(norm(c.game));}
function isSharedCard(c){return (FUTTU_CONFIG.sharedGameNames||[]).map(norm).includes(norm(c.game));}
function matchesList(value,list){return !Array.isArray(list)||!list.length||list.map(norm).includes(norm(value));}
function includesAny(values,needles){
  if(!Array.isArray(needles)||!needles.length)return true;
  const hay=(Array.isArray(values)?values:[values]).map(norm);
  return needles.map(norm).some(n=>hay.some(v=>v.includes(n)));
}
function matchesScope(c,scope){
  if(!scope||scope==='mode')return isModeCard(c);
  if(scope==='shared')return isSharedCard(c);
  if(scope==='mode-or-shared')return isModeCard(c)||isSharedCard(c);
  if(scope==='all')return true;
  return false;
}
function matchesSpec(c,spec={}){
  if(!matchesScope(c,spec.scope))return false;
  if(spec.series&&!matchesList(c.series,spec.series))return false;
  if(spec.rarity&&!matchesList(c.rarity,spec.rarity))return false;
  if(spec.roles&&!matchesList(c.role,spec.roles))return false;
  if(spec.excludeSeries&&matchesList(c.series,spec.excludeSeries))return false;
  if(spec.excludeRarity&&matchesList(c.rarity,spec.excludeRarity))return false;
  if(spec.tagsAny&&!includesAny(c.tags,spec.tagsAny))return false;
  if(spec.nameIncludesAny&&!includesAny(c.name,spec.nameIncludesAny))return false;
  if(Array.isArray(spec.anyOf)&&spec.anyOf.length&&!spec.anyOf.some(part=>matchesSpec(c,Object.assign({},spec,{anyOf:null},part))))return false;
  return true;
}
function shuffleInPlace(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function pickDistinct(source,n,excludeIds=new Set()){
  const arr=shuffleInPlace((source||[]).slice());const seen=new Set(excludeIds);const out=[];
  for(const c of arr){if(c&&c.id&&!seen.has(c.id)){out.push(c);seen.add(c.id);if(out.length>=n)break;}}
  return out;
}
function buildFinitePacks(cards,size){
  const arr=shuffleInPlace((cards||[]).slice());const packs=[];
  for(let i=0;i<arr.length;i+=size)packs.push(arr.slice(i,i+size));
  if(size>1&&packs.length>1&&packs[packs.length-1].length===1){const prev=packs[packs.length-2],last=packs[packs.length-1];if(prev.length>2)last.unshift(prev.pop());}
  return packs.filter(p=>p.length>0);
}
function readFiniteStore(){try{return JSON.parse(localStorage.getItem(STORAGE_KEYS.finite)||'{}')||{};}catch{return {};}}
function writeFiniteStore(store){try{localStorage.setItem(STORAGE_KEYS.finite,JSON.stringify(store||{}));}catch{}}
function finiteSignature(game,cards,size){return JSON.stringify({game,size,ids:(cards||[]).map(c=>String(c.id)).sort()});}
function restoreOrBuildFinitePacks(game,cards,size,builder=buildFinitePacks){
  const signature=finiteSignature(game,cards,size);const store=readFiniteStore();const saved=store[game];const byId=new Map(cards.map(c=>[String(c.id),c]));
  if(saved&&saved.signature===signature&&Array.isArray(saved.packs)){
    const restored=saved.packs.map(ids=>ids.map(id=>byId.get(String(id))).filter(Boolean)).filter(p=>p.length);
    const expected=saved.packs.reduce((s,p)=>s+p.length,0),actual=restored.reduce((s,p)=>s+p.length,0);
    if(restored.length&&expected===actual)return restored;
  }
  const built=builder(cards,size);
  store[game]={signature,createdAt:Date.now(),packs:built.map(p=>p.map(c=>String(c.id)))};writeFiniteStore(store);return built;
}
function clearFiniteStore(game){const s=readFiniteStore();if(game)delete s[game];else Object.keys(s).forEach(k=>delete s[k]);writeFiniteStore(s);}
function isInfinitePack(game){return ['infinite','composite','gotham-legend-infinite'].includes((PACK_CONFIG_BY_GAME[game]||{}).kind);}

async function fetchCards(){
  let lastError=null;
  const attempted=[];
  for(const source of FUTTU_CONFIG.cardsSources||[]){
    const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),CONFIG.FETCH_TIMEOUT_MS);
    try{
      attempted.push(source);
      const res=await fetch(source,{cache:'no-store',signal:ctrl.signal});
      if(!res.ok)throw new Error(`${source}: HTTP ${res.status}`);
      const json=await res.json();
      if(!Array.isArray(json))throw new Error(`${source}: formato JSON non valido`);
      if(!json.length)throw new Error(`${source}: archivio carte vuoto`);
      console.info(`[FUTTU] Carte caricate da ${source}: ${json.length}`);
      return json;
    }
    catch(e){lastError=e;console.warn('[FUTTU] Sorgente carte non disponibile:',source,e);}
    finally{clearTimeout(timer);}
  }
  const detail=lastError&&lastError.message?lastError.message:'nessun dettaglio';
  throw new Error(`Impossibile caricare le carte. Sorgenti provate: ${attempted.join(', ')}. Ultimo errore: ${detail}`);
}
function buildFantaballaLegend(pool,size){
  const rarePlus=pool.filter(c=>['rara','epica','ultra rara','leggendaria'].includes(norm(c.rarity)));
  const match=(c,re)=>re.test(String(c.name||''))||(Array.isArray(c.tags)&&c.tags.some(t=>re.test(String(t||''))));
  const sen=rarePlus.filter(c=>match(c,/senatore/i));
  const leg=rarePlus.filter(c=>match(c,/\blegend\b/i));
  const hof=rarePlus.filter(c=>match(c,/hall\s*of\s*fame/i));
  const base=rarePlus.filter(c=>!match(c,/senatore/i)&&!match(c,/\blegend\b/i)&&!match(c,/hall\s*of\s*fame/i));
  const packs=buildFinitePacks(base,size).map(p=>p.slice(0,size));
  function inject(bag,p){const choices=bag.filter(c=>!p.some(x=>x.id===c.id));if(!choices.length)return false;p[Math.floor(Math.random()*p.length)]=choices[Math.floor(Math.random()*choices.length)];return true;}
  packs.forEach(p=>{let done=false;if(!done&&Math.random()<1/5)done=inject(sen,p);if(!done&&Math.random()<1/10)done=inject(leg,p);if(!done&&Math.random()<1/15)inject(hof,p);});
  const used=new Set();return packs.filter(p=>{const sig=[...new Set(p.map(c=>c.id))].sort().join('+');if(used.has(sig))return false;used.add(sig);return true;});
}
function buildPool(pack,cards){
  let pool=cards.filter(c=>matchesSpec(c,pack));
  if(pack.weightByRarity){pool=pool.flatMap(c=>Array(Number(pack.weightByRarity[c.rarity]||pack.weightByRarity[norm(c.rarity)]||1)).fill(c));}
  if(Number(pack.copies||1)>1)pool=pool.flatMap(c=>Array(Number(pack.copies)).fill(c));
  return pool;
}
async function loadCards(){
  try{
    const raw=await fetchCards();const ids=new Set();const cleaned=[];
    raw.map(normalizeCard).forEach(c=>{if(!c.name||!c.rarity||ids.has(c.id))return;ids.add(c.id);cleaned.push(c);});
    window.cleaned=cleaned;
    for(const game of VALID_GAMES){
      const pack=PACK_CONFIG_BY_GAME[game];
      const pool=buildPool(pack,cleaned);GAME_STATE.pools[game]=pool;
      if(pack.kind==='composite'){
        const parts=pack.parts||[];
        GAME_STATE.pools[`${game}_oggs`]=parts[0]?cleaned.filter(c=>matchesSpec(c,parts[0])):[];
        GAME_STATE.pools[`${game}_main`]=parts[1]?cleaned.filter(c=>matchesSpec(c,parts[1])):[];
        GAME_STATE.pools[game]=Array.from(new Map([...GAME_STATE.pools[`${game}_oggs`],...GAME_STATE.pools[`${game}_main`]].map(c=>[c.id,c])).values());
        GAME_STATE.packs[game]=[];
      }else if(pack.kind==='finite'){
        const builder=(cards,size)=>{
          const built=buildFinitePacks(cards,size);
          if(!pack.uniqueWithinPack)return built;
          return built.map(p=>{const seen=new Set();return p.filter(c=>!seen.has(c.id)&&seen.add(c.id));}).filter(p=>p.length);
        };
        GAME_STATE.packs[game]=restoreOrBuildFinitePacks(game,pool,pack.size,builder);
      }else if(pack.kind==='fantaballa-legend-finite'){
        GAME_STATE.packs[game]=restoreOrBuildFinitePacks(game,pool,pack.size,(cards,size)=>buildFantaballaLegend(cards,size));
      }else GAME_STATE.packs[game]=[];
    }
    try{
      const saved=JSON.parse(localStorage.getItem(STORAGE_KEYS.cursors)||'{}');
      for(const g of VALID_GAMES)GAME_STATE.cursor[g]=Number(saved[g]||0);
    }catch{}
    GAME_STATE.loaded=true;
    renderGamePicker();applyPackVisual();updateOpenBtnEnabled();
    const counts=VALID_GAMES.map(g=>`${g} ${GAME_STATE.pools[g]?.length||0}`).join(', ');
    document.getElementById('log').textContent=`Caricate: ${counts}.`;
  }catch(err){
    console.error('Errore caricamento carte:',err);
    document.getElementById('log').textContent='⚠️ Errore nel caricamento delle carte. Verifica che data/cards.json sia pubblicato insieme al progetto.';
  }
}

/** UI ORIGINALE */
var pricePill=document.getElementById('pricePill');
var resetPacksBtn=document.getElementById('resetPacksBtn');
var gamePicker=document.getElementById('gamePicker');
var packEl=document.getElementById('pack');

/*
 * Ripristina sempre il pacchetto dopo l'animazione di apertura.
 * L'animazione packOpen usa fill-mode: forwards e termina con opacity:0:
 * senza rimuovere la classe `opening`, le aperture successive lasciano
 * l'area cliccabile ma il pacchetto invisibile.
 */
function resetPackPreviewState(restoreArea=true){
  const area=document.getElementById('packArea');
  const pack=document.getElementById('pack');
  if(pack){
    pack.classList.remove('opening','shake');
    if(typeof pack.getAnimations==='function'){
      pack.getAnimations().forEach(anim=>{
        const name=String(anim.animationName||'');
        if(name==='packOpen'||name==='shake'){
          try{anim.cancel();}catch(e){}
        }
      });
    }
    pack.style.removeProperty('animation');
    pack.style.removeProperty('opacity');
    pack.style.removeProperty('transform');
    pack.style.removeProperty('filter');
    pack.style.removeProperty('visibility');
    void pack.offsetWidth;
  }
  if(area){
    area.classList.remove('ut-pack-opening');
    if(restoreArea) area.style.removeProperty('display');
  }
}
function packsLeft(game){return Math.max(0,(GAME_STATE.packs[game]||[]).length-(GAME_STATE.cursor[game]||0));}
function cardCount(game){
  const pack=PACK_CONFIG_BY_GAME[game];
  if(pack&&pack.kind==='composite')return (GAME_STATE.pools[`${game}_oggs`]?.length||0)+(GAME_STATE.pools[`${game}_main`]?.length||0);
  return GAME_STATE.pools[game]?.length||0;
}
function renderPacksStrip(){
  const strip=document.getElementById('packsStrip');if(!strip)return;strip.innerHTML='';
  const games=(typeof window.getVisibleGames==='function'?window.getVisibleGames():VALID_GAMES);
  games.forEach(game=>{
    const total=(GAME_STATE.packs[game]||[]).length,left=packsLeft(game),card=document.createElement('div');
    card.className='featured-card';card.dataset.game=game;
    card.innerHTML=`<img src="${PACK_BACK_BY_GAME[game]}" alt="${game}"><div style="margin-top:6px;font-weight:700">${game}</div><div class="featured-cost">${isInfinitePack(game)?'∞':`${left}/${total}`} pacchi</div>`;
    card.addEventListener('click',()=>{GAME_STATE.selected=game;applyPackVisual();updateOpenBtnEnabled();});strip.appendChild(card);
  });
}
function renderGamePicker(){
  if(!gamePicker)return;const frag=document.createDocumentFragment();gamePicker.innerHTML='';
  const games=(typeof window.getVisibleGames==='function'?window.getVisibleGames():VALID_GAMES);
  games.forEach(game=>{
    const total=(GAME_STATE.packs[game]||[]).length,left=packsLeft(game),btn=document.createElement('button');btn.type='button';btn.className='choice';btn.dataset.game=game;btn.setAttribute('aria-selected',String(GAME_STATE.selected===game));
    btn.innerHTML=`<div class="prev" style="background-image:url('${PACK_BACK_BY_GAME[game]}')"></div><div class="meta"><span class="name">${game}</span><span class="price">${isInfinitePack(game)?'∞ pacchetti':`${left}/${total} pacchetti`} • ${cardCount(game)} carte</span></div>`;
    btn.addEventListener('click',()=>{GAME_STATE.selected=game;applyPackVisual();updateOpenBtnEnabled();});frag.appendChild(btn);
  });gamePicker.appendChild(frag);pricePill.textContent='Apertura: GRATIS';
}
function applyPackVisual(){
  resetPackPreviewState(true);
  const back=PACK_BACK_BY_GAME[GAME_STATE.selected]||PACK_BACK_BY_GAME[VALID_GAMES[0]];
  if(packEl){
    packEl.style.backgroundImage=`url('${back}')`;
    packEl.style.opacity='1';
    packEl.style.visibility='visible';
  }
  if(pricePill)pricePill.textContent='Apertura: GRATIS';
}
function updateOpenBtnEnabled(){
  const game=GAME_STATE.selected,pack=PACK_CONFIG_BY_GAME[game],left=packsLeft(game);
  // Il saldo non abilita/disabilita mai il pack: i costi sono soltanto un riferimento visivo.
  openBtn.disabled=GAME_STATE.opening||(!isInfinitePack(game)&&left<=0)||!GAME_STATE.loaded;
  renderGamePicker();renderPacksStrip();
}

resetPacksBtn?.addEventListener('click',async()=>{
  try{
    document.getElementById('log').textContent='♻️ Mischio i pacchetti...';
    VALID_GAMES.forEach(g=>{GAME_STATE.cursor[g]=0;GAME_STATE.packs[g]=[];});
    localStorage.removeItem(STORAGE_KEYS.cursors);clearFiniteStore();GAME_STATE.loaded=false;await loadCards();
    document.getElementById('log').textContent='✅ Pacchetti rimescolati.';
  }catch(e){console.warn(e);document.getElementById('log').textContent='⚠️ Reset non riuscito.';}
});
window.resetSinglePack=function(game){
  if(!PACK_CONFIG_BY_GAME[game])return;GAME_STATE.cursor[game]=0;clearFiniteStore(game);
  try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEYS.cursors)||'{}');saved[game]=0;localStorage.setItem(STORAGE_KEYS.cursors,JSON.stringify(saved));}catch{}
  GAME_STATE.loaded=false;loadCards().then(()=>{document.getElementById('log').textContent=`♻️ Reset: ${game}`;});
};

/** CARTE E ANIMAZIONI ORIGINALI */
function initialsFromName(name){const w=String(name||'Carta').trim().split(/\s+/).filter(Boolean);return(w.length>=2?w[0][0]+w[1][0]:w[0].slice(0,2)).toUpperCase();}
function addSimpleFallback(face,d){
  if(!face||face.querySelector('.new-card-placeholder'))return;const p=document.createElement('div');p.className='new-card-placeholder';p.innerHTML=`<div class="new-card-topline"><span class="new-card-new-badge">NEW</span><span class="new-card-rarity">${d.rarity||''}</span></div><div class="new-card-icon">${initialsFromName(d.name)}</div><h3 class="new-card-title">${d.name||'Carta'}</h3><div class="new-card-subtitle">Grafica in arrivo</div><div class="new-card-series">${d.series||d.game||''}</div>`;face.appendChild(p);
}
function makeCardEl(d,isFinal){
  const tpl=document.getElementById('tplCard'),n=tpl.content.firstElementChild.cloneNode(true),backImg=n.querySelector('.back img');
  if(backImg){backImg.src=PACK_BACK_BY_GAME[GAME_STATE.selected]||'';backImg.alt=`Retro carta – ${GAME_STATE.selected}`;}
  const rslug=String(d.rarity||'').toLowerCase().replace(/\s+/g,'-');if(rslug)n.classList.add('r-'+rslug);if(isFinal)n.classList.add('final');
  const face=n.querySelector('.front'),front=n.querySelector('.front img');
  if(d.img){front.src=d.img;front.alt=`Carta ${d.name||''}`;front.loading='lazy';front.decoding='async';front.addEventListener('error',()=>{front.style.display='none';addSimpleFallback(face,d);},{once:true});}
  else{front.style.display='none';addSimpleFallback(face,d);}
  n.querySelector('.badge').textContent=d.rarity||'';n.dataset.state='back';n.addEventListener('click',()=>{if(n.dataset.state==='back')revealCard(n,d);else{n.dataset.state='back';n.classList.remove('revealed');}},{passive:true});return n;
}
function addSparks(el,n=10){let cont=el.querySelector('.spark');if(!cont){cont=document.createElement('div');cont.className='spark';el.appendChild(cont);}cont.innerHTML='';const frag=document.createDocumentFragment();for(let i=0;i<n;i++){const s=document.createElement('i'),x=10+Math.random()*80,xEnd=x+(-8+Math.random()*16),rot=-15+Math.random()*30;s.style.setProperty('--x',x+'%');s.style.setProperty('--xEnd',xEnd+'%');s.style.setProperty('--rot',rot+'deg');s.style.left=x+'%';s.style.top=(5+Math.random()*20)+'%';frag.appendChild(s);}cont.appendChild(frag);}
function revealCard(n,d){n.dataset.state='front';n.classList.add('revealed');const rank=rarityRank[d.rarity]??0;addSparks(n,Math.min(6+rank*4,28));playByRarity(d.rarity);if(norm(d.rarity)==='leggendaria')n.classList.add('legendaryPulse');}
function setDropIn(el,i,extra=0){el.classList.add('drop');setTimeout(()=>el.classList.add('in'),120*i+extra);}
function showStage(cards){const wrap=document.getElementById('stageWrap'),stage=document.getElementById('stage');stage.innerHTML='';wrap.classList.add('show');const last=cards.length-1,frag=document.createDocumentFragment();cards.forEach((c,i)=>{const el=makeCardEl(c,i===last);frag.appendChild(el);setDropIn(el,i);});stage.appendChild(frag);document.getElementById('log').textContent='Pacchetto pronto. Tocca le carte per rivelarle.';}

function generateComposite(pack){
  const chosen=[],used=new Set();
  for(const part of pack.parts||[]){const pool=window.cleaned.filter(c=>matchesSpec(c,part));const picks=pickDistinct(pool,Number(part.count||0),used);picks.forEach(c=>{chosen.push(c);used.add(c.id);});if(picks.length<Number(part.count||0))throw new Error('pool-insufficiente');}
  return chosen;
}
function generateGothamLegend(pack){
  const all=GAME_STATE.pools[pack.name]||[];const special=id=>{const s=norm(id);return s.includes('senatore')||s.includes('leggendaria')||s.includes('hall of fame');};
  let normal=all.filter(c=>['rara','ultra rara'].includes(norm(c.rarity))&&!special(c.id));if(!normal.length)normal=all;
  if(!normal.length)return[];
  const rand=Math.random()*100;let needle=rand<10?'leggendaria':rand<17?'hall of fame':rand<37?'senatore':'';
  let finalPool=needle?all.filter(c=>norm(c.id).includes(needle)):normal;if(!finalPool.length)finalPool=normal;
  const first=pickDistinct(normal,2),used=new Set(first.map(c=>c.id)),final=pickDistinct(finalPool,1,used)[0]||finalPool[Math.floor(Math.random()*finalPool.length)];return[...first,final].filter(Boolean);
}
function choosePack(game){
  const pack=PACK_CONFIG_BY_GAME[game];
  if(pack.kind==='composite')return generateComposite(pack);
  if(pack.kind==='gotham-legend-infinite')return generateGothamLegend(pack);
  if(pack.kind==='infinite'){
    const pool=GAME_STATE.pools[game]||[];if(!pool.length)throw new Error('pool-vuota');return Array.from({length:pack.size||1},()=>pool[Math.floor(Math.random()*pool.length)]);
  }
  const list=GAME_STATE.packs[game]||[],idx=Number(GAME_STATE.cursor[game]||0);if(idx>=list.length||!Array.isArray(list[idx])||!list[idx].length)throw new Error('pacchetti-finiti');
  const chosen=list[idx].slice();GAME_STATE.cursor[game]=idx+1;try{localStorage.setItem(STORAGE_KEYS.cursors,JSON.stringify(GAME_STATE.cursor));}catch{}return chosen;
}

var flashLine=document.getElementById('flashLine'),flashScreen=document.getElementById('flashScreen'),packArea=document.getElementById('packArea'),packBox=document.getElementById('pack');
document.addEventListener('click',()=>{try{ensureAudio();}catch{}},{once:true});
openBtn.addEventListener('click', async () => {
  if (GAME_STATE.opening) return;

  GAME_STATE.opening = true;
  updateOpenBtnEnabled();

  const game = GAME_STATE.selected;
  const packConfig = PACK_CONFIG_BY_GAME[game] || {};
  const cost = PACK_COST_PER_GAME[game] || 0;
  const log = document.getElementById('log');

  const abort = (message) => {
    if (message && log) log.textContent = message;
    resetPackPreviewState(true);
    flashLine.classList.remove('active');
    flashScreen.classList.remove('active');
    GAME_STATE.opening = false;
    updateOpenBtnEnabled();
  };

  try {
    // L'apertura è sempre gratuita. Il login serve solo per salvare le carte nell'inventario.
    let user = firebase.auth().currentUser;
    if (!user || user.isAnonymous) user = await ensureGoogleUser();
    await ensureWallet10();
    if (log) log.textContent = '🆓 Apertura gratuita. I valori mostrati sotto ai pack sono solo indicativi.';
  } catch (error) {
    if (error.message === 'redirecting') {
      GAME_STATE.opening = false;
      return;
    }
    const code = error.code || error.message || 'unknown';
    let message = '⚠️ Impossibile avviare il pacchetto.';
    if (code === 'login-required') message = '🔐 Accedi con Google per salvare le carte.';
    else if (code === 'permission-denied') message = '⛔ Permessi Firestore insufficienti.';
    else if (code === 'unavailable') message = '📡 Sei offline o Firestore non è raggiungibile.';
    abort(`${message} (${code})`);
    return;
  }

  if (!GAME_STATE.loaded) await loadCards();

  let chosen;
  try {
    chosen = choosePack(game);
  } catch (error) {
    const message = error.message === 'pacchetti-finiti'
      ? '❌ Pacchetti esauriti per questo game.'
      : error.message === 'pool-insufficiente'
        ? '⚠️ Pool insufficiente per generare il pacchetto.'
        : `⚠️ Nessuna carta disponibile per ${game}.`;
    abort(message);
    return;
  }

  const hasLegend = chosen.some(card => norm(card.rarity) === 'leggendaria');
  if (packConfig.kind !== 'composite') {
    chosen.sort((a, b) => (rarityRank[a.rarity] || 0) - (rarityRank[b.rarity] || 0));
  }

  /* Salva prima della sequenza cinematografica: se l'utente chiude la pagina
     durante il reveal, le carte sono già state registrate nell'inventario. */
  let saveError = null;
  try {
    await saveInventario(chosen);
  } catch (error) {
    saveError = error;
    console.error('[saveInventario]', error);
  }

  const premiumOpening = window.FUTTU_PACK_OPENING;
  const usedPremiumOpening = !!(premiumOpening && typeof premiumOpening.play === 'function');
  if (usedPremiumOpening) {
    resetPackPreviewState(true);
    try {
      await premiumOpening.play({
        mode: FUTTU_CONFIG.id,
        game,
        packName: game,
        cover: PACK_BACK_BY_GAME[game] || '',
        pack: packConfig,
        cards: chosen
      });
    } catch (error) {
      console.error('[FUTTU_PACK_OPENING]', error);
    }
  } else {
    /* Fallback: conserva l'apertura originale se il modulo premium non carica. */
    resetPackPreviewState(true);
    packBox.classList.add('shake');
    await delay(360);
    packBox.classList.remove('shake');
    flashLine.classList.add('active');
    flashScreen.classList.add('active');
    packBox.classList.add('opening');
    await delay(900);
    resetPackPreviewState(false);
    if (hasLegend && typeof triggerLegendFX === 'function') {
      try { triggerLegendFX(); } catch (error) {}
    }
  }

  if (usedPremiumOpening) {
    const stageWrap = document.getElementById('stageWrap');
    const stage = document.getElementById('stage');
    if (stageWrap) stageWrap.classList.remove('show');
    if (stage) stage.innerHTML = '';
    resetPackPreviewState(true);
    packArea.style.removeProperty('display');
  } else {
    packArea.style.display = 'none';
    showStage(chosen);
  }
  GAME_STATE.opening = false;
  renderGamePicker();
  applyPackVisual();
  updateOpenBtnEnabled();

  if (saveError) {
    if (log) log.textContent = saveError.message === 'login-required'
      ? '🔒 Accedi con Google per salvare le carte in "Le mie carte".'
      : '⚠️ Le carte sono state mostrate, ma il salvataggio non è riuscito. Riprova.';
  } else if (log) {
    const messageTail = `<a href="${FUTTU_CONFIG.myCardsUrl}">Vai alle mie carte →</a>`;
    log.innerHTML = '✅ Pacchetto salvato. Apertura gratuita. ' + messageTail;
  }
});

window.addEventListener('DOMContentLoaded',async()=>{
  Object.values(PACK_BACK_BY_GAME).forEach(src=>{const im=new Image();im.decoding='async';im.src=src;});

  try {
    await completeGoogleRedirect();
    sessionStorage.removeItem('futtu_google_redirect_pending');
  } catch (e) {
    sessionStorage.removeItem('futtu_google_redirect_pending');
    console.error('[completeGoogleRedirect]', e);
  }

  applyPackVisual();
  await initPointsUI();
  await loadCards();
  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&!openBtn.disabled)openBtn.click();});
});

Object.assign(window,{VALID_GAMES,PACK_CONFIG_BY_GAME,PACK_BACK_BY_GAME,PACK_COST_PER_GAME,PACK_LIKE_COST_PER_GAME,PACK_SIZE_PER_GAME,GAME_STATE,packsLeft,cardCount,isInfinitePack,renderGamePicker,renderPacksStrip,applyPackVisual,updateOpenBtnEnabled,resetPackPreviewState,buildFinitePacks,makeCardEl,showStage});
