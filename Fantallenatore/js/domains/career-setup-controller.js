/* Responsibility: career-setup-controller. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: career-setup-controller');
  let rulesRevealTimer=null;
  function renderCareerAvatarEditor(){
    if(!$runtime.careerDraft) return;
    const avatar=$runtime.normalizedCoachAvatar($runtime.careerDraft.coachAvatar);
    $runtime.careerDraft.coachAvatar=avatar;
    document.querySelectorAll('#careerTeamStep [data-coach-avatar]').forEach(select=>{
      select.value=avatar[select.dataset.coachAvatar];
    });
    for(const id of ['careerAvatarPreview','careerProfileAvatarPreview']){
      const preview=$runtime.$(id);
      if(preview){
        preview.src=$runtime.pixelPlayerAvatarData({id:'coach-user',name:$runtime.$('coachNameInput')?.value||'Mister',avatarCustomization:avatar});
        preview.alt=`Anteprima di ${$runtime.$('coachNameInput')?.value.trim()||'Mister'}`;
      }
    }
  }

  function updateCareerAvatarEditor(){
    if(!$runtime.careerDraft) return;
    const selected={};
    document.querySelectorAll('#careerTeamStep [data-coach-avatar]').forEach(select=>{
      selected[select.dataset.coachAvatar]=select.value;
    });
    $runtime.careerDraft.coachAvatar=$runtime.normalizedCoachAvatar(selected);
    $runtime.renderCareerAvatarEditor();
  }

  function careerIdentity({focus=false}={}){
    const teamInput=$runtime.$('careerTeamNameInput'),coachInput=$runtime.$('coachNameInput');
    const teamName=teamInput?.value.trim()||'';
    const managerName=coachInput?.value.trim()||'';
    if(!managerName || !teamName){
      if(focus) (!managerName?coachInput:teamInput)?.focus();
      return null;
    }
    return {teamName,managerName};
  }

  function updateCareerIdentityControls(){
    const valid=!!$runtime.careerIdentity();
    if($runtime.$('careerIdentityNextBtn')) $runtime.$('careerIdentityNextBtn').disabled=!valid;
    if($runtime.$('careerContinueBtn')) $runtime.$('careerContinueBtn').disabled=!valid;
    if($runtime.$('quickReadyBtn')) $runtime.$('quickReadyBtn').disabled=!valid;
    if($runtime.$('careerIdentityHint')) $runtime.$('careerIdentityHint').textContent=valid
      ? 'Tutto pronto. Scegli il volto del tuo allenatore.'
      : 'Inserisci entrambi i nomi per continuare.';
    if($runtime.$('careerPreviewTeam')) $runtime.$('careerPreviewTeam').textContent=$runtime.$('careerTeamNameInput')?.value.trim()||'La tua squadra';
    if($runtime.$('careerPreviewCoach')) $runtime.$('careerPreviewCoach').textContent=$runtime.$('coachNameInput')?.value.trim()||'Il tuo nome';
  }

  function setInitialCareerCatalog(pokemon){
    if(!$runtime.careerDraft || $runtime.nextSeasonSetupMode) return;
    $runtime.careerDraft.catalogMode=pokemon?'pokemon':'base';
    $runtime.careerDraft.pokemonCatalogSeed=pokemon?$runtime.careerDraft.marketSeed:null;
    $runtime.careerDraft.transferMarket=$runtime.TransferEngine.createMarketState(`${$runtime.careerDraft.marketSeed}|${$runtime.careerDraft.catalogMode}`);
    $runtime.careerDraft.playerBaseOvr={};
    $runtime.activateCatalogBase($runtime.careerDraft);
    $runtime.syncSerieATransferWorld($runtime.careerDraft);
    $runtime.careerDraft.availableIds=(window.FANTA_PLAYERS||[]).map(player=>String(player.id));
    if($runtime.$('careerCatalogModeHint')) $runtime.$('careerCatalogModeHint').textContent=pokemon?'ON · Campionato Pokémon':'OFF · Campionato classico';
  }

  function showCareerTeamSubstep(step='identity'){
    const allowed=['identity','avatar','launch'];
    $runtime.careerTeamSubstep=allowed.includes(step)?step:'identity';
    document.querySelectorAll('#careerTeamStep [data-career-team-substep]').forEach(section=>{
      section.classList.toggle('hidden',section.dataset.careerTeamSubstep!==$runtime.careerTeamSubstep);
    });
    document.querySelectorAll('#careerTeamStep [data-career-progress]').forEach(item=>{
      const current=item.dataset.careerProgress===$runtime.careerTeamSubstep;
      if(current)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');
      item.classList.toggle('is-complete',allowed.indexOf(item.dataset.careerProgress)<allowed.indexOf($runtime.careerTeamSubstep));
    });
    const copy={identity:['Lascia il tuo segno.','Ogni grande squadra comincia da un nome.'],avatar:['Dai un volto al mister.','Scegli il personaggio che guiderà la tua squadra.'],launch:['Il campo ti aspetta.','Vivi l’asta o comincia con le rose già pronte.']}[$runtime.careerTeamSubstep];
    if($runtime.$('careerCreationTitle'))$runtime.$('careerCreationTitle').textContent=copy[0];
    if($runtime.$('careerCreationDescription'))$runtime.$('careerCreationDescription').textContent=copy[1];
    if($runtime.careerTeamSubstep==='avatar') $runtime.renderCareerAvatarEditor();
    if($runtime.careerTeamSubstep==='launch') $runtime.updateResumeButton();
  }

  function advanceCareerIdentityStep(){
    if(!$runtime.careerDraft) return;
    const identity=$runtime.careerIdentity({focus:true});
    if(!identity) return;
    $runtime.careerDraft.teamName=identity.teamName;
    $runtime.careerDraft.managerName=identity.managerName;
    $runtime.careerDraft.managers[0].team=identity.teamName;
    $runtime.careerDraft.managers[0].name=identity.managerName;
    $runtime.showCareerTeamSubstep('avatar');
  }

  function openCareerSetup(){
    $runtime.nextSeasonSetupMode=false;
    $runtime.careerDraft=$runtime.freshState($runtime.$('teamNameInput').value.trim()||'Team JHZ', $runtime.$('managerNameInput').value.trim()||'Mister');
    $runtime.careerPowerSelection=[];
    $runtime.careerRulesNextAction='auction';
    const title=document.querySelector('#careerSetupScreen .career-title h2');
    const subtitle=document.querySelector('#careerSetupScreen .career-title p');
    if(title) title.textContent='Costruisci la squadra e conquista il campionato';
    if(subtitle) subtitle.innerHTML=`Stagione <span data-game-season></span> · <span data-game-league></span>`;
    if($runtime.$('careerPowersBackBtn')) $runtime.$('careerPowersBackBtn').textContent='← AVVIO CARRIERA';
    $runtime.applyGameConfiguration();
    $runtime.$('careerTeamNameInput').value='';
    $runtime.$('coachNameInput').value='';
    if($runtime.$('careerPokemonToggle')) $runtime.$('careerPokemonToggle').checked=false;
    if($runtime.$('careerCatalogModeHint')) $runtime.$('careerCatalogModeHint').textContent='OFF · Campionato classico';
    $runtime.updateCareerIdentityControls();
    $runtime.renderCareerAvatarEditor();
    $runtime.showCareerSetupStep('team');
    $runtime.showCareerTeamSubstep('identity');
    $runtime.renderCareerPowerSelection();
    $runtime.$('careerSetupScreen').classList.remove('hidden');
  }

  function showCareerSetupStep(step){
    if(rulesRevealTimer!==null){clearTimeout(rulesRevealTimer);rulesRevealTimer=null;}
    $runtime.$('careerRulesLoadingStep')?.classList.toggle('hidden',step!=='rules-loading');
    $runtime.$('careerTeamStep')?.classList.toggle('hidden',step!=='team');
    $runtime.$('careerPowersStep')?.classList.toggle('hidden',step!=='powers');
    $runtime.$('careerRulesStep')?.classList.toggle('hidden',step!=='rules');
  }

  function continueCareerSetup(){
    if(!$runtime.careerDraft)return;
    const identity=$runtime.careerIdentity({focus:true});
    if(!identity) return;
    const {teamName,managerName}=identity;
    $runtime.careerDraft.teamName=teamName;
    $runtime.careerDraft.managerName=managerName;
    $runtime.careerDraft.managers[0].team=teamName;
    $runtime.careerDraft.managers[0].name=managerName;
    $runtime.showCareerSetupStep('powers');
  }

  function syncCareerIdentity(){
    if(!$runtime.careerDraft)return false;
    const identity=$runtime.careerIdentity({focus:true});
    if(!identity)return false;
    const {teamName,managerName}=identity;
    $runtime.careerDraft.teamName=teamName;
    $runtime.careerDraft.managerName=managerName;
    $runtime.careerDraft.managers[0].team=teamName;
    $runtime.careerDraft.managers[0].name=managerName;
    return true;
  }

  function rerollPreAuctionRules(){
    const id='cons_reroll_rules';
    // Only the next-season setup can spend items from the completed season.
    if(!$runtime.nextSeasonSetupMode || !$runtime.careerDraft || $runtime.careerDraft.auction || $runtime.careerDraft.stats?.purchases>0) return false;
    const season=$runtime.state?.season,flow=$runtime.state?.nextSeasonFlow;
    if(!season?.completed || !flow || flow.stage!=='market_summary') return false;
    const inventory=season.consumables?.inventory;
    const quantity=Math.max(0,Math.floor(Number(inventory?.[id]||0)));
    if(quantity<1 || Number($runtime.careerDraft.carryoverConsumables?.[id]||0)<1) return false;
    const signature=rules=>JSON.stringify([rules.selectedCategories.slice().sort(),$runtime.PRE_AUCTION_RULE_DEFS.map(rule=>rules[rule.id])]);
    const previous=signature($runtime.leagueRulesFor($runtime.careerDraft));
    for(let attempt=0;attempt<100;attempt++){
      $runtime.careerDraft.leagueRulesRerollCount=Math.max(0,Number($runtime.careerDraft.leagueRulesRerollCount||0))+1;
      $runtime.careerDraft.leagueRules=$runtime.defaultLeagueRules();
      $runtime.generatePreAuctionLeagueRules($runtime.careerDraft);
      if(signature($runtime.careerDraft.leagueRules)!==previous) break;
    }
    inventory[id]=quantity-1;
    $runtime.careerDraft.carryoverConsumables[id]=quantity-1;
    season.consumables.usageHistory.push({id,day:season.currentMatchday,note:'reroll_pre_auction_rules',usedAt:Date.now()});
    // Persist the outcome as well as the spent item, including when setup is closed.
    flow.preAuctionRules=JSON.parse(JSON.stringify($runtime.careerDraft.leagueRules));
    flow.preAuctionRulesRerollCount=$runtime.careerDraft.leagueRulesRerollCount;
    $runtime.saveState();
    $runtime.renderCareerLeagueRules();
    $runtime.showToast(`Regolamento risorteggiato · Rimescola Regole rimasti: ${quantity-1}.`);
    return true;
  }

  function renderCareerLeagueRules(){
    if(!$runtime.careerDraft) return;
    const rules=$runtime.generatePreAuctionLeagueRules($runtime.careerDraft);
    const cards=$runtime.leagueRuleCardData($runtime.careerDraft);
    const grid=$runtime.$('careerRulesGrid');
    if(grid){
      grid.innerHTML=cards.map((card,index)=>`<article class="career-rule-card career-admin-rule-card formation-flip-card type-rule rarity-${$runtime.escapeHtml(card.rarity)} rule-${$runtime.escapeHtml(card.id)}" data-career-rule-card="${$runtime.escapeHtml(card.id)}" tabindex="0" role="button" aria-label="Carta regolamento Admin ${$runtime.formationChoiceRarityLabel(card.rarity)}. Clicca per girare.">
        <div class="formation-flip-inner">
          <section class="formation-card-face formation-card-front">
            <img class="formation-card-cover" src="${$runtime.adminRuleCover(card.rarity)}" alt="Regolamento Admin">
            <span class="formation-card-index">${index+1}</span>
            <div class="career-admin-rule-front-copy">
              <span class="career-admin-rule-kicker">${card.rarity==='rare'?'REGOLA RARA':'REGOLAMENTO STAGIONE'}</span>
              <strong>${$runtime.escapeHtml(card.title)}</strong>
              <b>${$runtime.escapeHtml(card.label)}</b>
            </div>
            <div class="formation-card-front-footer">
              <span class="formation-card-front-category">REGOLA ADMIN</span>
              <button type="button" class="formation-card-flip-btn" data-career-rule-flip="${$runtime.escapeHtml(card.id)}">GIRA ↻</button>
            </div>
          </section>
          <section class="formation-card-face formation-card-back">
            <div class="formation-card-back-top">
              <span class="formation-choice-icon">${card.icon}</span>
              <span class="formation-choice-category">REGOLA STAGIONE</span>
              <span class="formation-card-rarity rarity-${$runtime.escapeHtml(card.rarity)}">${card.rarity==='rare'?'RARA · ATTIVA':'ATTIVA'}</span>
            </div>
            <div class="formation-card-back-copy career-admin-rule-back-copy">
              <strong>${$runtime.escapeHtml(card.title)}</strong>
              <b>${$runtime.escapeHtml(card.label)}</b>
              <small>${$runtime.escapeHtml(card.detail)}</small>
              <small class="career-admin-rule-effect">${$runtime.escapeHtml($runtime.leagueRuleEffectText(card.id,card.value))}</small>
            </div>
            <div class="formation-card-back-footer career-admin-rule-back-footer">
              <button type="button" class="formation-card-flip-back-btn" data-career-rule-flip="${$runtime.escapeHtml(card.id)}">↺ RIGIRA</button>
              <span class="career-admin-rule-accepted">GIÀ ATTIVA ✓</span>
            </div>
          </section>
        </div>
      </article>`).join('');
      grid.querySelectorAll('[data-career-rule-card]').forEach(card=>{
        const toggle=()=>{
          const flipped=card.classList.toggle('is-flipped');
          card.setAttribute('aria-label',flipped?'Carta regolamento girata. Leggi descrizione ed effetti.':'Carta regolamento coperta. Clicca per girare.');
        };
        card.addEventListener('click',e=>{
          if(e.target.closest('[data-career-rule-flip]')) return;
          toggle();
        });
        card.addEventListener('keydown',e=>{
          if((e.key==='Enter' || e.key===' ') && !e.target.closest('button')){
            e.preventDefault();
            toggle();
          }
        });
        card.querySelectorAll('[data-career-rule-flip]').forEach(btn=>btn.addEventListener('click',e=>{
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }));
      });
    }
    const standard=$runtime.$('careerRulesStandard');
    const offered=rules.selectedCategories.includes('alternateCatalog');
    const choice=$runtime.$('careerCatalogChoice');
    choice?.classList.toggle('hidden',!offered);
    if(offered){
      const current=$runtime.careerDraft.catalogMode==='pokemon'?'Pokémon':'Serie A';
      const next=current==='Pokémon'?'Serie A':'Pokémon';
      if($runtime.$('careerCatalogChoiceText')) $runtime.$('careerCatalogChoiceText').textContent=`Listone attuale: ${current}. Se accetti, passerai al listone ${next} dall’asta. Se rifiuti, resti nel mondo attuale.`;
      choice?.querySelectorAll('[data-catalog-decision]').forEach(button=>{
        button.classList.toggle('selected',rules.catalogDecision===button.dataset.catalogDecision);
        button.setAttribute('aria-pressed',String(rules.catalogDecision===button.dataset.catalogDecision));
      });
    }
    if(standard){
      standard.innerHTML=`<h4>REGOLE PROSSIMA STAGIONE</h4><div class="career-rules-recap-grid">${$runtime.PRE_AUCTION_RULE_DEFS.map(rule=>{
        const value=rules[rule.id];
        const selected=rules.selectedCategories.includes(rule.id);
        const title=rule.id==='cleanSheetBonus'&&Number(value)===2?'Porta inviolata mega':rule.title;
        if(['alternateCatalog','freeRoleAuction'].includes(rule.id) && Number($runtime.careerDraft.career?.division||4)>3) return '';
        const label=rule.id==='alternateCatalog'?(selected?(rules.catalogDecision==='accept'?'CAMBIO ACCETTATO':rules.catalogDecision==='reject'?'CAMBIO RIFIUTATO':'DA DECIDERE'):'NON ESTRATTA'):rule.label(value);
        const disabled=value===false || value==='off' || (rule.id==='cleanSheetBonus'&&Number(value)===0);
        const shownLabel=disabled?'OFF':label;
        const inactiveDetails={
          keeperConfirmation:'Nessun giocatore confermabile a fine stagione.',
          packOpening:'Nessun giocatore assegnato prima dell’asta.',
          freeRoleAuction:'L’asta segue i reparti P → D → C → A.',
          alternateCatalog:'Il listone attuale resta invariato.'
        };
        const detail=disabled?(inactiveDetails[rule.id]||'Regola disattivata per questa stagione.'):rule.detail(value);
        return `<div class="career-rules-recap-item ${disabled?'is-inactive-unselected':''}"><span>${$runtime.escapeHtml(title)} <em>${selected?'ESTRATTA':'STANDARD'}</em></span><strong>${$runtime.escapeHtml(shownLabel)}</strong><small>${$runtime.escapeHtml(detail)}</small></div>`;
      }).join('')}</div>`;
    }
    const reroll=$runtime.$('careerRulesRerollBtn');
    if(reroll){
      const quantity=$runtime.nextSeasonSetupMode?Math.max(0,Math.floor(Number($runtime.careerDraft.carryoverConsumables?.cons_reroll_rules||0))):0;
      reroll.textContent=`🎲 RIMESCOLA REGOLE · ${quantity} DISPONIBILI`;
      reroll.disabled=quantity<1;
      if($runtime.$('careerRulesRerollBox')) $runtime.$('careerRulesRerollBox').hidden=quantity<1;
    }
    const proceed=$runtime.$('careerRulesContinueBtn');
    const back=$runtime.$('careerRulesBackBtn');
    if(proceed){
      proceed.textContent=$runtime.careerRulesNextAction==='ready'?'GENERA LE ROSE':'INIZIA L’ASTA';
      proceed.disabled=offered && !rules.catalogDecision;
    }
    if(back) back.textContent=$runtime.careerRulesNextAction==='ready'?'← SQUADRA':'← FANTAPOTERI';
  }

  function openCareerRulesStep(nextAction='auction'){
    if(!$runtime.careerDraft || rulesRevealTimer!==null) return;
    if(!$runtime.syncCareerIdentity()) return;
    $runtime.careerRulesNextAction=nextAction==='ready'?'ready':'auction';
    const draft=$runtime.careerDraft;
    // Presentation only: preserve the existing rule draw and its saved outcome.
    $runtime.generatePreAuctionLeagueRules(draft);
    $runtime.renderCareerLeagueRules();
    $runtime.showCareerSetupStep('rules-loading');
    const bar=$runtime.$('careerRulesLoadingStep')?.querySelector('.career-rules-loading-bar span');
    if(bar){bar.style.animation='none';void bar.offsetWidth;bar.style.animation='';}
    rulesRevealTimer=setTimeout(()=>{
      rulesRevealTimer=null;
      if($runtime.careerDraft!==draft || $runtime.$('careerSetupScreen')?.classList.contains('hidden')) return;
      $runtime.showCareerSetupStep('rules');
    },2000);
  }

  function startReadyRostersFromCareer(){
    if(!$runtime.careerDraft)return;
    $runtime.openCareerRulesStep('ready');
  }

  function proceedFromCareerRules(){
    if(!$runtime.careerDraft || !$runtime.syncCareerIdentity()) return;
    const rules=$runtime.leagueRulesFor($runtime.careerDraft);
    if(rules.selectedCategories.includes('alternateCatalog') && !rules.catalogDecision) return;
    if($runtime.careerRulesNextAction==='ready'){
      $runtime.generateReadyRosters(true);
      return;
    }
    $runtime.startAuction(true);
  }

  function backFromCareerRules(){
    if($runtime.careerRulesNextAction==='ready'){
      $runtime.showCareerSetupStep('team');
      $runtime.showCareerTeamSubstep('launch');
    }else $runtime.showCareerSetupStep('powers');
  }

  function showGameInstructions(){
    window.GameGuide.open();
  }

  function careerPowerSlotCost(selection=$runtime.careerPowerSelection){
    return (selection||[]).reduce((sum,power)=>sum+(['observer','oneShot'].includes(power)?3:1),0);
  }

  function renderCareerPowerSelection(){
    const exclusivePower=$runtime.careerPowerSelection.find(power=>['observer','oneShot'].includes(power));
    const usedSlots=$runtime.careerPowerSlotCost();
    document.querySelectorAll('[data-career-power]').forEach(card=>{
      const power=card.dataset.careerPower;
      const selected=$runtime.careerPowerSelection.includes(power);
      const lockedByExclusive=!!exclusivePower && power!==exclusivePower;
      card.classList.toggle('selected',selected);
      card.classList.toggle('power-locked-by-observer',lockedByExclusive);
      card.setAttribute('aria-pressed',String(selected));
      const stateLabel=card.querySelector('.career-power-state');
      if(stateLabel){
        if(selected && ['observer','oneShot'].includes(power)) stateLabel.textContent='SELEZIONATO · OCCUPA 3 SLOT';
        else if(lockedByExclusive) stateLabel.textContent='BLOCCATO DA POTERE ESCLUSIVO';
        else stateLabel.textContent=selected?'SELEZIONATO':'CLICCA PER SELEZIONARE';
      }
      card.setAttribute('aria-disabled', String(lockedByExclusive));
    });
    if($runtime.$('careerPowerCounter')) $runtime.$('careerPowerCounter').textContent=`${usedSlots} / 3 SLOT UTILIZZATI`;
    if($runtime.$('careerStartAuctionBtn')) $runtime.$('careerStartAuctionBtn').disabled=usedSlots!==3;
  }

  function toggleCareerPower(power){
    if(!['block','scout','bluff','observer','oneShot'].includes(power))return;

    if(['observer','oneShot'].includes(power)){
      if($runtime.careerPowerSelection.includes(power)) $runtime.careerPowerSelection=[];
      else $runtime.careerPowerSelection=[power];
      $runtime.renderCareerPowerSelection();
      return;
    }

    const exclusivePower=$runtime.careerPowerSelection.find(x=>['observer','oneShot'].includes(x));
    if(exclusivePower){
      $runtime.showToast(`${exclusivePower==='observer'?'OSSERVATORE':'ONE SHOT'} occupa tutti e 3 gli slot: deselezionalo per scegliere altri Fantapoteri.`,true);
      return;
    }

    if($runtime.careerPowerSelection.includes(power)) $runtime.careerPowerSelection=$runtime.careerPowerSelection.filter(x=>x!==power);
    else if($runtime.careerPowerSlotCost()<3) $runtime.careerPowerSelection.push(power);
    else { $runtime.showToast('Hai già utilizzato tutti e 3 gli slot Fantapotere.',true); return; }
    $runtime.renderCareerPowerSelection();
  }

  function startCareerAuction(){
    if(!$runtime.careerDraft || $runtime.careerPowerSlotCost()!==3)return;
    if(!$runtime.syncCareerIdentity())return;
    $runtime.careerDraft.auctionPowers={block:false,scout:false,bluff:false,observer:false,oneShot:false,uses:{block:0,scout:0,bluff:0,oneShot:0},selected:[...$runtime.careerPowerSelection]};
    $runtime.openCareerRulesStep('auction');
  }
    return Object.freeze({renderCareerAvatarEditor,updateCareerAvatarEditor,careerIdentity,updateCareerIdentityControls,setInitialCareerCatalog,showCareerTeamSubstep,advanceCareerIdentityStep,openCareerSetup,showCareerSetupStep,continueCareerSetup,syncCareerIdentity,rerollPreAuctionRules,renderCareerLeagueRules,openCareerRulesStep,startReadyRostersFromCareer,proceedFromCareerRules,backFromCareerRules,showGameInstructions,careerPowerSlotCost,renderCareerPowerSelection,toggleCareerPower,startCareerAuction});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['career-setup-controller']=Object.freeze({create});
})();
