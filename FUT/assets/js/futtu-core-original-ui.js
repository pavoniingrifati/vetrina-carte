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
  finite: `futtu_finite_packs_${FUTTU_CONFIG.id}_v3_tagspecial`
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
async function ensureGoogleUser() {
  const auth = firebase.auth();

  try {
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  } catch (e) {
    console.warn('[FUT auth persistence]', e);
  }

  let current = auth.currentUser;

  if (current && !current.isAnonymous) {
    await current.getIdToken(true);
    console.log('[FUT AUTH] Google UID:', current.uid);
    return current;
  }

  // L'inventario deve appartenere SEMPRE all'account Google.
  // Non colleghiamo più un UID anonimo a Google.
  if (current && current.isAnonymous) {
    await auth.signOut();
    current = null;
  }

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    if (!user || user.isAnonymous) throw new Error('google-login-invalid');
    await user.getIdToken(true);
    console.log('[FUT AUTH] Google UID:', user.uid);
    return user;
  } catch (e) {
    console.error('[Google popup login]', e);

    if (e && e.code === 'auth/popup-blocked') {
      alert('Chrome ha bloccato il popup. Consenti i popup per fantaballa.it e riprova.');
    } else if (e && e.code === 'auth/unauthorized-domain') {
      alert('Aggiungi fantaballa.it ai domini autorizzati in Firebase Authentication.');
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
    const user = firebase.auth().currentUser;
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
async function saveInventario(cards,user){
  const u=user||firebase.auth().currentUser;
  if(!u||u.isAnonymous)throw new Error('login-required');

  console.log('[FUT INVENTORY] Salvataggio UID:',u.uid);

  const batch=db.batch();
  const now=firebase.firestore.FieldValue.serverTimestamp();
  for(const c of cards){
    const ref=db.collection('users').doc(u.uid).collection('inventory').doc(safeDocId(c.id));
    batch.set(ref,{
      name:c.name,
      rarity:c.rarity,
      series:c.series||'',
      img:c.img||'',
      count:firebase.firestore.FieldValue.increment(1),
      updatedAt:now
    },{merge:true});
  }
  await batch.commit();
  console.log('[FUT INVENTORY] Salvataggio completato:', cards.length, 'carte');
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
function assertFiniteSequenceIntegrity(packs,uniqueWithinPack=false){
  const across=new Set();
  for(const p of packs||[]){
    const inside=new Set();
    for(const c of p||[]){
      const id=String(c&&c.id||'');if(!id)continue;
      if(uniqueWithinPack&&inside.has(id))throw new Error('duplicato-nel-pacchetto');
      inside.add(id);
      // Nei pack finite costruiti da un pool senza copie, ogni id deve apparire
      // una sola volta nell'intera sequenza. Se il pool prevede copies>1,
      // la regola globale non viene applicata.
      if(across.has(id))return false;
      across.add(id);
    }
  }
  return true;
}
function readFiniteStore(){try{return JSON.parse(localStorage.getItem(STORAGE_KEYS.finite)||'{}')||{};}catch{return {};}}
function writeFiniteStore(store){try{localStorage.setItem(STORAGE_KEYS.finite,JSON.stringify(store||{}));}catch{}}
function finiteSignature(game,cards,size){return JSON.stringify({game,size,ids:(cards||[]).map(c=>String(c.id)).sort()});}
function restoreOrBuildFinitePacks(game,cards,size,builder=buildFinitePacks){
  const signature=finiteSignature(game,cards,size);const store=readFiniteStore();const saved=store[game];const byId=new Map(cards.map(c=>[String(c.id),c]));
  if(saved&&saved.signature===signature&&Array.isArray(saved.packs)){
    const restored=saved.packs.map(ids=>ids.map(id=>byId.get(String(id))).filter(Boolean)).filter(p=>p.length);
    const expected=saved.packs.reduce((s,p)=>s+p.length,0),actual=restored.reduce((s,p)=>s+p.length,0);
    if(restored.length&&expected===actual){
      // Sequenza e avanzamento viaggiano nello stesso record persistente.
      // Questo evita che, dopo chiusura/riapertura, un cursore vecchio venga
      // applicato a una sequenza rimescolata.
      const max=restored.length;
      const savedCursor=Number(saved.cursor);
      if(Number.isFinite(savedCursor))GAME_STATE.cursor[game]=Math.max(0,Math.min(max,savedCursor));
      return restored;
    }
  }
  const built=builder(cards,size);
  // Se cambia il pool (firma diversa) nasce una NUOVA sequenza e il progresso
  // riparte da zero: non si trascina mai il cursore della sequenza precedente.
  GAME_STATE.cursor[game]=0;
  store[game]={signature,createdAt:Date.now(),cursor:0,packs:built.map(p=>p.map(c=>String(c.id)))};writeFiniteStore(store);return built;
}
function persistFiniteCursor(game,cursor){
  const store=readFiniteStore();const entry=store[game];
  if(!entry||!Array.isArray(entry.packs))return;
  const max=entry.packs.length;entry.cursor=Math.max(0,Math.min(max,Number(cursor)||0));entry.updatedAt=Date.now();
  store[game]=entry;writeFiniteStore(store);
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
function specialCardTag(card){
  const tags=Array.isArray(card&&card.tags)?card.tags.map(norm):[];
  // Il tag e' la fonte unica per classificare le tre rarita speciali.
  // Precedenza dalla piu rara alla meno rara in caso di dati anomali con piu tag.
  if(tags.includes('hall of fame'))return'hall of fame';
  if(tags.includes('legend'))return'legend';
  if(tags.includes('senatore'))return'senatore';
  return'';
}
function buildFantaballaLegend(pool,size){
  const rarePlus=pool.filter(c=>['rara','epica','ultra rara','leggendaria'].includes(norm(c.rarity)));
  const sen=pool.filter(c=>specialCardTag(c)==='senatore');
  const leg=pool.filter(c=>specialCardTag(c)==='legend');
  const hof=pool.filter(c=>specialCardTag(c)==='hall of fame');
  const base=rarePlus.filter(c=>!specialCardTag(c));
  const packs=buildFinitePacks(base,size).map(p=>p.slice(0,size));
  function inject(bag,p){const choices=bag.filter(c=>!p.some(x=>x.id===c.id));if(!choices.length)return false;p[Math.floor(Math.random()*p.length)]=choices[Math.floor(Math.random()*choices.length)];return true;}
  packs.forEach(p=>{const roll=Math.random();if(roll<0.30)inject(sen,p);else if(roll<0.44)inject(leg,p);else if(roll<0.50)inject(hof,p);});
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
        if(Number(pack.copies||1)<=1){
          const ok=assertFiniteSequenceIntegrity(GAME_STATE.packs[game],!!pack.uniqueWithinPack);
          if(!ok){
            // Dati persistenti anomali: elimina SOLO questa sequenza e ricreala.
            clearFiniteStore(game);GAME_STATE.cursor[game]=0;
            GAME_STATE.packs[game]=restoreOrBuildFinitePacks(game,pool,pack.size,builder);
          }
        }
      }else if(pack.kind==='fantaballa-legend-finite'){
        GAME_STATE.packs[game]=restoreOrBuildFinitePacks(game,pool,pack.size,(cards,size)=>buildFantaballaLegend(cards,size));
      }else GAME_STATE.packs[game]=[];
    }
    try{
      const legacy=JSON.parse(localStorage.getItem(STORAGE_KEYS.cursors)||'{}');
      const finiteStore=readFiniteStore();
      for(const g of VALID_GAMES){
        const pack=PACK_CONFIG_BY_GAME[g]||{};
        const entry=finiteStore[g];
        if(!isInfinitePack(g)&&entry&&Array.isArray(entry.packs)){
          // Preferisci sempre il cursore salvato insieme alla sequenza.
          // Per installazioni precedenti che non avevano ancora entry.cursor,
          // migra una sola volta il vecchio cursore senza perdere il progresso.
          let cursor=Number(entry.cursor);
          if(!Number.isFinite(cursor))cursor=Number(legacy[g]||0);
          cursor=Math.max(0,Math.min(entry.packs.length,cursor));
          GAME_STATE.cursor[g]=cursor;
          if(entry.cursor!==cursor){entry.cursor=cursor;entry.updatedAt=Date.now();finiteStore[g]=entry;}
        }else GAME_STATE.cursor[g]=Number(legacy[g]||0);
      }
      writeFiniteStore(finiteStore);
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
  const all=GAME_STATE.pools[pack.name]||[];
  let normal=all.filter(c=>['rara','ultra rara'].includes(norm(c.rarity))&&!specialCardTag(c));
  if(!normal.length)normal=all.filter(c=>!specialCardTag(c));
  if(!normal.length)return[];
  const rand=Math.random()*100;
  const needle=rand<30?'senatore':rand<44?'legend':rand<50?'hall of fame':'';
  const tagged=needle?all.filter(c=>specialCardTag(c)===needle):[];
  const finalPool=tagged.length?tagged:normal;
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
  const chosen=list[idx].slice();
  // Doppia protezione: anche se una configurazione futura introducesse copie
  // duplicate nel pool, un pack finite non restituisce mai due volte lo stesso id.
  if(pack.uniqueWithinPack){
    const ids=chosen.map(c=>String(c&&c.id));
    if(new Set(ids).size!==ids.length)throw new Error('duplicato-nel-pacchetto');
  }
  GAME_STATE.cursor[game]=idx+1;
  persistFiniteCursor(game,GAME_STATE.cursor[game]);
  // Manteniamo anche la vecchia chiave per retrocompatibilita'.
  try{localStorage.setItem(STORAGE_KEYS.cursors,JSON.stringify(GAME_STATE.cursor));}catch{}return chosen;
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

  let authenticatedUser = null;
  try {
    // L'apertura è sempre gratuita. Il login serve per salvare sul proprio UID Google.
    authenticatedUser = firebase.auth().currentUser;
    if (!authenticatedUser || authenticatedUser.isAnonymous) {
      authenticatedUser = await ensureGoogleUser();
    }
    if (!authenticatedUser || authenticatedUser.isAnonymous) throw new Error('login-required');
    await ensureWallet10();
    if (log) log.textContent = '🆓 Apertura gratuita. Carte collegate al tuo account Google.';
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
    await saveInventario(chosen,authenticatedUser);
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
  applyPackVisual();
  initPointsUI();
  await loadCards();
  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&!openBtn.disabled)openBtn.click();});
});

