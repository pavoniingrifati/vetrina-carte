(() => {
  'use strict';

  const modalLabels={
    nominationModal:'nominationModalTitle',
    auctionEventModal:'auctionEventTitle',
    roleTransitionModal:'roleTransitionTitle',
    auctionPowerModal:'auctionPowerTitle',
    leagueRosterModal:'leagueRosterModalTitle',
    matchCenterModal:'matchCenterTitle',
    seasonNewsModal:'seasonNewsModalTitle',
    formationChoiceModal:'formationChoiceTitle',
    adminRuleModal:'adminRuleTitle',
    seasonPlayerModal:'seasonPlayerName',
    pixelDialog:'pixelDialogTitle'
  };
  const previousFocus=new WeakMap();

  function visible(element){
    return !!element && element.getAttribute('aria-hidden')!=='true' && !element.classList.contains('hidden');
  }

  function focusables(root){
    return [...root.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter(element=>!element.closest('[aria-hidden="true"]') && element.getClientRects().length>0);
  }

  function labelButton(button){
    if(button.getAttribute('aria-label') || button.textContent.trim()) return;
    const fallback=button.getAttribute('title') || button.dataset.action || button.id || 'Pulsante';
    button.setAttribute('aria-label',fallback.replace(/([a-z])([A-Z])/g,'$1 $2'));
  }

  function enhance(root=document){
    const scope=root.nodeType===1?root:document;
    if(scope.matches?.('.screen')) scope.setAttribute('aria-hidden',String(!scope.classList.contains('active')));
    scope.querySelectorAll?.('.screen').forEach(screen=>screen.setAttribute('aria-hidden',String(!screen.classList.contains('active'))));
    if(scope.matches?.('button')){
      if(!scope.hasAttribute('type')) scope.type='button';
      labelButton(scope);
    }
    scope.querySelectorAll?.('button').forEach(button=>{
      if(!button.hasAttribute('type')) button.type='button';
      labelButton(button);
    });
    scope.querySelectorAll?.('[aria-hidden].nomination-modal,[aria-hidden].auction-event-modal,[aria-hidden].formation-choice-modal,[aria-hidden].season-player-modal,[aria-hidden].league-roster-modal,[aria-hidden].match-center-modal,[aria-hidden].season-news-modal,.pixel-dialog').forEach(modal=>{
      modal.setAttribute('role','dialog');
      modal.setAttribute('aria-modal','true');
      const labelId=modalLabels[modal.id];
      if(labelId && document.getElementById(labelId)) modal.setAttribute('aria-labelledby',labelId);
    });
  }

  function announce(message,priority='polite'){
    const region=document.getElementById('a11yAnnouncements');
    if(!region) return;
    region.setAttribute('aria-live',priority==='assertive'?'assertive':'polite');
    region.textContent='';
    requestAnimationFrame(()=>{region.textContent=String(message||'');});
  }

  function handleModalState(modal){
    if(visible(modal)){
      if(!previousFocus.has(modal)) previousFocus.set(modal,document.activeElement);
      const target=focusables(modal)[0] || modal;
      if(target===modal && !modal.hasAttribute('tabindex')) modal.tabIndex=-1;
      queueMicrotask(()=>target.focus({preventScroll:true}));
    }else{
      const previous=previousFocus.get(modal);
      previousFocus.delete(modal);
      if(previous?.isConnected) queueMicrotask(()=>previous.focus({preventScroll:true}));
    }
  }

  document.addEventListener('DOMContentLoaded',()=>{
    enhance(document);
    const observer=new MutationObserver(records=>{
      for(const record of records){
        if(record.type==='childList') record.addedNodes.forEach(node=>{if(node.nodeType===1) enhance(node);});
        if(record.type==='attributes' && record.target.getAttribute('role')==='dialog') handleModalState(record.target);
      }
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-hidden']});
  });

  document.addEventListener('keydown',event=>{
    if(event.key!=='Tab') return;
    const dialogs=[...document.querySelectorAll('[role="dialog"]')].filter(visible);
    const dialog=dialogs.at(-1);
    if(!dialog) return;
    const items=focusables(dialog);
    if(!items.length){event.preventDefault();dialog.focus();return;}
    const first=items[0],last=items.at(-1);
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
  });

  window.FantaAccessibility=Object.freeze({announce,enhance});
})();
