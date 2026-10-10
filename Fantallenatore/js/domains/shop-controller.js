/* Responsibility: shop-controller. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: shop-controller');
  function ensureCareerEconomy(){
    if(!$runtime.state) return null;
    $runtime.state.career=$runtime.CareerEngine.normalizeCareer($runtime.state.career,$runtime.CAREER_STARTING_EUROS,$runtime.GAME_CONFIG.startingDivision);
    return $runtime.state.career;
  }

  function sponsorVisualAsset(id){
    return ({
      double_block:'assets/sponsors/zalandiolo.png',
      win_bonus:'assets/sponsors/lavezzi.webp',
      free_subscription:'assets/sponsors/cobocolo.webp',
      future_auction:'assets/sponsors/burgerkane.webp',
      bonus_firma:'assets/sponsors/amauri.webp',
      big_match:'assets/sponsors/netoflix.webp',
      streak_bonus:'assets/sponsors/adibala.webp',
      academy:'assets/sponsors/ala-romelu.webp',
      fantasy_bonus:'assets/sponsors/mctominasy.webp',
      fantacana:'assets/sponsors/haaland-rover.webp'
    })[String(id)] || 'assets/sponsors/lavezzi.webp';
  }

  function sponsorVisualBrand(id){
    return ({
      double_block:'Zalandiolo',
      win_bonus:'LAVEZZI',
      free_subscription:'CoboColo',
      future_auction:'Burger Kane',
      bonus_firma:'Amauri',
      big_match:'Netoflix',
      streak_bonus:'Adibala',
      academy:'Ala Romelu',fantasy_bonus:'McTominasy’s',fantacana:'Haaland Rover'
    })[String(id)] || 'Sponsor';
  }

  function currentSponsorChoice(){
    const id=String($runtime.state?.sponsorChoice?.id||$runtime.state?.sponsorChoice||'');
    return $runtime.SEASON_SPONSORS[id]||null;
  }

  function currentSponsorOffers(){
    if(!$runtime.state) return Object.values($runtime.SEASON_SPONSORS).slice(0,3);
    const allIds=Object.keys($runtime.SEASON_SPONSORS);
    let changed=false;
    if(!Array.isArray($runtime.state.sponsorOfferIds)){
      $runtime.state.sponsorOfferIds=[];
      changed=true;
    }
    const ids=$runtime.state.sponsorOfferIds.map(id=>String(id)).filter((id,index,list)=>$runtime.SEASON_SPONSORS[id] && list.indexOf(id)===index);
    if(ids.length!==$runtime.state.sponsorOfferIds.length) changed=true;
    const missing=$runtime.shuffledCopy(allIds).filter(id=>!ids.includes(id));
    while(ids.length<3 && missing.length){
      ids.push(missing.shift());
      changed=true;
    }
    $runtime.state.sponsorOfferIds=ids.slice(0,3);
    if(changed) $runtime.saveState();
    return $runtime.state.sponsorOfferIds.map(id=>$runtime.SEASON_SPONSORS[id]).filter(Boolean);
  }

  function selectSeasonSponsor(id){
    if(!$runtime.state || $runtime.state.season?.started) return;
    const sponsor=$runtime.SEASON_SPONSORS[String(id)];
    if(!sponsor || !$runtime.currentSponsorOffers().some(offer=>offer.id===sponsor.id)) return;
    const choices=$runtime.CareerEngine.selectedSponsorChoices($runtime.state);
    if(Number($runtime.state.sponsorSlots)===2){
      const index=choices.findIndex(choice=>choice.id===sponsor.id);
      if(index>=0) choices.splice(index,1);
      else if(choices.length<2) choices.push({id:sponsor.id,selectedAt:Date.now()});
      else { $runtime.showToast('Hai già scelto 2 sponsor. Togli una firma per cambiarli.'); return; }
      $runtime.state.sponsorChoice=choices.length?{...choices[0],additionalChoices:choices.slice(1)}:null;
    }else $runtime.state.sponsorChoice={id:sponsor.id,selectedAt:Date.now()};
    $runtime.saveState();
    $runtime.renderSponsorSelection();
    $runtime.showToast(`${sponsor.name}: accordo selezionato.`);
  }

  function selectAcademySponsorPlayer(id){
    if($runtime.state?.season?.started) return;
    const choice=$runtime.CareerEngine.selectedSponsorChoices($runtime.state).find(choice=>choice.id==='academy');
    if(!choice) return;
    const player=$runtime.state.managers?.[0]?.roster?.find(p=>String(p.id)===String(id) && Number(p.ovr||0)<=97);
    choice.playerId=player?String(player.id):null;
    $runtime.saveState();
    $runtime.renderSponsorSelection();
  }

  function renderSponsorSelection(){
    const panel=$runtime.$('sponsorSelectionPanel'),grid=$runtime.$('sponsorCards'),summary=$runtime.$('sponsorChosenSummary'),startBtn=$runtime.$('startLeagueBtn');
    if(!panel || !grid) return;
    const selected=$runtime.currentSponsorChoice();
    const choices=$runtime.CareerEngine.selectedSponsorChoices($runtime.state);
    const chosenIds=new Set(choices.map(choice=>choice.id));
    const academyChoice=choices.find(choice=>choice.id==='academy');
    const slots=Number($runtime.state.sponsorSlots)===2?2:1;
    const ready=choices.length===slots;
    const description=panel.querySelector('.sponsor-selection-head p');
    if(description) description.textContent=slots===2?'Celebrità attiva: scegli 2 dei 3 sponsor. Entrambi restano attivi per tutta la stagione. Puoi togliere una firma per cambiare scelta.':'Puoi firmare un solo accordo. Lo sponsor resta attivo per tutta la stagione.';
    const sponsorOffers=$runtime.currentSponsorOffers();
    grid.innerHTML=sponsorOffers.map((s,index)=>{
      const art=$runtime.sponsorVisualAsset(s.id);
      const brand=$runtime.sponsorVisualBrand(s.id);
      return `<div class="sponsor-card-stage ${chosenIds.has(s.id)?'selected':''}">
        <div class="sponsor-card-blur" aria-hidden="true"><img src="${art}" alt=""></div>
        <article class="sponsor-flip-card ${chosenIds.has(s.id)?'selected is-flipped':''}" data-sponsor-card="${$runtime.escapeHtml(s.id)}" tabindex="0" role="button" aria-label="Carta sponsor ${$runtime.escapeHtml(s.name)}. Clicca per girare.">
          <div class="sponsor-flip-inner">
            <section class="sponsor-card-face sponsor-card-front">
              <img class="sponsor-card-cover" src="${art}" alt="Sponsor ${$runtime.escapeHtml(brand)}">
              <span class="sponsor-card-index">0${index+1}</span>
              <div class="sponsor-card-front-footer">
                <span class="sponsor-card-front-category">SPONSOR</span>
                <span class="sponsor-card-front-brand">${$runtime.escapeHtml(brand)}</span>
                <button type="button" class="sponsor-card-flip-btn" data-sponsor-flip="${$runtime.escapeHtml(s.id)}">GIRA ↻</button>
              </div>
            </section>
            <section class="sponsor-card-face sponsor-card-back">
              <div class="sponsor-card-back-top">
                <span class="sponsor-choice-icon">${s.icon}</span>
                <span class="sponsor-choice-category">${$runtime.escapeHtml(s.name)}</span>
                <span class="sponsor-card-badge">CONTRATTO</span>
              </div>
              <div class="sponsor-card-back-copy">
                <strong>${$runtime.escapeHtml(s.title)}</strong>
                <small>${$runtime.escapeHtml(s.description)}</small>
              </div>
              <div class="sponsor-card-back-footer">
                <button type="button" class="sponsor-card-flip-back-btn" data-sponsor-flip="${$runtime.escapeHtml(s.id)}">↺ RIGIRA</button>
                <button type="button" class="sponsor-card-select-btn" data-sponsor-id="${$runtime.escapeHtml(s.id)}" ${chosenIds.has(s.id)&&slots===1?'disabled':''}>${chosenIds.has(s.id)?(slots===2?'TOGLI FIRMA':'✓ FIRMATO'):'FIRMA ✓'}</button>
              </div>
            </section>
          </div>
        </article>
      </div>`;
    }).join('');

    const toggleCard=(id)=>{
      const card=grid.querySelector(`[data-sponsor-card="${CSS.escape(String(id))}"]`);
      if(!card) return;
      const flipped=card.classList.toggle('is-flipped');
      card.setAttribute('aria-label',flipped?'Carta sponsor girata. Leggi l’offerta o firma il contratto.':'Carta sponsor coperta. Clicca per girare.');
    };

    // Un solo gestore per evitare conflitti tra flip 3D e pulsante FIRMA.
    // FIRMA ha sempre priorità: se il click nasce lì, la carta NON gira.
    grid.onclick=(e)=>{
      const signBtn=e.target.closest('[data-sponsor-id]');
      if(signBtn && grid.contains(signBtn)){
        e.preventDefault();
        e.stopPropagation();
        if(signBtn.disabled) return;
        const sponsorId=signBtn.dataset.sponsorId;
        signBtn.disabled=true;
        signBtn.textContent='FIRMATO ✓';
        $runtime.selectSeasonSponsor(sponsorId);
        return;
      }

      const card=e.target.closest('[data-sponsor-card]');
      if(!card || !grid.contains(card)) return;

      // Qualunque altro punto della carta, compresi GIRA e RIGIRA, esegue il flip.
      e.preventDefault();
      toggleCard(card.dataset.sponsorCard);
    };

    grid.onkeydown=(e)=>{
      if(e.target.closest('[data-sponsor-id]')) return;
      const card=e.target.closest('[data-sponsor-card]');
      if(!card || !grid.contains(card)) return;
      if((e.key==='Enter' || e.key===' ') && !e.target.closest('button')){
        e.preventDefault();
        toggleCard(card.dataset.sponsorCard);
      }
    };

    if(summary) summary.innerHTML=selected
      ? `<span>SPONSOR SCELTI · ${choices.length}/${slots}</span>${choices.map(choice=>$runtime.SEASON_SPONSORS[choice.id]).filter(Boolean).map(s=>`<strong>${s.icon} ${$runtime.escapeHtml(s.name)}</strong><small>${$runtime.escapeHtml(s.title)}</small>`).join('')}${academyChoice?`<label class="sponsor-academy-label" for="sponsorAcademyPlayer">Giocatore da far crescere</label><select id="sponsorAcademyPlayer"><option value="">Scegli un giocatore</option>${($runtime.state.managers?.[0]?.roster||[]).filter(p=>Number(p.ovr||0)<=97).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'it')).map(p=>`<option value="${$runtime.escapeHtml(p.id)}" ${String(academyChoice?.playerId||'')===String(p.id)?'selected':''}>${$runtime.escapeHtml(p.name)} · ${p.role} · OVR ${$runtime.currentPlayerOvr(p)}</option>`).join('')}</select>`:''}`
      : `<span>SPONSOR · 0/${slots}</span><strong>Gira le 3 carte e scegli ${slots===2?'2 sponsor':'il contratto stagionale'}.</strong>`;
    summary?.querySelector('#sponsorAcademyPlayer')?.addEventListener('change',event=>$runtime.selectAcademySponsorPlayer(event.target.value));
    if(startBtn){
      startBtn.disabled=false;
      startBtn.textContent=ready?'INIZIA CAMPIONATO':slots===2?`SCEGLI 2 SPONSOR · ${choices.length}/2`:'SCEGLI UNO SPONSOR';
      startBtn.classList.toggle('sponsor-needed', !ready);
    }
  }

  function seasonSponsorFromChoice(choice=$runtime.currentSponsorChoice()){
    const choices=$runtime.CareerEngine.selectedSponsorChoices($runtime.state);
    const sponsors=choices.map(selected=>$runtime.CareerEngine.createSeasonSponsor({...$runtime.SEASON_SPONSORS[typeof selected==='string'?selected:selected.id],playerId:selected.playerId}));
    if(!sponsors.length) return $runtime.CareerEngine.createSeasonSponsor(choice);
    sponsors[0].additionalSponsors=sponsors.slice(1);
    return sponsors[0];
  }

  function sponsorFreeSubscriptionAvailable(season=$runtime.ensureSeasonState()){
    const sponsor=$runtime.CareerEngine.findSeasonSponsor(season,'free_subscription');
    return !!(sponsor && !sponsor.freeSubscriptionUsed);
  }

  function sponsorCanMakeShopItemFree(id,season=$runtime.ensureSeasonState()){
    return $runtime.CareerEngine.sponsorCanMakeItemFree(id,season,$runtime.SPONSOR_FREE_SHOP_IDS);
  }

  function sortStandingsSnapshot(standings=[]){
    return $runtime.sortFantasyLeagueStandings(standings,$runtime.state?.season);
  }

  function grantImmediateSponsorBonus(season=$runtime.ensureSeasonState()){
    return $runtime.CareerEngine.grantImmediateSponsorBonus($runtime.ensureCareerEconomy(),season);
  }

  function grantBigMatchSponsorReward(season,day,dayResult,preMatchStandings=[]){
    const top3=$runtime.sortStandingsSnapshot(preMatchStandings).slice(0,3).map(s=>String(s.managerId));
    return $runtime.CareerEngine.grantBigMatchSponsorReward($runtime.ensureCareerEconomy(),season,day,dayResult,top3);
  }

  function grantStreakSponsorReward(season,day,dayResult){
    return $runtime.CareerEngine.grantStreakSponsorReward($runtime.ensureCareerEconomy(),season,day,dayResult);
  }

  function grantWinSponsorReward(season,day,dayResult){
    return $runtime.CareerEngine.grantWinSponsorReward($runtime.ensureCareerEconomy(),season,day,dayResult);
  }

  function grantFutureAuctionSponsorBonus(season=$runtime.ensureSeasonState()){
    return $runtime.CareerEngine.grantFutureAuctionBonus($runtime.ensureCareerEconomy(),season);
  }

  function ensureSeasonShop(season=$runtime.ensureSeasonState()){
    if(!season) return null;
    if(!season.shopPurchases || typeof season.shopPurchases!=='object') season.shopPurchases={};
    return season.shopPurchases;
  }

  function shopItemActive(id,season=$runtime.ensureSeasonState()){
    const purchases=season?.shopPurchases;
    return !!purchases?.[id];
  }

  function careerEuros(){
    return $runtime.CareerEngine.balance($runtime.ensureCareerEconomy());
  }

  function careerFantapoints(){
    return Math.max(0,Math.floor(Number($runtime.ensureCareerEconomy()?.fantapoints||0)));
  }

  function ensureConsumableState(season=$runtime.ensureSeasonState()){
    if(!season) return null;
    season.consumables ||= {inventory:{},effects:{},usageHistory:[],purchaseHistory:[]};
    season.consumables.inventory ||= {};
    season.consumables.effects ||= {};
    if(!Array.isArray(season.consumables.usageHistory)) season.consumables.usageHistory=[];
    if(!Array.isArray(season.consumables.purchaseHistory)) season.consumables.purchaseHistory=[];
    return season.consumables;
  }

  function consumableQuantity(id,season=$runtime.ensureSeasonState()){
    const data=$runtime.ensureConsumableState(season);
    return Math.max(0,Math.floor(Number(data?.inventory?.[id]||0)));
  }

  function consumableDayEffect(day=$runtime.ensureSeasonState()?.currentMatchday,season=$runtime.ensureSeasonState()){
    const data=$runtime.ensureConsumableState(season);
    const key=String(day||1);
    data.effects[key] ||= {};
    return data.effects[key];
  }

  function addConsumable(id,amount=1,season=$runtime.ensureSeasonState()){
    const data=$runtime.ensureConsumableState(season);
    if(!data) return 0;
    const next=$runtime.consumableQuantity(id,season)+Math.max(0,Math.floor(Number(amount||0)));
    data.inventory[id]=next;
    return next;
  }

  function consumeConsumable(id,{day=$runtime.ensureSeasonState()?.currentMatchday,note='',targetPlayerId=null}={}){
    const season=$runtime.ensureSeasonState(),data=$runtime.ensureConsumableState(season);
    if(!data || $runtime.consumableQuantity(id,season)<=0) return false;
    data.inventory[id]=$runtime.consumableQuantity(id,season)-1;
    data.usageHistory.push({id,day:Number(day||0),note:String(note||''),targetPlayerId:targetPlayerId?String(targetPlayerId):null,usedAt:Date.now()});
    document.querySelectorAll('[data-consumable-inventory-count]').forEach(el=>el.textContent=String($runtime.totalConsumablesOwned(season)));
    return true;
  }

  function totalConsumablesOwned(season=$runtime.ensureSeasonState()){
    const data=$runtime.ensureConsumableState(season);
    return Object.values(data?.inventory||{}).reduce((sum,value)=>sum+Math.max(0,Math.floor(Number(value||0))),0);
  }

  function shopPurchaseOrigin(id){
    const node=document.querySelector(`[data-shop-buy="${id}"]`);
    return node?.getBoundingClientRect?.();
  }

  function animateShopPurchase(item,origin,currency,before,after){
    if(!origin || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
    const wallet=document.querySelector(currency==='fp'?'#shopFantapointsAmount':'#shopWalletAmount');
    const target=document.querySelector('#shopActiveSummary')||wallet;
    if(!target?.animate || !wallet) return;
    const end=target.getBoundingClientRect();
    const token={};wallet._purchaseAnimation=token;
    $runtime.animateMatchdayRewardNumber(before,after,650,value=>{if(wallet.isConnected&&wallet._purchaseAnimation===token)wallet.textContent=String(value);},()=>wallet.isConnected&&wallet._purchaseAnimation===token);
    const icon=document.createElement('span');icon.className='shop-purchase-flight';
    icon.setAttribute('aria-hidden','true');icon.textContent=item.icon||'★';
    icon.style.left=`${origin.left+origin.width/2}px`;icon.style.top=`${origin.top}px`;
    document.body.appendChild(icon);
    const flight=icon.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:`translate(${end.left+end.width/2-origin.left-origin.width/2}px,${end.top+end.height/2-origin.top}px) scale(.5)`,opacity:0}],{duration:650,easing:'ease-in'});
    flight.finished.then(()=>icon.remove(),()=>icon.remove());
    target.animate([{filter:'brightness(1)'},{filter:'brightness(1.7)'},{filter:'brightness(1)'}],{duration:750});
  }

  function buyConsumableItem(item,paymentCurrency='fp'){
    const season=$runtime.ensureSeasonState(),career=$runtime.ensureCareerEconomy();
    if(!season||!career||!item?.consumable) return false;
    if(season.completed){$runtime.showToast('La stagione è terminata: il negozio è chiuso.',true);return false;}
    const currency=item.currency==='fp' || paymentCurrency==='fp'?'fp':'eur';
    const cost=Math.max(0,Math.floor(Number(currency==='fp'?(item.fpCost||item.cost):item.cost)));
    const before=currency==='fp'?$runtime.careerFantapoints():$runtime.careerEuros();
    if(before<cost){$runtime.showToast(`Saldo insufficiente: servono ${cost} ${currency==='fp'?'FP':'€'} per ${item.name}.`,true);return false;}
    const origin=$runtime.shopPurchaseOrigin(item.id);
    if(currency==='fp'){
      career.fantapoints=before-cost;
      career.totalFantapointsSpent=Number(career.totalFantapointsSpent||0)+cost;
    }else if(!$runtime.CareerEngine.debit(career,cost)) return false;
    const quantity=$runtime.addConsumable(item.id,1,season);
    season.consumables.purchaseHistory.push({id:item.id,cost,currency,quantityAfter:quantity,purchasedAt:Date.now()});
    $runtime.saveState();
    $runtime.renderCareerWallets();
    $runtime.renderLeagueShopScreen();
    $runtime.animateShopPurchase(item,origin,currency,before,currency==='fp'?$runtime.careerFantapoints():$runtime.careerEuros());
    $runtime.showToast(`${item.name} aggiunto all'inventario · x${quantity}.`);
    return true;
  }

  function grantMatchdayFantapoints(season,day,dayResult){
    if(!season||!dayResult||dayResult.fantapointsReward) return dayResult?.fantapointsReward||null;
    const match=(dayResult.matches||[]).find(item=>item.homeId==='user'||item.awayId==='user');
    if(!match) return null;
    const userHome=match.homeId==='user';
    const goals=Math.max(0,Number(userHome?match.homeScore:match.awayScore)||0);
    const conceded=Math.max(0,Number(userHome?match.awayScore:match.homeScore)||0);
    const won=goals>conceded,draw=goals===conceded;
    const parts={participation:3,outcome:won?8:draw?3:0,goals:goals*2,cleanSheet:conceded===0?2:0,powers:0,
      sponsor:$runtime.CareerEngine.findSeasonSponsor(season,'fantasy_bonus') && goals>=2 ? 2 : 0};
    const total=Object.values(parts).reduce((sum,value)=>sum+Number(value||0),0);
    const career=$runtime.ensureCareerEconomy(),balanceBefore=$runtime.careerFantapoints();
    career.fantapoints=balanceBefore+total;
    career.totalFantapointsEarned=Number(career.totalFantapointsEarned||0)+total;
    const reward={day:Number(day),parts,total,balanceBefore,balanceAfter:career.fantapoints,createdAt:Date.now()};
    dayResult.fantapointsReward=reward;
    career.fantapointsHistory.push({seasonNumber:Number(career.seasonNumber||1),...reward});
    career.fantapointsHistory=career.fantapointsHistory.slice(-76);
    return reward;
  }

  function careerDivisionLabel(division=$runtime.state?.career?.division||$runtime.GAME_CONFIG.startingDivision){
    const value=Math.max(1,Math.floor(Number(division||$runtime.GAME_CONFIG.startingDivision)));
    return ({4:'Lega Amatori',3:'Serie C',2:'Serie B',1:'Serie A'})[value] || `Divisione ${value}`;
  }

  function careerPromotionNote(division=$runtime.state?.career?.division||$runtime.GAME_CONFIG.startingDivision){
    const value=Math.max(1,Math.floor(Number(division||$runtime.GAME_CONFIG.startingDivision)));
    if(value<=1) return '* 1° posto: campione della Serie A · Ultimo posto: retrocessione in Serie B';
    const promotion=`* 1° posto: promosso in ${$runtime.careerDivisionLabel(value-1)}`;
    return value<4?`${promotion} · Ultimo posto: retrocessione in ${$runtime.careerDivisionLabel(value+1)}`:promotion;
  }

  function careerSeasonLabel(seasonNumber=$runtime.state?.career?.seasonNumber||1){
    const n=Math.max(1,Math.floor(Number(seasonNumber||1)));
    const start=2026+n-1;
    return `${start}/${String(start+1).slice(-2)}`;
  }

  function renderCareerWallets(){
    document.querySelectorAll('.career-wallet-chip').forEach(wallet=>{
      const parent=wallet.parentElement;
      if(!parent||parent.querySelector(':scope > .fantapoints-wallet')) return;
      const chip=document.createElement('div');
      chip.className=`${wallet.className} fantapoints-wallet`;
      chip.title='Fantapoints disponibili';
      chip.innerHTML='<span>◆</span><small>FP</small><b data-fantapoints-value>0</b>';
      wallet.insertAdjacentElement('afterend',chip);
    });
    const value=$runtime.careerEuros();
    document.querySelectorAll('[data-career-wallet-value]').forEach(el=>el.textContent=String(value));
    document.querySelectorAll('[data-fantapoints-value]').forEach(el=>el.textContent=String($runtime.careerFantapoints()));
    const inventoryCount=$runtime.state?.season?.started?$runtime.totalConsumablesOwned($runtime.state.season):0;
    document.querySelectorAll('[data-consumable-inventory-count]').forEach(el=>el.textContent=String(inventoryCount));
    const division=Math.max(1,Math.floor(Number($runtime.state?.career?.division||$runtime.GAME_CONFIG.startingDivision)));
    document.querySelectorAll('[data-current-division]').forEach(el=>el.textContent=$runtime.careerDivisionLabel(division));
  }

  function applyGameConfiguration(){
    document.title=`Fantallenatore — V${$runtime.GAME_CONFIG.buildVersion}`;
    document.querySelectorAll('[data-game-build]').forEach(el=>el.textContent=`V${$runtime.GAME_CONFIG.buildVersion}`);
    document.querySelectorAll('[data-game-season]').forEach(el=>el.textContent=$runtime.careerSeasonLabel());
    document.querySelectorAll('[data-game-league]').forEach(el=>el.textContent=$runtime.careerDivisionLabel());
    document.querySelectorAll('[data-current-division]').forEach(el=>el.textContent=$runtime.careerDivisionLabel());
  }

  function formationEventChance(){
    return $runtime.shopItemActive('fortune') ? .50 : $runtime.FORMATION_EVENT_CHANCE;
  }

  function seasonShockChance(){
    const division=Math.max(1,Math.floor(Number($runtime.state?.career?.division||$runtime.GAME_CONFIG.startingDivision)));
    return division>=4 ? 0 : division===3 ? .05 : division===2 ? .07 : .09;
  }

  function formationChoiceRarity(templateId){
    return $runtime.FORMATION_CHOICE_RARITY_BY_TEMPLATE[String(templateId)] || 'common';
  }

  function formationChoiceRarityLabel(rarity){
    return ({common:'COMUNE',rare:'RARA',epic:'EPICA'})[rarity] || 'COMUNE';
  }

  function formationRarityWeights(){
    if(!$runtime.formationRaritiesUnlocked()) return {common:1,rare:0,epic:0};
    return {common:1.0,rare:.88,epic:.55};
  }

  function formationRaritiesUnlocked(){
    return $runtime.shopItemActive('special_events');
  }

  function specialFormationEventsUnlocked(){
    return $runtime.shopItemActive('special_events');
  }

  function deterministicFormationTemplateOrder(day,salt='base'){
    const weights=$runtime.formationRarityWeights();
    const allowSpecial=$runtime.specialFormationEventsUnlocked();
    return $runtime.FORMATION_CHOICE_TEMPLATES.filter(template=>
      ($runtime.formationChoiceRarity(template.id)==='common' || $runtime.formationRaritiesUnlocked()) &&
      (allowSpecial || !$runtime.SPECIAL_FORMATION_EVENT_TEMPLATE_IDS.has(String(template.id)))
    ).map(template=>{
      const rarity=$runtime.formationChoiceRarity(template.id);
      const weight=Math.max(.05,Number(weights[rarity]||1));
      const r=Math.max(.000001,$runtime.careerHash(`formation-choice|${day}|${salt}|weighted-template|${template.id}`));
      return {template,score:-Math.log(r)/weight,rarity};
    }).sort((a,b)=>a.score-b.score || String(a.template.id).localeCompare(String(b.template.id),'it'));
  }

  function buyShopItem(id,paymentCurrency='eur'){
    const season=$runtime.ensureSeasonState(),career=$runtime.ensureCareerEconomy(),item=$runtime.SHOP_ITEMS[id];
    if(!season || !career || !item) return;
    if(item.id==='assistant_tactical_pro' && !$runtime.shopItemActive('assistant_coach',season)){$runtime.showToast('Serve prima l’Assistente Tecnico.',true);return;}
    if(item.consumable){ $runtime.buyConsumableItem(item,paymentCurrency); return; }
    const requestedCurrency=paymentCurrency==='fp'?'fp':'eur';
    const fpCost=Math.max(0,Math.floor(Number(item.fpCost||0)));
    const origin=$runtime.shopPurchaseOrigin(id),before=requestedCurrency==='fp'?$runtime.careerFantapoints():$runtime.careerEuros();
    const result=$runtime.CareerEngine.buyShopItem(career,season,item,id,{
      freeItemIds:$runtime.SPONSOR_FREE_SHOP_IDS,
      currency:requestedCurrency,
      fpCost
    });
    if(!result.ok){
      if(result.reason==='season_completed') $runtime.showToast('La stagione è terminata: gli acquisti stagionali sono chiusi.',true);
      else if(result.reason==='already_active') $runtime.showToast(`${item.name} è già attivo per questa stagione.`);
      else if(result.reason==='fp_not_available') $runtime.showToast(`${item.name} non è acquistabile con Fantapoints.`,true);
      else if(result.reason==='insufficient_fantapoints') $runtime.showToast(`Fantapoints insufficienti: servono ${fpCost} FP per ${item.name}.`,true);
      else if(result.reason==='insufficient_funds') $runtime.showToast(`Saldo insufficiente: servono ${item.cost} € per ${item.name}.`,true);
      return;
    }
    if(id==='expert_precision' && season.expertDays){
      delete season.expertDays[String(season.currentMatchday||1)];
    }
    $runtime.saveState();
    $runtime.renderCareerWallets();
    $runtime.renderLeagueShopScreen();
    $runtime.animateShopPurchase(item,origin,requestedCurrency,before,requestedCurrency==='fp'?$runtime.careerFantapoints():$runtime.careerEuros());
    const paymentText=result.free?'GRATIS grazie allo sponsor':result.currency==='fp'?`${result.cost} FP`:`${result.cost} €`;
    $runtime.showToast(`${item.name} attivato fino a fine stagione · ${paymentText}.`);
  }

  function shopItemsPerPage(){
    const w=Number(window.innerWidth||1280);
    if(w<=720) return 1;
    if(w<=1100) return 2;
    return 4;
  }

  function shopItemEffectLine(item,active=$runtime.shopItemActive(item.id)){
    if(item?.consumable) return `Inventario: <b>x${$runtime.consumableQuantity(item.id)}</b> · usa quando disponibile`;
    if(item.id==='fortune') return `Probabilità carte: <b>${Math.round($runtime.formationEventChance()*100)}%</b>`;
    if(item.id==='special_events') return `Rare/Epiche e carte speciali: <b>${active?'sbloccate':'bloccate'}</b>`;
    if(item.id==='expert_precision') return active?'Precisione esperti: <b>molto alta</b> · margine d’errore ridotto.':'Precisione esperti: <b>standard</b> · più possibilità di letture sbagliate.';
    if(item.id==='assistant_coach') return active?'AUTO XI e gestione formazione <b>attivi</b>.':'Gestione formazione e indisponibili <b>automatizzata</b>.';
    if(item.id==='scout_plus') return active?'Stima titolarità <b>visibile</b> nei dati giocatore.':'Aggiunge una <b>stima di titolarità</b>.';
    if(item.id==='fantadata_pro') return active?'Statistiche avanzate <b>sbloccate</b>.':'Sblocca <b>statistiche avanzate</b> e forma.';
    return active?'Servizio attivo per la stagione corrente.':'Valido fino alla fine della stagione corrente.';
  }

  function shopCardHtml(item){
    const season=$runtime.ensureSeasonState();
    const consumable=!!item.consumable;
    const quantity=consumable?$runtime.consumableQuantity(item.id,season):0;
    const active=!consumable && $runtime.shopItemActive(item.id,season);
    const freeBySponsor=!consumable && $runtime.sponsorCanMakeShopItemFree(item.id,season);
    const dualCurrency=Number(item.fpCost)>0;
    const euroCanAfford=freeBySponsor || $runtime.careerEuros()>=Number(item.cost||0);
    const fpCanAfford=dualCurrency && $runtime.careerFantapoints()>=Number(item.fpCost||0);
    const balance=item.currency==='fp'?$runtime.careerFantapoints():$runtime.careerEuros();
    const canAfford=freeBySponsor || balance>=item.cost;
    const locked=!!season?.completed;
    const effectLine=$runtime.shopItemEffectLine(item,active);
    const priceIcon=item.currency==='fp'?'◆':'💶';
    const priceText=freeBySponsor&&!active?'GRATIS':dualCurrency?`${item.cost} €  /  ${item.fpCost} FP`:`${item.cost} ${item.currency==='fp'?'FP':'€'}`;
    let button='';
    if(consumable && !dualCurrency){
      button=locked
        ? '<button type="button" class="shop-buy-btn" disabled>CHIUSO</button>'
        : `<button type="button" class="shop-buy-btn ${canAfford?'primary':''}" data-shop-buy="${$runtime.escapeHtml(item.id)}" ${canAfford?'':'disabled'}>${canAfford?'ACQUISTA +1':'SALDO INSUFFICIENTE'}</button>`;
    }else if(active){
      button='<button type="button" class="shop-buy-btn active" disabled>✓ ATTIVO</button>';
    }else if(locked){
      button='<button type="button" class="shop-buy-btn" disabled>CHIUSO</button>';
    }else if(freeBySponsor){
      button=`<button type="button" class="shop-buy-btn primary" data-shop-buy="${$runtime.escapeHtml(item.id)}" data-shop-currency="eur">ATTIVA GRATIS</button>`;
    }else if(dualCurrency){
      button=`<div class="shop-dual-buy-actions">
        <button type="button" class="shop-buy-btn shop-buy-euro ${euroCanAfford?'primary':''}" data-shop-buy="${$runtime.escapeHtml(item.id)}" data-shop-currency="eur" ${euroCanAfford?'':'disabled'}>${euroCanAfford?`COMPRA CON € · ${item.cost} €`:`SERVONO ${item.cost} €`}</button>
        <button type="button" class="shop-buy-btn shop-buy-fp ${fpCanAfford?'primary':''}" data-shop-buy="${$runtime.escapeHtml(item.id)}" data-shop-currency="fp" ${fpCanAfford?'':'disabled'}>${fpCanAfford?`COMPRA CON FP · ${item.fpCost} FP`:`SERVONO ${item.fpCost} FP`}</button>
      </div>`;
    }else{
      button=`<button type="button" class="shop-buy-btn ${euroCanAfford?'primary':''}" data-shop-buy="${$runtime.escapeHtml(item.id)}" data-shop-currency="eur" ${euroCanAfford?'':'disabled'}>${euroCanAfford?'ACQUISTA':'SALDO INSUFFICIENTE'}</button>`;
    }
    return `<article class="shop-item-card ${active?'is-active':''} ${consumable?'is-consumable':''} ${dualCurrency?'is-dual-currency':''}">
      <div class="shop-game-card" data-shop-detail="${$runtime.escapeHtml(item.id)}" tabindex="0" role="button" aria-label="Apri dettagli di ${$runtime.escapeHtml(item.name)}">
        <div class="shop-game-card-title">${$runtime.escapeHtml(item.name)}</div>
        <div class="shop-product-visual shop-art-${$runtime.escapeHtml(item.id)}">
          ${active?'<span class="shop-product-owned">✓ ATTIVO</span>':''}
          ${consumable&&quantity?`<span class="shop-product-owned consumable-owned">×${quantity}</span>`:''}
          ${item.image?`<img class="shop-product-hero-image" src="${$runtime.escapeHtml(item.image)}" alt="">`:`<span class="shop-product-hero-icon" aria-hidden="true">${item.icon}</span>`}
        </div>
        <div class="shop-game-effect"><span class="shop-game-effect-copy">${effectLine}</span></div>
        <div class="shop-game-price ${item.currency==='fp'&&!dualCurrency?'is-fp':''} ${dualCurrency?'is-dual-price':''}">${dualCurrency?`<span class="shop-price-euro">💶 <strong>${item.cost} €</strong></span><span class="shop-price-separator">/</span><span class="shop-price-fp">◆ <strong>${item.fpCost} FP</strong></span>`:`<span>${priceIcon}</span><strong>${priceText}</strong>`}</div>
      </div>
      ${button}
    </article>`;
  }

  function closeShopProductModal(){
    const modal=$runtime.$('shopProductModal');
    if(!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
  }

  function openShopProductModal(id){
    const item=$runtime.SHOP_ITEMS[id],season=$runtime.ensureSeasonState(),modal=$runtime.$('shopProductModal');
    if(!item || !season || !modal) return;
    const consumable=!!item.consumable;
    const quantity=consumable?$runtime.consumableQuantity(item.id,season):0;
    const active=!consumable && $runtime.shopItemActive(item.id,season);
    const freeBySponsor=!consumable && $runtime.sponsorCanMakeShopItemFree(item.id,season);
    const dualCurrency=Number(item.fpCost)>0;
    const balance=item.currency==='fp'?$runtime.careerFantapoints():$runtime.careerEuros();
    const canAfford=freeBySponsor || balance>=item.cost;
    const euroCanAfford=freeBySponsor || $runtime.careerEuros()>=Number(item.cost||0);
    const fpCanAfford=dualCurrency && $runtime.careerFantapoints()>=Number(item.fpCost||0);
    const locked=!!season.completed;
    const modalIcon=$runtime.$('shopProductModalIcon');
    const modalImage=$runtime.$('shopProductModalImage');
    if(modalIcon) modalIcon.textContent=item.icon;
    if(modalImage){
      if(item.image){
        modalImage.src=item.image;
        modalImage.alt=item.name;
        modalImage.hidden=false;
      }else{
        modalImage.hidden=true;
        modalImage.removeAttribute('src');
        modalImage.alt='';
      }
    }
    if(modalIcon) modalIcon.hidden=!!item.image;
    if($runtime.$('shopProductModalCategory')) $runtime.$('shopProductModalCategory').textContent=item.category;
    if($runtime.$('shopProductModalTitle')) $runtime.$('shopProductModalTitle').textContent=item.name;
    if($runtime.$('shopProductModalDescription')) $runtime.$('shopProductModalDescription').textContent=item.description;
    if($runtime.$('shopProductModalEffect')) $runtime.$('shopProductModalEffect').innerHTML=$runtime.shopItemEffectLine(item,active);
    if($runtime.$('shopProductModalFeatures')) $runtime.$('shopProductModalFeatures').innerHTML=(item.features||[]).map(x=>`<li><span>✓</span>${$runtime.escapeHtml(x)}</li>`).join('');
    const visual=$runtime.$('shopProductModalVisual');
    if(visual) visual.className=`shop-product-modal-visual shop-art-${item.id} ${consumable?'is-consumable':''}`;
    const duration=modal?.querySelector('.shop-product-duration');
    if(duration) duration.textContent=consumable?'CONSUMABILE':'STAGIONALE';
    if($runtime.$('shopProductModalStatus')) $runtime.$('shopProductModalStatus').textContent=consumable?`IN INVENTARIO · x${quantity}`:active?'ATTIVO · STAGIONE CORRENTE':'VALIDO FINO A FINE STAGIONE';
    if($runtime.$('shopProductModalPrice')){ const priceEl=$runtime.$('shopProductModalPrice'); if(freeBySponsor&&!active) priceEl.textContent='GRATIS'; else if(dualCurrency) priceEl.innerHTML=`<span class="shop-price-euro">${item.cost} €</span> <span class="shop-price-separator">/</span> <span class="shop-price-fp">${item.fpCost} FP</span>`; else priceEl.textContent=`${item.cost} ${item.currency==='fp'?'FP':'€'}`; }
    const buy=$runtime.$('shopProductModalBuy');
    const buyFp=$runtime.$('shopProductModalBuyFp');
    if(buy){
      buy.dataset.shopModalBuy=item.id;
      buy.dataset.shopCurrency='eur';
      buy.hidden=dualCurrency && !freeBySponsor ? false : false;
      buy.disabled=(!consumable&&active) || locked || (dualCurrency?!euroCanAfford:!canAfford);
      buy.className=`shop-buy-btn ${((consumable||!active)&&!locked&&(dualCurrency?euroCanAfford:canAfford))?'primary':''} ${active?'active':''}`;
      buy.textContent=dualCurrency
        ? locked?'STAGIONE TERMINATA':active?'✓ ATTIVO':freeBySponsor?'ATTIVA GRATIS · SPONSOR':euroCanAfford?`COMPRA CON € · ${item.cost} €`:`SERVONO ${item.cost} €`
        : consumable
        ? locked?'STAGIONE TERMINATA':canAfford?'ACQUISTA +1':`SERVONO ${item.cost} FP`
        : active?'✓ ATTIVO':locked?'STAGIONE TERMINATA':freeBySponsor?'ATTIVA GRATIS · SPONSOR':dualCurrency?(euroCanAfford?`COMPRA CON € · ${item.cost} €`:`SERVONO ${item.cost} €`):canAfford?'ACQUISTA ORA':`SERVONO ${item.cost} €`;
    }
    if(buyFp){
      const showFp=dualCurrency && !freeBySponsor && !active;
      buyFp.hidden=!showFp;
      buyFp.dataset.shopModalBuy=item.id;
      buyFp.dataset.shopCurrency='fp';
      buyFp.disabled=locked || !fpCanAfford;
      buyFp.className=`shop-buy-btn shop-buy-fp ${(!locked&&fpCanAfford)?'primary':''}`;
      buyFp.textContent=locked?'STAGIONE TERMINATA':fpCanAfford?`COMPRA CON FP · ${item.fpCost} FP`:`SERVONO ${item.fpCost} FP`;
    }
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    setTimeout(()=>$runtime.$('closeShopProductModal')?.focus(),0);
  }

  function renderShopItems(){
    const grid=$runtime.$('shopItemsGrid'),season=$runtime.ensureSeasonState();
    if(!grid || !season) return;
    const items=Object.values($runtime.SHOP_ITEMS);
    const visible=$runtime.shopCategoryFilter==='all' ? items : items.filter(item=>item.section===$runtime.shopCategoryFilter);
    const perPage=$runtime.shopItemsPerPage();
    const totalPages=Math.max(1,Math.ceil(visible.length/perPage));
    $runtime.shopPageIndex=$runtime.clamp(Number($runtime.shopPageIndex||0),0,totalPages-1);
    const pageItems=visible.slice($runtime.shopPageIndex*perPage,$runtime.shopPageIndex*perPage+perPage);
    grid.innerHTML=pageItems.map($runtime.shopCardHtml).join('');

    document.querySelectorAll('[data-shop-category]').forEach(btn=>{
      const active=String(btn.dataset.shopCategory)===String($runtime.shopCategoryFilter);
      btn.classList.toggle('active',active);
      btn.setAttribute('aria-selected',active?'true':'false');
      btn.onclick=()=>{
        $runtime.shopCategoryFilter=String(btn.dataset.shopCategory||'all');
        $runtime.shopPageIndex=0;
        $runtime.renderShopItems();
      };
    });

    const prev=$runtime.$('shopPrevPage'),next=$runtime.$('shopNextPage'),dots=$runtime.$('shopPageDots');
    if(prev){
      prev.disabled=$runtime.shopPageIndex<=0;
      prev.onclick=()=>{ if($runtime.shopPageIndex>0){$runtime.shopPageIndex--;$runtime.renderShopItems();} };
    }
    if(next){
      next.disabled=$runtime.shopPageIndex>=totalPages-1;
      next.onclick=()=>{ if($runtime.shopPageIndex<totalPages-1){$runtime.shopPageIndex++;$runtime.renderShopItems();} };
    }
    if(dots){
      dots.innerHTML=totalPages>1
        ? Array.from({length:totalPages},(_,i)=>`<button type="button" class="${i===$runtime.shopPageIndex?'active':''}" data-shop-page="${i}" aria-label="Pagina ${i+1}" ${i===$runtime.shopPageIndex?'aria-current="page"':''}></button>`).join('')
        : '';
      dots.querySelectorAll('[data-shop-page]').forEach(btn=>btn.onclick=()=>{$runtime.shopPageIndex=Number(btn.dataset.shopPage||0);$runtime.renderShopItems();});
    }

    grid.querySelectorAll('[data-shop-buy]').forEach(btn=>btn.addEventListener('click',e=>{
      e.stopPropagation();
      $runtime.buyShopItem(btn.dataset.shopBuy,btn.dataset.shopCurrency||'eur');
    }));
    grid.querySelectorAll('[data-shop-detail]').forEach(card=>{
      card.addEventListener('click',()=>$runtime.openShopProductModal(card.dataset.shopDetail));
      card.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){
          e.preventDefault();
          $runtime.openShopProductModal(card.dataset.shopDetail);
        }
      });
    });

    const modal=$runtime.$('shopProductModal');
    if(modal){
      modal.onkeydown=e=>{ if(e.key==='Escape') $runtime.closeShopProductModal(); };
      const close=$runtime.$('closeShopProductModal'),backdrop=modal.querySelector('.shop-product-modal-backdrop');
      if(close) close.onclick=$runtime.closeShopProductModal;
      if(backdrop) backdrop.onclick=$runtime.closeShopProductModal;
      const modalBuy=$runtime.$('shopProductModalBuy'),modalBuyFp=$runtime.$('shopProductModalBuyFp');
      [modalBuy,modalBuyFp].forEach(button=>{
        if(!button) return;
        button.onclick=()=>{
          const id=button.dataset.shopModalBuy;
          if(!id || button.disabled) return;
          const currency=button.dataset.shopCurrency||'eur';
          $runtime.closeShopProductModal();
          $runtime.buyShopItem(id,currency);
        };
      });
    }

    if($runtime.$('shopWalletAmount')) $runtime.$('shopWalletAmount').textContent=String($runtime.careerEuros());
    if($runtime.$('shopFantapointsAmount')) $runtime.$('shopFantapointsAmount').textContent=String($runtime.careerFantapoints());
    if($runtime.$('shopSeasonLabel')) $runtime.$('shopSeasonLabel').textContent=`STAGIONE ${Number($runtime.ensureCareerEconomy()?.seasonNumber||1)} · SERVIZI E CONSUMABILI STAGIONALI`;
    const persistentItems=items.filter(item=>!item.consumable);
    const activeItems=persistentItems.filter(item=>$runtime.shopItemActive(item.id,season));
    const inventoryItems=items.filter(item=>item.consumable&&$runtime.consumableQuantity(item.id,season)>0);
    if($runtime.$('shopActiveCount')) $runtime.$('shopActiveCount').textContent=`${activeItems.length}/${persistentItems.length}`;
    if($runtime.$('shopActiveSummary')){
      const celebrityNote=Number($runtime.state.career?.nextSponsorSeason)===Number($runtime.state.career?.seasonNumber||1)+1?'<span>🌟 Celebrità attiva: 2 sponsor nella prossima stagione</span>':'';
      const sponsorNote=$runtime.sponsorFreeSubscriptionAvailable(season)?'<span>🎁 Sponsor: 1 abbonamento gratuito disponibile</span>':'';
      const activeHtml=activeItems.length?activeItems.map(item=>`<span>${item.icon} ${$runtime.escapeHtml(item.name)}</span>`).join(''):'';
      const inventoryHtml=inventoryItems.length?inventoryItems.map(item=>`<span class="shop-inventory-chip">${item.icon} ${$runtime.escapeHtml(item.name)} ×${$runtime.consumableQuantity(item.id,season)}</span>`).join(''):'';
      $runtime.$('shopActiveSummary').innerHTML=(celebrityNote+sponsorNote+activeHtml+inventoryHtml) || '<small>Nessun servizio attivo e inventario vuoto.</small>';
    }
  }
    return Object.freeze({ensureCareerEconomy,sponsorVisualAsset,sponsorVisualBrand,currentSponsorChoice,currentSponsorOffers,selectSeasonSponsor,selectAcademySponsorPlayer,renderSponsorSelection,seasonSponsorFromChoice,sponsorFreeSubscriptionAvailable,sponsorCanMakeShopItemFree,sortStandingsSnapshot,grantImmediateSponsorBonus,grantBigMatchSponsorReward,grantStreakSponsorReward,grantWinSponsorReward,grantFutureAuctionSponsorBonus,ensureSeasonShop,shopItemActive,careerEuros,careerFantapoints,ensureConsumableState,consumableQuantity,consumableDayEffect,addConsumable,consumeConsumable,totalConsumablesOwned,shopPurchaseOrigin,animateShopPurchase,buyConsumableItem,grantMatchdayFantapoints,careerDivisionLabel,careerPromotionNote,careerSeasonLabel,renderCareerWallets,applyGameConfiguration,formationEventChance,seasonShockChance,formationChoiceRarity,formationChoiceRarityLabel,formationRarityWeights,formationRaritiesUnlocked,specialFormationEventsUnlocked,deterministicFormationTemplateOrder,buyShopItem,shopItemsPerPage,shopItemEffectLine,shopCardHtml,closeShopProductModal,openShopProductModal,renderShopItems});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['shop-controller']=Object.freeze({create});
})();
