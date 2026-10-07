/* Responsibility: auction-events-controller. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: auction-events-controller');
  function ensureAuctionEvents(){
    if(!$runtime.state.auctionEvents) $runtime.state.auctionEvents={count:0,lastPurchaseAt:-99,history:[],activeEffects:[],pending:null,relationships:{}};
    const ae=$runtime.state.auctionEvents; ae.history=ae.history||[]; ae.activeEffects=ae.activeEffects||[]; ae.relationships=ae.relationships||{}; return ae;
  }

  function auctionEffects(type){ return $runtime.state?.auctionEvents?.activeEffects?.filter(e=>e.type===type) || []; }

  function relationship(cpuId){
    const ae=$runtime.ensureAuctionEvents();
    const r=ae.relationships[cpuId] ||= {trust:50,rivalry:0,agreements:0,betrayals:0,duels:0,respectedPacts:0,duelModelVersion:2,notes:[]};
    if(!Number.isFinite(Number(r.duels))) r.duels=0;
    if(!Number.isFinite(Number(r.respectedPacts))) r.respectedPacts=0;
    // Migrazione V3.2.35.44: i vecchi salvataggi contavano come "duello" anche
    // incroci molto brevi. Non li facciamo diventare automaticamente RIVALI CALDI
    // con le regole nuove: al massimo conserviamo due duelli pregressi.
    if(Number(r.duelModelVersion||0)<2){
      r.duels=Math.min(2,Math.max(0,Number(r.duels||0)));
      r.duelModelVersion=2;
    }
    r.notes=Array.isArray(r.notes)?r.notes:[];
    return r;
  }

  function changeRelationship(cpuId,trustDelta=0,rivalryDelta=0,note=''){
    const r=$runtime.relationship(cpuId); r.trust=$runtime.clamp(r.trust+trustDelta,0,100); r.rivalry=$runtime.clamp(r.rivalry+rivalryDelta,0,100);
    if(note){r.notes.push(note); if(r.notes.length>12) r.notes=r.notes.slice(-12);} if(note.includes('tradimento')) r.betrayals++;
  }

  function registerDirectAuctionDuel(cpuId){
    const a=$runtime.state?.auction;
    if(!a || !cpuId || cpuId==='user' || $runtime.autocompleteMode) return;
    a.userDuelCpuIds=Array.isArray(a.userDuelCpuIds)?a.userDuelCpuIds:[];
    a.lastDirectCpuId=cpuId;
    if(a.userDuelCpuIds.includes(cpuId)) return;
    // Conta come memoria di rivalità solo una chiamata già combattuta: prima del
    // nuovo rilancio devono esserci almeno 3 offerte, quindi il cambio di leader
    // che segue porta il duello ad almeno 4 rilanci complessivi.
    if(Number(a.bidCount||0)<3) return;
    a.userDuelCpuIds.push(cpuId);
    const manager=$runtime.state.managers.find(m=>m.id===cpuId);
    const wasHot=$runtime.isHotRival(manager);
    const r=$runtime.relationship(cpuId);
    r.duels=Number(r.duels||0)+1;
    r.rivalry=$runtime.clamp(Number(r.rivalry||0)+2,0,100);
    if(!wasHot && $runtime.isHotRival(manager)) $runtime.showToast(`🔥 ${manager?.profile?.label||'Un avversario'} è diventato RIVALE CALDO.`);
  }

  function resolveRespectedAuctionPact(playerId){
    const pact=$runtime.auctionEffects('non_aggression_pact').find(e=>e.playerId===playerId);
    if(!pact || pact.relationshipResolved || pact.userBetrayed || pact.cpuBetrayed) return;
    const cpu=$runtime.state.managers.find(m=>m.id===pact.cpuId);
    if(!cpu) return;
    const wasGood=$runtime.hasGoodRelations(cpu);
    pact.relationshipResolved=true;
    const r=$runtime.relationship(cpu.id);
    r.respectedPacts=Number(r.respectedPacts||0)+1;
    $runtime.changeRelationship(cpu.id,8,-2,'patto_rispettato');
    if(!wasGood && $runtime.hasGoodRelations(cpu)) $runtime.showToast(`🤝 ${cpu.profile?.label||cpu.team}: BUONI RAPPORTI.`);
  }

  function lateInRole(){ const role=$runtime.currentAuctionRole(); const missing=$runtime.state.managers.reduce((n,m)=>n+$runtime.roleSlotsRemaining(m,role),0); return missing<=4; }

  function eventEligibleBase(){
    return !!$runtime.state && !$runtime.state.completed && !!$runtime.state.auction && !$runtime.state.auction.awarding && !$runtime.ensureAuctionEvents().pending;
  }

  function cpuEventCandidates(){ return $runtime.state.managers.filter(m=>m.id!=='user' && m.roster.length<$runtime.TOTAL_SLOTS); }

  function sharedInterestingPlayers(cpu,limit=3){
    const role=$runtime.currentAuctionRole(), me=$runtime.state.managers[0];
    return $runtime.state.availableIds.map(id=>$runtime.playerMap.get(id)).filter(p=>p&&p.role===role&&$runtime.canOwn(me,p)&&$runtime.canOwn(cpu,p)&&$runtime.maxLegalBid(me,p)>=1&&$runtime.maxLegalBid(cpu,p)>=1)
      .map(p=>({p,score:$runtime.baseAuctionValue(p)+$runtime.cpuLimit(cpu,p)*.55+Number(p.ovr||0)*.25}))
      .sort((a,b)=>b.score-a.score).slice(0,Math.max(limit,8)).sort(()=>Math.random()-.5).slice(0,limit).map(x=>x.p);
  }

  function auctionEventAlreadyShown(type){
    return $runtime.ensureAuctionEvents().history.some(item=>item.type===type);
  }

  function eventRolePlayers(){
    const role=$runtime.currentAuctionRole(), me=$runtime.state.managers[0];
    return $runtime.state.availableIds.map(id=>$runtime.playerMap.get(id)).filter(p=>p&&p.role===role&&$runtime.canOwn(me,p)&&$runtime.maxLegalBid(me,p)>=1);
  }

  function tablePressureEligible(){
    const cpus=$runtime.cpuEventCandidates();
    if(!cpus.length) return false;
    const me=$runtime.state.managers[0];
    const avgBudget=cpus.reduce((sum,m)=>sum+Number(m.budget||0),0)/cpus.length;
    const myQuality=(me.roster||[]).reduce((sum,p)=>sum+Number(p.ovr||0),0);
    const avgQuality=cpus.reduce((sum,m)=>sum+(m.roster||[]).reduce((s,p)=>s+Number(p.ovr||0),0),0)/cpus.length;
    return Number(me.budget||0)>=avgBudget*.97 || myQuality>=avgQuality*1.04;
  }

  function availableEventTypes(){
    const types=[]; const cpus=$runtime.cpuEventCandidates(); if(!cpus.length) return types;
    if(!$runtime.auctionEffects('non_aggression_pact').length && cpus.some(c=>$runtime.sharedInterestingPlayers(c,1).length)) types.push({id:'pact',weight:26,rarity:'RARO'});
    if($runtime.state.availableIds.some(id=>$runtime.playerMap.get(id)?.role===$runtime.currentAuctionRole())){
      types.push({id:'info',weight:18,rarity:'COMUNE'});
      types.push({id:'contested',weight:18,rarity:'COMUNE'});
      types.push({id:'crazy',weight:18,rarity:'RARO'});
      types.push({id:'opportunity',weight:17,rarity:'COMUNE'});
      types.push({id:'untouchable',weight:15,rarity:'RARO'});
      types.push({id:'sudden',weight:18,rarity:'COMUNE'});
    }
    const duel=cpus.find(c=>$runtime.relationship(c.id).rivalry>=12) || cpus.find(c=>$runtime.profileArchetype(c)==='rivale');
    if(duel) types.push({id:'war',weight:10,rarity:'RARO'});
    if($runtime.tablePressureEligible()) types.push({id:'pressure',weight:14,rarity:'RARO'});
    return types;
  }

  function weightedPick(items){ let total=items.reduce((n,x)=>n+x.weight,0),r=Math.random()*total; for(const x of items){r-=x.weight;if(r<=0)return x;} return items[0]; }

  function maybeTriggerAuctionEvent(){
    if(!$runtime.eventEligibleBase() || Math.random()>=$runtime.AUCTION_EVENT_CHANCE) return false;
    const types=$runtime.availableEventTypes(); if(!types.length) return false;
    // Se un tipo non è costruibile in questa specifica situazione, prova gli altri
    // senza effettuare un secondo tiro percentuale: la probabilità resta 10% per chiamata.
    const remaining=[...types];
    let ev=null;
    while(remaining.length && !ev){
      const pick=$runtime.weightedPick(remaining);
      ev=$runtime.buildAuctionEvent(pick.id,pick.rarity);
      if(!ev){ const i=remaining.indexOf(pick); if(i>=0) remaining.splice(i,1); }
    }
    if(!ev)return false;
    const ae=$runtime.ensureAuctionEvents();
    ae.count++;
    ae.lastPurchaseAt=$runtime.state.stats.purchases;
    ae.pending=ev;
    ae.history.push({id:ev.id,type:ev.type,atPurchase:$runtime.state.stats.purchases,atPlayerId:$runtime.state.auction?.playerId||null,status:'shown'});
    if($runtime.state.auction) $runtime.state.auction.awaitingAuctionEvent=true;
    $runtime.saveState();
    $runtime.showAuctionEventModal(ev);
    return true;
  }

  function pickCpu(preferred){ const pool=$runtime.cpuEventCandidates(); return pool.find(m=>$runtime.profileArchetype(m)===preferred)||pool[Math.floor(Math.random()*pool.length)]; }

  function buildAuctionEvent(type,rarity){
    if(type==='pact'){ const cpu=$runtime.pickCpu('ragioniere'); if(!cpu)return null; const players=$runtime.sharedInterestingPlayers(cpu,3); if(!players.length)return null; return {id:`pact_${Date.now()}`,type,rarity,cpuId:cpu.id,playerIds:players.map(p=>p.id),refreshUsed:false}; }
    if(type==='info'){ const cpu=$runtime.pickCpu('esperto'); const pool=$runtime.eventRolePlayers(); if(!cpu||!pool.length)return null; const top=pool.sort((a,b)=>$runtime.baseAuctionValue(b)-$runtime.baseAuctionValue(a)).slice(0,Math.min(8,pool.length)); const pl=top[Math.floor(Math.random()*top.length)]; return {id:`info_${Date.now()}`,type,rarity,cpuId:cpu.id,playerId:pl.id,truth:Math.random()<({esperto:.88,ragioniere:.78,stratega:.84,pazzo:.48}[$runtime.profileArchetype(cpu)]||.65)}; }
    if(type==='contested'){ const cpu=$runtime.pickCpu('spendaccione'); const pool=$runtime.sharedInterestingPlayers(cpu,8); if(!cpu||!pool.length)return null; const pl=pool[Math.floor(Math.random()*pool.length)]; return {id:`contested_${Date.now()}`,type,rarity,cpuId:cpu.id,playerId:pl.id,bluff:Math.random()<.28}; }
    if(type==='war'){ const cpu=$runtime.cpuEventCandidates().sort((a,b)=>$runtime.relationship(b.id).rivalry-$runtime.relationship(a.id).rivalry)[0]; if(!cpu)return null; return {id:`war_${Date.now()}`,type,rarity,cpuId:cpu.id}; }
    if(type==='crazy'){
      const rolePlayers=$runtime.eventRolePlayers(); const players=rolePlayers.sort((a,b)=>$runtime.baseAuctionValue(b)-$runtime.baseAuctionValue(a)).slice(0,Math.min(14,rolePlayers.length));
      if(!players.length)return null;
      const pl=players[Math.floor(Math.random()*Math.min(7,players.length))];
      const interested=$runtime.cpuEventCandidates().filter(cpu=>$runtime.canOwn(cpu,pl)&&$runtime.maxLegalBid(cpu,pl)>=1).sort(()=>Math.random()-.5).slice(0,Math.min(4,Math.max(3,$runtime.cpuEventCandidates().length)));
      if(interested.length<2)return null;
      return {id:`crazy_${Date.now()}`,type,rarity,playerId:pl.id,cpuIds:interested.map(x=>x.id),multiplier:1.16};
    }
    if(type==='opportunity'){
      const cpus=$runtime.cpuEventCandidates();
      const pool=$runtime.eventRolePlayers().map(pl=>{
        const base=Math.max(1,$runtime.baseAuctionValue(pl));
        const legal=cpus.filter(cpu=>$runtime.canOwn(cpu,pl)&&$runtime.maxLegalBid(cpu,pl)>=1);
        const avg=legal.length?legal.reduce((sum,cpu)=>sum+$runtime.cpuLimit(cpu,pl),0)/legal.length:base;
        const ratio=avg/base;
        const quality=Number(pl.ovr||0)+base*.12;
        return {pl,score:quality+(1.08-ratio)*30};
      }).sort((a,b)=>b.score-a.score).slice(0,6);
      if(!pool.length)return null;
      const pl=pool[Math.floor(Math.random()*pool.length)].pl;
      return {id:`opportunity_${Date.now()}`,type,rarity,playerId:pl.id,multiplier:.82};
    }
    if(type==='untouchable'){
      const preferred=['collezionista','spendaccione','tifoso','bomber'];
      const rank=(m)=>{const i=preferred.indexOf($runtime.profileArchetype(m));return i<0?99:i;}; const candidates=$runtime.cpuEventCandidates().slice().sort((a,b)=>rank(a)-rank(b));
      for(const cpu of candidates){
        const pool=$runtime.sharedInterestingPlayers(cpu,6).sort((a,b)=>$runtime.cpuLimit(cpu,b)-$runtime.cpuLimit(cpu,a));
        if(pool.length){ const pl=pool[Math.floor(Math.random()*Math.min(3,pool.length))]; return {id:`untouchable_${Date.now()}`,type,rarity,cpuId:cpu.id,playerId:pl.id,multiplier:1.24}; }
      }
      return null;
    }
    if(type==='pressure'){
      if(!$runtime.tablePressureEligible())return null;
      return {id:`pressure_${Date.now()}`,type,rarity,remainingCalls:4,multiplier:1.10};
    }
    if(type==='sudden'){
      const players=$runtime.eventRolePlayers().sort((a,b)=>$runtime.baseAuctionValue(b)-$runtime.baseAuctionValue(a)).slice(0,18);
      if(!players.length)return null;
      const shuffled=players.slice().sort(()=>Math.random()-.5);
      for(const pl of shuffled){
        const base=Math.max(1,$runtime.baseAuctionValue(pl));
        const cpus=$runtime.cpuEventCandidates().filter(cpu=>$runtime.canOwn(cpu,pl)&&$runtime.maxLegalBid(cpu,pl)>=1).map(cpu=>({cpu,ratio:$runtime.cpuLimit(cpu,pl)/base})).filter(x=>x.ratio<1.08).sort((a,b)=>a.ratio-b.ratio);
        if(cpus.length){ const pick=cpus[Math.floor(Math.random()*Math.min(4,cpus.length))]; return {id:`sudden_${Date.now()}`,type,rarity,cpuId:pick.cpu.id,playerId:pl.id,multiplier:1.22,activated:false}; }
      }
      return null;
    }
    return null;
  }

  function eventPortrait(cpu){ const art=cpu&&$runtime.RIVAL_ART[$runtime.profileArchetype(cpu)]; return art?`<img src="assets/rivals/${art}.webp" alt="${$runtime.escapeHtml(cpu.profile?.label||cpu.team)}">`:`<span>${$runtime.escapeHtml($runtime.playerInitials(cpu?.name||'?'))}</span>`; }

  function auctionEventGenericPortrait(ev,cpu){
    if(ev.type==='crazy') return '<span>🔥</span>';
    if(ev.type==='opportunity') return '<span>💎</span>';
    if(ev.type==='pressure') return '<span>👀</span>';
    return $runtime.eventPortrait(cpu);
  }

  function showAuctionEventModal(ev){
    const modal=$runtime.$('auctionEventModal'); if(!modal||!ev)return;
    const cpu=$runtime.state.managers.find(m=>m.id===ev.cpuId), p=$runtime.playerMap.get(ev.playerId);
    $runtime.$('auctionEventPortrait').innerHTML=$runtime.auctionEventGenericPortrait(ev,cpu);
    $runtime.$('auctionEventRarity').textContent=ev.rarity||'EVENTO';
    let title='',desc='',body='',actions='';
    if(ev.type==='pact'){ title='Patto di non belligeranza'; desc=`${cpu.profile?.label||cpu.team} ti propone un accordo: evitare una guerra di rilanci su un obiettivo comune.`; body=`<div class="event-player-choices">${ev.playerIds.map((id,i)=>{const x=$runtime.playerMap.get(id);return `<button class="event-player-choice ${id===(ev.selectedPlayerId||ev.playerIds[0])?'selected':''}" data-event-player="${id}"><b>${$runtime.escapeHtml(x.name)}</b><span>${x.role} · OVR ${x.ovr} · Quot. ${x.quotation}</span></button>`}).join('')}</div><p class="event-rule">Se uno dei due è in testa, l'altro dovrebbe ritirarsi. Il patto può essere tradito.</p>`; actions=`<button data-event-action="reject" class="event-btn ghost">Rifiuta</button>${ev.refreshUsed?'':`<button data-event-action="refresh" class="event-btn secondary">Altri nomi</button>`}<button data-event-action="accept" class="event-btn primary">Accetta il patto</button>`; }
    if(ev.type==='info'){ title='Informazione riservata'; desc=`${cpu.profile?.label||cpu.team} ti passa una voce su ${p.name}: potrebbe perdere il posto da titolare.`; body=`<div class="event-info-card"><b>${$runtime.escapeHtml(p.name)}</b><span>${p.role} · ${$runtime.escapeHtml($runtime.clubName(p.club))} · OVR ${$runtime.currentPlayerOvr(p)}</span></div><p class="event-rule">La fonte potrebbe avere ragione oppure no. Fidarti ridurrà il valore attribuito al giocatore nelle funzioni automatiche.</p>`; actions=`<button data-event-action="ignore" class="event-btn ghost">Ignora</button><button data-event-action="trust" class="event-btn primary">Fidati</button>`; }
    if(ev.type==='contested'){ title='Giocatore conteso'; desc=`${cpu.profile?.label||cpu.team} dichiara pubblicamente: “${p.name} è il mio obiettivo.”`; body=`<div class="event-info-card"><b>${$runtime.escapeHtml(p.name)}</b><span>${p.role} · ${$runtime.escapeHtml($runtime.clubName(p.club))}</span></div><p class="event-rule">Potrebbe essere sincero o bluffare. La dichiarazione influenza anche l'interesse degli altri allenatori.</p>`; actions=`<button data-event-action="continue" class="event-btn primary">Continua l'asta</button>`; }
    if(ev.type==='war'){ title='Guerra personale'; desc=`${cpu.profile?.label||cpu.team} si è stancato dei duelli e decide di renderti la vita più difficile.`; body=`<p class="event-rule">Per le prossime 3 chiamate, quando siete entrambi coinvolti, la sua valutazione massima aumenta.</p>`; actions=`<button data-event-action="continue" class="event-btn primary">Accetta la sfida</button>`; }
    if(ev.type==='crazy'){
      const names=(ev.cpuIds||[]).map(id=>$runtime.state.managers.find(m=>m.id===id)?.profile?.label||$runtime.state.managers.find(m=>m.id===id)?.team).filter(Boolean);
      title='Asta impazzita';
      desc=`Il tavolo si accende improvvisamente su ${p.name}. Più allenatori hanno deciso di spingersi oltre il loro piano iniziale.`;
      body=`<div class="event-info-card"><b>${$runtime.escapeHtml(p.name)}</b><span>${p.role} · ${$runtime.escapeHtml($runtime.clubName(p.club))} · OVR ${$runtime.currentPlayerOvr(p)}</span></div><p class="event-rule">${$runtime.escapeHtml(names.slice(0,4).join(', '))} saranno più aggressivi quando ${$runtime.escapeHtml(p.name)} entrerà in asta.</p>`;
      actions='<button data-event-action="continue" class="event-btn primary">Vediamo cosa succede</button>';
    }
    if(ev.type==='opportunity'){
      title='Occasione di mercato';
      desc=`Al tavolo sembra esserci poco interesse per ${p.name}. Potrebbe essere il momento giusto per provare a prenderlo sotto prezzo.`;
      body=`<div class="event-info-card"><b>${$runtime.escapeHtml(p.name)}</b><span>${p.role} · ${$runtime.escapeHtml($runtime.clubName(p.club))} · OVR ${$runtime.currentPlayerOvr(p)}</span></div><p class="event-rule">Le CPU saranno temporaneamente meno aggressive su questo giocatore. L'occasione resta valida finché è disponibile.</p>`;
      actions='<button data-event-action="continue" class="event-btn primary">Segnalo l\'occasione</button>';
    }
    if(ev.type==='untouchable'){
      title='Giocatore intoccabile';
      desc=`${cpu.profile?.label||cpu.team} mette le cose in chiaro: “${p.name} è il mio uomo. Non lo lascio.”`;
      body=`<div class="event-info-card"><b>${$runtime.escapeHtml(p.name)}</b><span>${p.role} · ${$runtime.escapeHtml($runtime.clubName(p.club))} · OVR ${$runtime.currentPlayerOvr(p)}</span></div><p class="event-rule">Quell'allenatore alzerà sensibilmente il proprio tetto di spesa. Se glielo soffi, la rivalità tra voi aumenterà.</p>`;
      actions='<button data-event-action="continue" class="event-btn primary">Sfida accettata</button>';
    }
    if(ev.type==='pressure'){
      title='Pressione del tavolo';
      desc='Gli altri allenatori hanno iniziato a considerarti una minaccia e stanno osservando con più attenzione le tue mosse.';
      body='<p class="event-rule">Per le prossime 3 chiamate in cui puoi partecipare, le CPU saranno mediamente più aggressive contro di te.</p>';
      actions='<button data-event-action="continue" class="event-btn primary">Continua</button>';
    }
    if(ev.type==='sudden'){
      title='Interesse improvviso';
      desc=`${cpu.profile?.label||cpu.team} sembrava freddo su ${p.name}, ma qualcosa è cambiato.`;
      body=`<div class="event-info-card"><b>${$runtime.escapeHtml(p.name)}</b><span>${p.role} · ${$runtime.escapeHtml($runtime.clubName(p.club))}</span></div><p class="event-rule">Quando il giocatore entrerà in asta, quell'allenatore potrà inserirsi improvvisamente durante i rilanci con una valutazione più alta.</p>`;
      actions='<button data-event-action="continue" class="event-btn primary">Continua l\'asta</button>';
    }
    $runtime.$('auctionEventTitle').textContent=title; $runtime.$('auctionEventDescription').textContent=desc; $runtime.$('auctionEventBody').innerHTML=body; $runtime.$('auctionEventActions').innerHTML=actions; modal.dataset.eventId=ev.id; $runtime.$('auctionEventRestoreBtn')?.classList.add('hidden'); modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
    modal.querySelectorAll('[data-event-player]').forEach(b=>b.onclick=()=>{modal.querySelectorAll('[data-event-player]').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');ev.selectedPlayerId=b.dataset.eventPlayer;$runtime.saveState();});
    modal.querySelectorAll('[data-event-action]').forEach(b=>b.onclick=()=>$runtime.resolveAuctionEvent(b.dataset.eventAction));
  }

  function resolveAuctionEvent(action){ const ae=$runtime.ensureAuctionEvents(),ev=ae.pending;if(!ev)return; const cpu=$runtime.state.managers.find(m=>m.id===ev.cpuId);
    if(ev.type==='pact'&&action==='refresh'){ ev.refreshUsed=true; const ids=$runtime.sharedInterestingPlayers(cpu,6).map(p=>p.id).filter(id=>!ev.playerIds.includes(id)); ev.playerIds=(ids.slice(0,3).length?ids.slice(0,3):ev.playerIds); ev.selectedPlayerId=null; $runtime.saveState(); return $runtime.showAuctionEventModal(ev); }
    if(ev.type==='pact'&&action==='accept'){ const playerId=ev.selectedPlayerId||ev.playerIds[0]; ae.activeEffects.push({type:'non_aggression_pact',cpuId:ev.cpuId,playerId,createdAt:$runtime.state.stats.purchases,userBetrayed:false,cpuBetrayed:false}); $runtime.relationship(ev.cpuId).agreements++; $runtime.changeRelationship(ev.cpuId,5,-2,'patto_accettato'); $runtime.showToast(`Patto attivo su ${$runtime.playerMap.get(playerId)?.name}.`); }
    if(ev.type==='pact'&&action==='reject') $runtime.changeRelationship(ev.cpuId,-2,1,'patto_rifiutato');
    if(ev.type==='info'&&action==='trust'){ ae.activeEffects.push({type:'reserved_info',cpuId:ev.cpuId,playerId:ev.playerId,trusted:true,truth:ev.truth}); $runtime.changeRelationship(ev.cpuId,ev.truth?3:-2,0,'info_ascoltata'); }
    if(ev.type==='contested'&&action==='continue') ae.activeEffects.push({type:'contested_player',cpuId:ev.cpuId,playerId:ev.playerId,bluff:ev.bluff});
    if(ev.type==='war'&&action==='continue') ae.activeEffects.push({type:'personal_war',managerId:ev.cpuId,remainingCalls:4});
    if(ev.type==='crazy'&&action==='continue') ae.activeEffects.push({type:'crazy_auction',playerId:ev.playerId,cpuIds:[...(ev.cpuIds||[])],multiplier:Number(ev.multiplier||1.16)});
    if(ev.type==='opportunity'&&action==='continue') ae.activeEffects.push({type:'market_opportunity',playerId:ev.playerId,multiplier:Number(ev.multiplier||.82)});
    if(ev.type==='untouchable'&&action==='continue') ae.activeEffects.push({type:'untouchable_player',cpuId:ev.cpuId,playerId:ev.playerId,multiplier:Number(ev.multiplier||1.24)});
    if(ev.type==='pressure'&&action==='continue') ae.activeEffects.push({type:'table_pressure',remainingCalls:Number(ev.remainingCalls||4),multiplier:Number(ev.multiplier||1.10)});
    if(ev.type==='sudden'&&action==='continue') ae.activeEffects.push({type:'sudden_interest',cpuId:ev.cpuId,playerId:ev.playerId,multiplier:Number(ev.multiplier||1.22),activated:false});
    ae.history[ae.history.length-1].status=action;
    ae.pending=null;
    $runtime.closeAuctionEventModal();
    const liveAuction=$runtime.state.auction;
    if(liveAuction?.awaitingAuctionEvent){
      liveAuction.awaitingAuctionEvent=false;
      $runtime.saveState();
      $runtime.renderAll();
      return $runtime.beginBidRound();
    }
    $runtime.saveState(); $runtime.renderAll(); if($runtime.state.managers[$runtime.state.nominationIndex].id!=='user') $runtime.scheduleNomination();
  }

  function minimizeAuctionEventModal(){
    const modal=$runtime.$('auctionEventModal'), restore=$runtime.$('auctionEventRestoreBtn');
    if(!$runtime.state?.auctionEvents?.pending||!modal||!restore)return;
    modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true');
    restore.classList.remove('hidden'); restore.focus();
  }

  function restoreAuctionEventModal(){
    const modal=$runtime.$('auctionEventModal'), restore=$runtime.$('auctionEventRestoreBtn');
    if(!$runtime.state?.auctionEvents?.pending||!modal||!restore)return;
    restore.classList.add('hidden'); modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
    $runtime.$('auctionEventMinimizeBtn')?.focus();
  }

  function closeAuctionEventModal(){ const m=$runtime.$('auctionEventModal');if(m){m.classList.add('hidden');m.setAttribute('aria-hidden','true');} $runtime.$('auctionEventRestoreBtn')?.classList.add('hidden'); }

  function activePactForPlayer(playerId){ if($runtime.state?.auction?.arcade?.type==='mystery' && $runtime.state.auction.playerId===playerId)return null; return $runtime.auctionEffects('non_aggression_pact').find(e=>e.playerId===playerId); }

  function cpuKeepsPact(cpu,pact){ const base={ragioniere:.95,esperto:.90,stratega:.85,tirchio:.85,moneyball:.80,tifoso:.70,spendaccione:.55,pazzo:.35,rivale:.62,gambler:.48,bomber:.68,collezionista:.60}[$runtime.profileArchetype(cpu)]??.72; const rel=$runtime.relationship(cpu.id); return Math.random()<$runtime.clamp(base+(rel.trust-50)*.004-rel.rivalry*.002,.15,.99); }

  async function showPactBetrayPrompt(pact,increment){
    const cpu=$runtime.state.managers.find(m=>m.id===pact.cpuId),p=$runtime.playerMap.get(pact.playerId);
    const betray=await window.PixelDialog.confirm({eyebrow:'PATTO ATTIVO',title:'Vuoi tradire l’accordo?',message:`${cpu.profile?.label||cpu.team} è in testa su ${p.name}. Se rilanci perderai fiducia e aumenterà la rivalità.`,consequence:`Rilancio +${increment} · Fiducia −25 · Rivalità +28`,confirmLabel:`TRADISCI E RILANCIA +${increment}`,cancelLabel:'RISPETTA IL PATTO',tone:'danger'});
    if(!betray) return;
    pact.userBetrayed=true;
    $runtime.changeRelationship(cpu.id,-25,28,'tradimento_user');
    $runtime.showToast(`${cpu.profile?.label||cpu.team} ricorderà il tradimento.`,true);
    $runtime.saveState();
    $runtime.userBid(increment);
  }

  function tickAuctionEventEffectsOnNomination(playerId){
    const ae=$runtime.ensureAuctionEvents();
    for(const e of ae.activeEffects){
      if(e.type==='personal_war'&&e.remainingCalls>0)e.remainingCalls--;
      if(e.type==='table_pressure'&&e.remainingCalls>0&&$runtime.state?.auction?.activeIds?.includes('user')) e.remainingCalls--;
    }
    ae.activeEffects=ae.activeEffects.filter(e=>{
      if(e.type==='personal_war'||e.type==='table_pressure') return Number(e.remainingCalls||0)>0;
      if(['non_aggression_pact','reserved_info','contested_player','crazy_auction','market_opportunity','untouchable_player','sudden_interest'].includes(e.type)) return $runtime.state.availableIds.includes(e.playerId);
      return true;
    });
    const p=$runtime.playerMap.get(playerId);
    if(!p||!$runtime.state?.auction)return;
    if($runtime.auctionEffects('crazy_auction').some(e=>e.playerId===playerId)) $runtime.showToast(`🔥 ASTA IMPAZZITA su ${p.name}: più CPU sono pronte a spingersi oltre.`);
    if($runtime.auctionEffects('market_opportunity').some(e=>e.playerId===playerId)) $runtime.showToast(`💎 OCCASIONE DI MERCATO: il tavolo sembra freddo su ${p.name}.`);
    const untouchable=$runtime.auctionEffects('untouchable_player').find(e=>e.playerId===playerId);
    if(untouchable){ const cpu=$runtime.state.managers.find(m=>m.id===untouchable.cpuId); if(cpu) $runtime.showToast(`⚠ ${cpu.profile?.label||cpu.team} considera ${p.name} INTOCCABILE.`); }
  }
    return Object.freeze({ensureAuctionEvents,auctionEffects,relationship,changeRelationship,registerDirectAuctionDuel,resolveRespectedAuctionPact,lateInRole,eventEligibleBase,cpuEventCandidates,sharedInterestingPlayers,auctionEventAlreadyShown,eventRolePlayers,tablePressureEligible,availableEventTypes,weightedPick,maybeTriggerAuctionEvent,pickCpu,buildAuctionEvent,eventPortrait,auctionEventGenericPortrait,showAuctionEventModal,resolveAuctionEvent,minimizeAuctionEventModal,restoreAuctionEventModal,closeAuctionEventModal,activePactForPlayer,cpuKeepsPact,showPactBetrayPrompt,tickAuctionEventEffectsOnNomination});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['auction-events-controller']=Object.freeze({create});
})();
