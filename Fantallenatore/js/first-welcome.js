(() => {
  'use strict';
  const seenKey='fantallenatore_creator_welcome_seen';
  const paragraphs=[
    'Benvenuto! Il gioco è ancora in via di sviluppo e ci sono tantissime cose da sistemare, sia grafiche che di gameplay.',
    'Il gioco è stato creato da una singola persona in un solo mese.',
    'Quindi supportate e condividete il progetto per aiutarmi a migliorarlo!'
  ];
  function open(){
    try{if(localStorage.getItem(seenKey)==='1')return;}catch{}
    if(document.getElementById('firstWelcome'))return;
    const origin=document.activeElement,root=document.createElement('div');
    let step=0;
    root.id='firstWelcome';
    root.innerHTML='<section class="first-welcome-card" role="dialog" aria-modal="true" aria-labelledby="firstWelcomeTitle"><h2 id="firstWelcomeTitle">UN MESSAGGIO DAL CREATORE</h2><div class="first-welcome-body" data-welcome-body><div class="first-welcome-face" aria-hidden="true"></div><p data-welcome-text aria-live="polite" aria-atomic="true"></p></div><footer><span data-welcome-count></span><button class="primary" type="button" data-welcome-next>CONTINUA →</button></footer></section>';
    const button=root.querySelector('[data-welcome-next]');
    function render(){
      root.querySelector('[data-welcome-text]').textContent=paragraphs[step];
      root.querySelector('[data-welcome-count]').textContent=`${step+1} / 3`;
      root.querySelector('.first-welcome-face').style.backgroundPosition=`${[0,60,100][step]}% 60%`;
      button.textContent=step===2?'HO CAPITO ✓':'CONTINUA →';
    }
    function close(){
      try{localStorage.setItem(seenKey,'1');}catch{}
      root.remove();document.body.classList.remove('first-welcome-open');origin?.focus();
    }
    root.addEventListener('click',event=>{
      if(!event.target.closest('[data-welcome-next], [data-welcome-body]'))return;
      if(step===2)close();else{step++;render();button.focus();}
    });
    root.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
      if(event.key==='Tab'){event.preventDefault();button.focus();}
    });
    document.body.append(root);document.body.classList.add('first-welcome-open');render();button.focus();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',open,{once:true});else open();
})();