Object.assign(window,{VALID_GAMES,PACK_CONFIG_BY_GAME,PACK_BACK_BY_GAME,PACK_COST_PER_GAME,PACK_LIKE_COST_PER_GAME,PACK_SIZE_PER_GAME,GAME_STATE,packsLeft,cardCount,isInfinitePack,renderGamePicker,renderPacksStrip,applyPackVisual,updateOpenBtnEnabled,resetPackPreviewState,buildFinitePacks,makeCardEl,showStage});

/* ==========================================================
   FUTTU CINEMATIC PACK OPENING V2
   Full-screen reveal inspired by modern football pack openings.
   UI only: does not alter pack odds, inventory, pools or persistence.
   ========================================================== */
(function(){
  'use strict';

  const STYLE_ID = 'futtu-cinematic-v2-style';
  const ROOT_ID = 'futtu-cinematic-v2';

  function normV2(v){
    return String(v == null ? '' : v).trim().toLowerCase();
  }

  function tagsOf(card){
    return Array.isArray(card && card.tags) ? card.tags.map(normV2) : [];
  }

  function specialTier(card){
    const tags = tagsOf(card);
    if (tags.includes('hall of fame')) return 'hof';
    if (tags.includes('legend')) return 'legend';
    if (tags.includes('senatore')) return 'senatore';
    return 'normal';
  }

  function modePalette(mode){
    return normV2(mode).includes('gotham')
      ? {a:'#a45cff', b:'#1e6fff', c:'#090711'}
      : {a:'#14ddff', b:'#ffd84a', c:'#05111a'};
  }

  function ensureStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${ROOT_ID}{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at 50% 42%,color-mix(in srgb,var(--fx-a) 25%,transparent),transparent 34%),linear-gradient(180deg,#04050a 0%,var(--fx-bg) 64%,#010204 100%);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff;isolation:isolate;cursor:pointer}
#${ROOT_ID}.is-gotham{--fx-a:#a45cff;--fx-b:#1e6fff;--fx-bg:#090711}
#${ROOT_ID}.is-fantaballa{--fx-a:#14ddff;--fx-b:#ffd84a;--fx-bg:#05111a}
#${ROOT_ID} *{box-sizing:border-box}
#${ROOT_ID} .fx-vignette{position:absolute;inset:0;background:radial-gradient(circle at center,transparent 24%,rgba(0,0,0,.25) 58%,rgba(0,0,0,.85) 100%);pointer-events:none;z-index:8}
#${ROOT_ID} .fx-beams{position:absolute;inset:-10%;opacity:.7;filter:blur(5px);background:conic-gradient(from 255deg at 50% -10%,transparent 0 11deg,rgba(255,255,255,.14) 12deg 16deg,transparent 17deg 29deg,rgba(255,255,255,.08) 30deg 36deg,transparent 37deg 360deg);transform-origin:50% 0;animation:fxBeams 8s ease-in-out infinite alternate;pointer-events:none}
#${ROOT_ID} .fx-floor{position:absolute;left:50%;bottom:4vh;width:min(52vw,760px);height:90px;transform:translateX(-50%);background:radial-gradient(ellipse at center,color-mix(in srgb,var(--fx-a) 38%,transparent),transparent 67%);filter:blur(9px);opacity:.55}
#${ROOT_ID} .fx-particles{position:absolute;inset:0;pointer-events:none;overflow:hidden}
#${ROOT_ID} .fx-particle{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;box-shadow:0 0 12px var(--fx-a);opacity:0;animation:fxParticle var(--dur) linear infinite;animation-delay:var(--delay);left:var(--x)}
#${ROOT_ID} .fx-top{position:absolute;top:4.2vh;left:0;right:0;text-align:center;z-index:12;text-transform:uppercase;letter-spacing:.22em;font-weight:800}
#${ROOT_ID} .fx-count{font-size:clamp(10px,.8vw,13px);opacity:.64;margin-bottom:13px}
#${ROOT_ID} .fx-kicker{font-size:clamp(10px,.72vw,12px);opacity:.55;margin-bottom:8px}
#${ROOT_ID} .fx-meta{min-height:clamp(38px,5.2vw,92px);font-size:clamp(30px,4.8vw,82px);line-height:.95;font-weight:950;letter-spacing:-.045em;text-shadow:0 0 30px color-mix(in srgb,var(--fx-a) 50%,transparent);display:flex;justify-content:center;align-items:center;padding:0 20px;max-width:min(92vw,1400px);margin:0 auto;text-wrap:balance}
#${ROOT_ID} .fx-scene{position:relative;z-index:10;display:flex;align-items:center;justify-content:center;width:100%;height:100%;perspective:1500px;padding-top:5vh}
#${ROOT_ID} .fx-card-wrap{position:relative;width:min(40vw,620px);aspect-ratio:690/987;max-height:74vh;transform-style:preserve-3d;will-change:transform,filter;filter:drop-shadow(0 0 34px color-mix(in srgb,var(--fx-a) 56%,transparent));animation:fxFloat 2.8s ease-in-out infinite}
#${ROOT_ID} .fx-card-wrap::before{content:"";position:absolute;inset:-14%;border-radius:40px;background:radial-gradient(circle,color-mix(in srgb,var(--fx-a) 50%,transparent),transparent 64%);filter:blur(28px);z-index:-2;opacity:.68;animation:fxPulse 1.8s ease-in-out infinite alternate}
#${ROOT_ID} .fx-card{position:absolute;inset:0;border-radius:18px;overflow:hidden;transform-style:preserve-3d;backface-visibility:hidden;background:linear-gradient(145deg,#171922,#07080c);border:1px solid rgba(255,255,255,.18);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),0 0 0 2px color-mix(in srgb,var(--fx-a) 30%,transparent),0 0 35px color-mix(in srgb,var(--fx-a) 35%,transparent)}
#${ROOT_ID} .fx-card img{width:100%;height:100%;display:block;object-fit:contain;background:transparent}
#${ROOT_ID} .fx-front{display:flex;align-items:stretch;justify-content:stretch}
#${ROOT_ID} .fx-front .fx-default-player{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;padding:9%;background:linear-gradient(160deg,#10b8ee 0%,#0976df 48%,#1731a8 100%);color:#fff;text-align:center;overflow:hidden}
#${ROOT_ID} .fx-front .fx-default-player::before{content:"";position:absolute;inset:-20%;background:repeating-radial-gradient(ellipse at 50% 115%,rgba(255,255,255,.10) 0 18px,transparent 19px 42px);transform:rotate(-8deg);opacity:.85}
#${ROOT_ID} .fx-front .fx-default-player.show{display:flex}
#${ROOT_ID} .fx-default-new{position:absolute;left:8%;top:7%;padding:3px 7px;border-radius:4px;background:#07151f;color:#00f6ff;font-size:clamp(9px,.7vw,12px);font-weight:950;letter-spacing:.08em;z-index:2}
#${ROOT_ID} .fx-default-icon{position:relative;z-index:2;width:42%;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.16);border:2px solid rgba(255,255,255,.28);box-shadow:0 0 32px rgba(255,255,255,.12);font-size:clamp(34px,5vw,78px);font-weight:950;margin-bottom:8%}
#${ROOT_ID} .fx-default-name{position:relative;z-index:2;font-size:clamp(28px,3.5vw,58px);font-weight:1000;line-height:.9;text-transform:uppercase;letter-spacing:-.05em;text-shadow:0 3px 0 rgba(0,0,0,.14);max-width:100%;overflow-wrap:anywhere}
#${ROOT_ID} .fx-default-sub{position:relative;z-index:2;margin-top:6%;font-size:clamp(11px,.9vw,15px);font-weight:850;text-transform:uppercase;letter-spacing:.12em;opacity:.9}
#${ROOT_ID} .fx-default-series{position:relative;z-index:2;margin-top:3%;font-size:clamp(10px,.78vw,13px);font-weight:750;opacity:.75}
#${ROOT_ID} .fx-front.fallback img{display:none}
#${ROOT_ID} .fx-summary-card .fx-summary-fallback{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10%;background:linear-gradient(160deg,#10b8ee,#0976df 50%,#1731a8);border-radius:16px;text-align:center;font-weight:900}
#${ROOT_ID} .fx-summary-card .fx-summary-fallback b{font-size:clamp(16px,1.7vw,28px);line-height:.95;text-transform:uppercase;overflow-wrap:anywhere}
#${ROOT_ID} .fx-summary-card .fx-summary-fallback em{font-style:normal;margin-top:8px;font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:.08em}
#${ROOT_ID} .fx-back{display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 35%,color-mix(in srgb,var(--fx-a) 18%,#1a1525),#08090e 76%)}
#${ROOT_ID} .fx-back img{object-fit:contain;filter:saturate(1.1) contrast(1.03)}
#${ROOT_ID} .fx-mystery{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:clamp(56px,7vw,120px);font-weight:900;color:rgba(255,255,255,.82);text-shadow:0 0 38px var(--fx-a)}
#${ROOT_ID} .fx-front{opacity:0;transform:scale(.87);filter:blur(11px) brightness(1.8)}
#${ROOT_ID} .fx-card-wrap.revealed .fx-back{animation:fxBackOut .24s ease-in forwards}
#${ROOT_ID} .fx-card-wrap.revealed .fx-front{animation:fxFrontIn .62s cubic-bezier(.16,.84,.24,1) .12s forwards}
#${ROOT_ID} .fx-flash{position:absolute;inset:0;z-index:20;pointer-events:none;background:#fff;opacity:0;mix-blend-mode:screen}
#${ROOT_ID} .fx-flash.go{animation:fxFlash .62s ease-out forwards}
#${ROOT_ID} .fx-name{display:none}
#${ROOT_ID} .fx-name small{display:block;font-size:clamp(9px,.7vw,12px);font-weight:800;letter-spacing:.32em;text-transform:uppercase;opacity:.55;margin-bottom:6px}
#${ROOT_ID} .fx-name strong{font-size:clamp(34px,4.2vw,76px);line-height:.95;letter-spacing:-.05em;text-transform:uppercase;text-shadow:0 0 36px color-mix(in srgb,var(--fx-a) 52%,transparent)}
#${ROOT_ID} .fx-name.show{animation:fxName .48s cubic-bezier(.16,.84,.24,1) forwards}
#${ROOT_ID} .fx-hint{position:absolute;right:2.5vw;bottom:2.8vh;z-index:14;padding:8px 12px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(5,7,12,.45);backdrop-filter:blur(8px);font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.66}
#${ROOT_ID} .fx-progress{position:absolute;top:0;left:0;height:3px;background:linear-gradient(90deg,var(--fx-a),var(--fx-b));box-shadow:0 0 18px var(--fx-a);z-index:30;transition:width .35s ease}
#${ROOT_ID}.tier-senatore .fx-card-wrap{filter:drop-shadow(0 0 34px #f0bd67)}
#${ROOT_ID}.tier-senatore{--fx-a:#f0bd67}
#${ROOT_ID}.tier-legend{--fx-a:#a45cff}
#${ROOT_ID}.tier-legend .fx-card-wrap::before{opacity:.92;filter:blur(36px)}
#${ROOT_ID}.tier-hof{--fx-a:#f7da73;--fx-b:#fff4bd}
#${ROOT_ID}.tier-hof .fx-card-wrap::before{opacity:1;filter:blur(44px)}
#${ROOT_ID}.tier-hof .fx-beams{opacity:1}
#${ROOT_ID}.tier-senatore{background:radial-gradient(circle at 50% 42%,rgba(240,189,103,.24),transparent 32%),linear-gradient(180deg,#080604 0%,#171006 64%,#020201 100%)}
#${ROOT_ID}.tier-senatore .fx-particle{background:#ffd48a;box-shadow:0 0 14px #e7a83f}
#${ROOT_ID}.tier-senatore .fx-stage.charge{height:2px;box-shadow:0 0 32px #f0bd67,0 0 80px rgba(240,189,103,.35)}
#${ROOT_ID}.tier-senatore .fx-card-wrap.fx-charging{animation:fxSenatoreCharge .82s ease-in-out infinite alternate}
#${ROOT_ID}.tier-legend{background:radial-gradient(circle at 50% 42%,rgba(164,92,255,.23),transparent 31%),linear-gradient(180deg,#030206 0%,#0d0618 64%,#010102 100%)}
#${ROOT_ID}.tier-legend .fx-vignette{background:radial-gradient(circle at center,transparent 18%,rgba(7,0,15,.42) 56%,rgba(0,0,0,.94) 100%)}
#${ROOT_ID}.tier-legend .fx-beams{opacity:.92;animation-duration:5.5s}
#${ROOT_ID}.tier-legend .fx-particle{width:4px;height:4px;background:#c99cff;box-shadow:0 0 18px #a45cff}
#${ROOT_ID}.tier-legend .fx-card-wrap.fx-charging{animation:fxLegendCharge .64s ease-in-out infinite alternate}
#${ROOT_ID}.tier-hof{background:radial-gradient(circle at 50% 40%,rgba(255,244,189,.32),transparent 30%),linear-gradient(180deg,#090805 0%,#191503 62%,#020201 100%)}
#${ROOT_ID}.tier-hof .fx-vignette{background:radial-gradient(circle at center,transparent 22%,rgba(34,27,4,.23) 56%,rgba(0,0,0,.9) 100%)}
#${ROOT_ID}.tier-hof .fx-particle{width:4px;height:4px;background:#fff7c9;box-shadow:0 0 20px #f7da73}
#${ROOT_ID}.tier-hof .fx-stage.charge{height:3px;box-shadow:0 0 36px #fff4bd,0 0 110px rgba(247,218,115,.58)}
#${ROOT_ID}.tier-hof .fx-card-wrap.fx-charging{animation:fxHofCharge .5s ease-in-out infinite alternate}
#${ROOT_ID}.tier-hof .fx-flash.go{animation:fxHofFlash 1s ease-out forwards}
#${ROOT_ID} .fx-summary{position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5vh 4vw;background:radial-gradient(circle at 50% 40%,color-mix(in srgb,var(--fx-a) 16%,transparent),transparent 42%);opacity:0;pointer-events:none}
#${ROOT_ID} .fx-summary.show{opacity:1;pointer-events:auto;transition:opacity .4s ease}
#${ROOT_ID} .fx-summary-title{font-size:clamp(28px,3vw,54px);font-weight:950;letter-spacing:-.04em;text-transform:uppercase;margin-bottom:4vh}
#${ROOT_ID} .fx-summary-grid{display:flex;justify-content:center;align-items:flex-end;gap:clamp(12px,1.8vw,28px);width:min(92vw,1200px);flex-wrap:wrap}
#${ROOT_ID} .fx-summary-card{width:min(22vw,270px);aspect-ratio:690/987;opacity:0;transform:translateY(38px) scale(.9);filter:drop-shadow(0 0 18px color-mix(in srgb,var(--fx-a) 35%,transparent))}
#${ROOT_ID} .fx-summary.show .fx-summary-card{animation:fxSummaryIn .52s cubic-bezier(.16,.84,.24,1) forwards;animation-delay:var(--d)}
#${ROOT_ID} .fx-summary-card img{width:100%;height:100%;object-fit:contain;display:block}
#${ROOT_ID} .fx-summary-card span{display:block;text-align:center;font-size:clamp(11px,1vw,15px);font-weight:850;text-transform:uppercase;margin-top:6px}
#${ROOT_ID} .fx-summary-close{margin-top:5vh;padding:12px 22px;border-radius:999px;border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.09);color:#fff;font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer}
@keyframes fxFloat{0%,100%{transform:translateY(4px) rotateX(0deg)}50%{transform:translateY(-8px) rotateX(1.5deg)}}
@keyframes fxPulse{from{transform:scale(.94);opacity:.45}to{transform:scale(1.08);opacity:.85}}
@keyframes fxBeams{from{transform:rotate(-2deg) scale(1.02)}to{transform:rotate(3deg) scale(1.08)}}
@keyframes fxParticle{0%{transform:translateY(105vh) scale(.3);opacity:0}10%{opacity:.45}90%{opacity:.25}100%{transform:translateY(-15vh) scale(1.2);opacity:0}}
@keyframes fxBackOut{to{opacity:0;transform:scale(1.06);filter:blur(7px) brightness(2.2)}}
@keyframes fxFrontIn{0%{opacity:0;transform:scale(.82);filter:blur(14px) brightness(2.2)}55%{opacity:1;transform:scale(1.045);filter:blur(1px) brightness(1.25)}100%{opacity:1;transform:scale(1);filter:none}}
@keyframes fxFlash{0%{opacity:0}12%{opacity:.98}33%{opacity:.54}100%{opacity:0}}
@keyframes fxName{to{opacity:1;transform:translateY(0)}}
@keyframes fxSummaryIn{to{opacity:1;transform:translateY(0) scale(1)}}
@media (max-width:700px){#${ROOT_ID} .fx-card-wrap{width:min(78vw,520px);max-height:70vh}#${ROOT_ID} .fx-top{top:3vh}#${ROOT_ID} .fx-summary-card{width:min(40vw,210px)}#${ROOT_ID} .fx-hint{display:none}#${ROOT_ID} .fx-meta{font-size:clamp(24px,8vw,46px);padding:0 16px}}

#${ROOT_ID} .fx-top{top:3.3vh}
#${ROOT_ID} .fx-count{font-size:clamp(11px,.8vw,14px)}
#${ROOT_ID} .fx-meta{font-size:clamp(29px,4.25vw,76px);transition:opacity .23s,transform .23s;max-width:min(94vw,1350px)}
#${ROOT_ID} .fx-meta.fx-pop{animation:fxV3Pop .44s cubic-bezier(.16,.85,.2,1) both}
#${ROOT_ID} .fx-card-wrap{width:min(44vw,640px,calc(77vh * 690 / 987));max-height:77vh}
#${ROOT_ID} .fx-card-wrap.fx-charging::before{animation:fxCharge .9s ease-in-out infinite alternate}
#${ROOT_ID} .fx-card-wrap.fx-charging{animation:fxChargeCard .72s ease-in-out infinite alternate}
#${ROOT_ID} .fx-scene{padding-top:7vh}
#${ROOT_ID} .fx-skip{position:absolute;top:3vh;right:2.5vw;z-index:35;cursor:pointer;border:1px solid rgba(255,255,255,.3);border-radius:999px;background:rgba(12,14,25,.68);color:#fff;font:700 12px/1 Inter,ui-sans-serif,system-ui,sans-serif;letter-spacing:.045em;padding:13px 17px;backdrop-filter:blur(9px);transition:background .2s,border-color .2s}
#${ROOT_ID} .fx-skip:hover,#${ROOT_ID} .fx-skip:focus-visible{background:rgba(255,255,255,.2);border-color:#fff}
#${ROOT_ID} .fx-stage{position:absolute;left:50%;top:18vh;transform:translateX(-50%);width:min(54vw,660px);height:1px;z-index:12;background:linear-gradient(90deg,transparent,var(--fx-a),transparent);opacity:.4;transition:opacity .2s}
#${ROOT_ID} .fx-stage.charge{opacity:1;box-shadow:0 0 28px var(--fx-a)}
#${ROOT_ID} .fx-summary{background:radial-gradient(circle at 50% 42%,color-mix(in srgb,var(--fx-a) 24%,#070711),#04050b 82%);overflow-y:auto;justify-content:center;gap:1.4vh}
#${ROOT_ID} .fx-summary-grid{align-items:flex-start;gap:clamp(12px,2vw,28px)}
#${ROOT_ID} .fx-summary-card{width:min(24vw,260px);aspect-ratio:auto;filter:none;position:relative;--fx-card-glow:var(--fx-a)}
#${ROOT_ID} .fx-summary-card img{width:100%;aspect-ratio:690/987;height:auto;object-fit:contain;filter:drop-shadow(0 0 14px color-mix(in srgb,var(--fx-card-glow) 48%,transparent))}
#${ROOT_ID} .fx-summary-card.tier-senatore{--fx-card-glow:#f0bd67}
#${ROOT_ID} .fx-summary-card.tier-legend{--fx-card-glow:#a45cff}
#${ROOT_ID} .fx-summary-card.tier-hof{--fx-card-glow:#f7da73}
#${ROOT_ID} .fx-summary-card .fx-tier{font-size:10px;font-weight:900;letter-spacing:.12em;color:var(--fx-card-glow);margin-top:5px;text-transform:uppercase}
#${ROOT_ID} .fx-summary-card span{font-size:clamp(11px,1.05vw,15px);letter-spacing:.01em;overflow-wrap:anywhere}
#${ROOT_ID} .fx-summary-title{margin-bottom:2vh}
#${ROOT_ID} .fx-summary-close{margin-top:2vh}
#${ROOT_ID}.simple-classic .fx-beams{opacity:.28}
#${ROOT_ID}.simple-classic .fx-stage{display:none}
#${ROOT_ID}.simple-classic .fx-card-wrap{width:min(34vw,520px);max-height:70vh;filter:drop-shadow(0 0 22px color-mix(in srgb,var(--fx-a) 38%,transparent))}
#${ROOT_ID}.simple-classic .fx-card-wrap::before{opacity:.35;filter:blur(22px)}
#${ROOT_ID}.simple-classic .fx-meta{font-size:clamp(28px,3.6vw,62px)}
#${ROOT_ID}.simple-classic .fx-kicker{display:none}
#${ROOT_ID}.simple-classic .fx-floor{opacity:.35}
#${ROOT_ID} .fx-hint{pointer-events:none}
#${ROOT_ID}.tier-hof .fx-flash.go{animation-duration:.85s}
@keyframes fxV3Pop{0%{opacity:0;transform:translateY(14px) scale(.95);filter:blur(6px)}100%{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}
@keyframes fxCharge{from{transform:scale(.94);opacity:.62}to{transform:scale(1.2);opacity:1}}
@keyframes fxChargeCard{from{transform:translateY(1px) scale(1);filter:drop-shadow(0 0 24px var(--fx-a))}to{transform:translateY(-8px) scale(1.025);filter:drop-shadow(0 0 48px var(--fx-a))}}
@keyframes fxSenatoreCharge{from{transform:translateY(1px) scale(1);filter:drop-shadow(0 0 26px #c98b34)}to{transform:translateY(-7px) scale(1.03);filter:drop-shadow(0 0 58px #f0bd67)}}
@keyframes fxLegendCharge{from{transform:translateY(2px) scale(.995) rotateZ(-.15deg);filter:drop-shadow(0 0 30px #5d2e96)}to{transform:translateY(-10px) scale(1.04) rotateZ(.15deg);filter:drop-shadow(0 0 72px #a45cff)}}
@keyframes fxHofCharge{from{transform:translateY(1px) scale(1);filter:drop-shadow(0 0 32px #b89c35) brightness(1)}to{transform:translateY(-11px) scale(1.055);filter:drop-shadow(0 0 88px #fff0a8) brightness(1.12)}}
@keyframes fxHofFlash{0%{opacity:0}8%{opacity:1}21%{opacity:.18}34%{opacity:.9}48%{opacity:.32}100%{opacity:0}}
@media(max-width:700px){#${ROOT_ID} .fx-card-wrap{width:min(84vw,calc(67vh * 690 / 987));max-height:67vh}#${ROOT_ID} .fx-scene{padding-top:9vh}#${ROOT_ID} .fx-top{top:7vh}#${ROOT_ID} .fx-skip{top:1.6vh;right:3vw}#${ROOT_ID} .fx-summary{justify-content:flex-start;padding:8vh 3vw 5vh}#${ROOT_ID} .fx-summary-card{width:min(42vw,205px)}#${ROOT_ID} .fx-summary-title{font-size:clamp(23px,6vw,38px)}#${ROOT_ID} .fx-stage{top:18vh}}
@media(max-height:650px){#${ROOT_ID} .fx-card-wrap{width:min(32vw,calc(65vh * 690 / 987));max-height:65vh}#${ROOT_ID} .fx-top{top:2vh}#${ROOT_ID} .fx-meta{font-size:clamp(22px,4vh,42px)}#${ROOT_ID} .fx-summary{justify-content:flex-start;padding-top:6vh}}

@media (prefers-reduced-motion:reduce){#${ROOT_ID} *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
`;
    document.head.appendChild(style);
  }

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  function makeParticles(container){
    const wrap = document.createElement('div');
    wrap.className = 'fx-particles';
    for(let i=0;i<36;i++){
      const p = document.createElement('i');
      p.className = 'fx-particle';
      p.style.setProperty('--x', `${Math.random()*100}%`);
      p.style.setProperty('--dur', `${5 + Math.random()*7}s`);
      p.style.setProperty('--delay', `${-Math.random()*10}s`);
      wrap.appendChild(p);
    }
    container.appendChild(wrap);
  }

  function softBeep(kind){
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return;
      const ctx = new AC();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      const map = {step:[230,.05], reveal:[92,.18], special:[132,.24]};
      const cfg = map[kind] || map.step;
      o.type = kind === 'reveal' ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(cfg[0], ctx.currentTime);
      if(kind === 'special') o.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + cfg[1]);
      g.gain.setValueAtTime(.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.04, ctx.currentTime+.015);
      g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime+cfg[1]);
      o.start(); o.stop(ctx.currentTime+cfg[1]+.02);
      setTimeout(()=>ctx.close().catch(()=>{}), 500);
    }catch(e){}
  }

  function imgSrc(card){ return card && card.img ? card.img : ''; }

  function textSafe(value){ return String(value == null ? '' : value); }
  function tierLabel(tier){ return ({hof:'HALL OF FAME',legend:'LEGEND',senatore:'SENATORE'})[tier] || ''; }

  async function playOpening({mode, packName, cover, cards}){
    ensureStyle();
    const palette = modePalette(mode);
    const old = document.getElementById(ROOT_ID);
    if(old) old.remove();
    if(!Array.isArray(cards) || !cards.length) return;
    const simpleClassicPack = ['bronze','silver','gold'].includes(normV2(packName));

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = normV2(mode).includes('gotham') ? 'is-gotham' : 'is-fantaballa';
    if(simpleClassicPack) root.classList.add('simple-classic');
    root.style.setProperty('--fx-a', palette.a);
    root.style.setProperty('--fx-b', palette.b);
    root.style.setProperty('--fx-bg', palette.c);
    root.innerHTML = `
      <div class="fx-progress"></div><div class="fx-beams"></div><div class="fx-floor"></div>
      <div class="fx-top"><div class="fx-count"></div><div class="fx-kicker"></div><div class="fx-meta"></div></div>
      <div class="fx-stage" aria-hidden="true"></div>
      <div class="fx-scene"><div class="fx-card-wrap"><div class="fx-card fx-back"></div><div class="fx-card fx-front"><img alt=""><div class="fx-default-player"><span class="fx-default-new">NEW</span><div class="fx-default-icon"></div><div class="fx-default-name"></div><div class="fx-default-sub">Grafica in arrivo</div><div class="fx-default-series"></div></div></div></div></div>
      <button class="fx-skip" type="button">Salta animazione ↠</button>
      <div class="fx-hint">Clic / Spazio per continuare</div><div class="fx-flash"></div><div class="fx-vignette"></div>
      <div class="fx-summary"><div class="fx-summary-title">Pacchetto completato</div><div class="fx-summary-grid"></div><button class="fx-summary-close" type="button">Continua</button></div>`;
    makeParticles(root);
    document.body.appendChild(root);

    const count = root.querySelector('.fx-count');
    const kicker = root.querySelector('.fx-kicker');
    const meta = root.querySelector('.fx-meta');
    const wrap = root.querySelector('.fx-card-wrap');
    const back = root.querySelector('.fx-back');
    const frontFace = root.querySelector('.fx-front');
    const frontImg = root.querySelector('.fx-front img');
    const fallback = root.querySelector('.fx-default-player');
    const fallbackIcon = root.querySelector('.fx-default-icon');
    const fallbackName = root.querySelector('.fx-default-name');
    const fallbackSeries = root.querySelector('.fx-default-series');
    const flash = root.querySelector('.fx-flash');
    const progress = root.querySelector('.fx-progress');
    const stage = root.querySelector('.fx-stage');
    const summary = root.querySelector('.fx-summary');
    const summaryGrid = root.querySelector('.fx-summary-grid');
    const closeBtn = root.querySelector('.fx-summary-close');
    const skipBtn = root.querySelector('.fx-skip');
    const hint = root.querySelector('.fx-hint');

    let skipRequested = false;
    let waiting = null;
    let closed = false;
    /* V3.2: ogni step avanza SOLO su input dell'utente. Nessun timeout automatico. */
    const waitFor = () => new Promise(resolve => {
      if(skipRequested){ resolve(); return; }
      const current = {done:false, resolve};
      current.finish = () => {
        if(current.done) return;
        current.done = true;
        if(waiting === current) waiting = null;
        resolve();
      };
      waiting = current;
    });
    const advance = () => { if(waiting) waiting.finish(); };
    const requestSkip = () => {
      skipRequested = true;
      if(waiting) waiting.finish();
    };
    const onSkip = e => { e.stopPropagation(); requestSkip(); };
    skipBtn.addEventListener('click',onSkip);
    const onRootClick = e => {
      if(e.target.closest('.fx-summary,.fx-skip')) return;
      advance();
    };
    root.addEventListener('click',onRootClick);
    const onKey = e => {
      if(closed) return;
      if(e.key === 'Escape' && !summary.classList.contains('show')){
        e.preventDefault(); requestSkip(); return;
      }
      if([' ','Enter','ArrowRight'].includes(e.key) && !summary.classList.contains('show')){
        e.preventDefault(); advance();
      }
    };
    window.addEventListener('keydown',onKey,true);

    const setHeadline = (label, value) => {
      kicker.textContent = textSafe(label);
      meta.textContent = textSafe(value);
      meta.classList.remove('fx-pop');
      void meta.offsetWidth;
      if(value) meta.classList.add('fx-pop');
    };
    const steps = [
      {label:'RUOLO', get:c=>c.role},
      {label:'RARITÀ', get:c=>c.rarity},
      {label:'SERIE', get:c=>c.series}
    ];
    const showFallback = (card) => {
      frontFace.classList.add('fallback');
      fallback.classList.add('show');
      fallbackIcon.textContent = initialsFromName(card && card.name ? card.name : 'NP');
      fallbackName.textContent = textSafe(card && card.name ? card.name : 'New Player');
      fallbackSeries.textContent = textSafe((card && (card.rarity || card.series)) || '');
    };
    const setCardImage = (card) => {
      frontFace.classList.remove('fallback');
      fallback.classList.remove('show');
      const src = imgSrc(card);
      frontImg.removeAttribute('src');
      frontImg.alt = textSafe(card && card.name ? card.name : 'Carta');
      frontImg.onerror = () => showFallback(card);
      if(src) frontImg.src = src; else showFallback(card);
    };

    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let afterSummary = null;
    try {
      for(let i=0;i<cards.length && !skipRequested;i++){
        const card = cards[i];
        const tier = specialTier(card);
        root.classList.remove('tier-senatore','tier-legend','tier-hof');
        /* Il colore pre-reveal anticipa la rarita senza mostrare il nome. */
        if(tier !== 'normal') root.classList.add('tier-'+tier);
        count.textContent = `CARTA ${i+1} DI ${cards.length}`;
        progress.style.width = `${(i/cards.length)*100}%`;
        wrap.classList.remove('revealed','fx-charging');
        stage.classList.remove('charge');
        flash.classList.remove('go');
        setCardImage(card);
        back.replaceChildren();
        if(cover){
          const backImg = document.createElement('img');
          backImg.src=cover; backImg.alt='Retro del pacchetto'; back.append(backImg);
        }else{
          const question=document.createElement('div');
          question.className='fx-mystery'; question.textContent='?'; back.append(question);
        }
        setHeadline(String(packName||'PACK').toUpperCase(),'');
        await waitFor();
        if(skipRequested) break;

        if(simpleClassicPack){
          /* Bronze / Silver / Gold: apertura rapida. Un click rivela subito la carta completa. */
          flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
          wrap.classList.add('revealed');
          softBeep('reveal');
          await sleep(reducedMotion ? 20 : 260);
          if(skipRequested) break;
          setHeadline('',`HAI TROVATO ${textSafe(card.name || 'CARTA')}`);
          progress.style.width = `${((i+1)/cards.length)*100}%`;
          await waitFor();
        }else{
          /* Pack rari/speciali: reveal completo e manuale, uno step per click. */
          for(const step of steps){
            const value = textSafe(step.get(card)).trim();
            if(!value) continue;
            setHeadline(step.label,value);
            softBeep('step');
            await waitFor();
            if(skipRequested) break;
          }
          if(skipRequested) break;
          setHeadline('SCOPRI LA CARTA','');
          wrap.classList.add('fx-charging');
          stage.classList.add('charge');
          if(tier !== 'normal') softBeep('special');
          await waitFor();
          if(skipRequested) break;
          wrap.classList.remove('fx-charging');
          stage.classList.remove('charge');
          flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
          wrap.classList.add('revealed');
          softBeep('reveal');
          await sleep(reducedMotion ? 20 : 380);
          if(skipRequested) break;
          setHeadline(tierLabel(tier),`HAI TROVATO ${textSafe(card.name || 'CARTA')}`);
          progress.style.width = `${((i+1)/cards.length)*100}%`;
          await waitFor();
        }
      }
      /* Riepilogo anche quando si salta: le carte sono gia state assegnate dal core. */
      root.classList.remove('tier-senatore','tier-legend','tier-hof');
      root.querySelector('.fx-scene').style.display = 'none';
      root.querySelector('.fx-top').style.display = 'none';
      stage.style.display = 'none';
      skipBtn.style.display = 'none';
      hint.style.display = 'none';
      progress.style.width = '100%';
      summaryGrid.replaceChildren();
      cards.forEach((card,idx) => {
        const tile=document.createElement('div');
        const tier=specialTier(card);
        tile.className='fx-summary-card'+(tier !== 'normal' ? ' tier-'+tier : '');
        tile.style.setProperty('--d',`${idx*.1}s`);
        const picture=document.createElement('img');
        picture.alt=textSafe(card.name);
        const addSummaryFallback=()=>{
          if(tile.querySelector('.fx-summary-fallback')) return;
          picture.remove();
          const fb=document.createElement('div');
          fb.className='fx-summary-fallback';
          const b=document.createElement('b'); b.textContent=textSafe(card.name||'New Player');
          const em=document.createElement('em'); em.textContent='Grafica in arrivo';
          fb.append(b,em);
          tile.prepend(fb);
        };
        picture.onerror=addSummaryFallback;
        const src=imgSrc(card);
        if(src) picture.src=src; else queueMicrotask(addSummaryFallback);
        const name=document.createElement('span'); name.textContent=textSafe(card.name||'Carta');
        tile.append(picture,name);
        if(tier !== 'normal'){
          const tag=document.createElement('div');
          tag.className='fx-tier'; tag.textContent=tierLabel(tier);
          tile.append(tag);
        }
        summaryGrid.append(tile);
      });
      summary.classList.add('show');
      await new Promise(resolve => {
        let resolved = false;
        const finish=()=>{
          if(resolved) return;
          resolved=true;
          closeBtn.removeEventListener('click',finish);
          window.removeEventListener('keydown',onSummaryKey,true);
          resolve();
        };
        const onSummaryKey=e=>{
          if(['Enter',' ','Escape'].includes(e.key)){
            e.preventDefault(); finish();
          }
        };
        closeBtn.addEventListener('click',finish);
        window.addEventListener('keydown',onSummaryKey,true);
      });
    } finally {
      closed = true;
      if(waiting) waiting.finish();
      window.removeEventListener('keydown',onKey,true);
      root.removeEventListener('click',onRootClick);
      skipBtn.removeEventListener('click',onSkip);
      if(root.isConnected){
        if(!reducedMotion && root.animate){
          try {await root.animate([{opacity:1},{opacity:0}],{duration:240,easing:'ease'}).finished;}catch(e){}
        }
        root.remove();
      }
    }
  }

  window.FUTTU_PACK_OPENING = { version:'3.4.0', play:playOpening };
})();
