/* Installation is optional: the game and local saves do not depend on it. */
(function(){
  'use strict';
  const button=document.getElementById('installGameBtn');
  const updateButton=document.getElementById('pwaUpdateBtn');
  const status=document.getElementById('pwaStatus');
  const dialog=document.getElementById('pwaInstallDialog');
  if(!button||!dialog)return;
  const mobile=window.matchMedia('(max-width:780px), (max-width:1024px) and (pointer:coarse)');
  const standalone=window.matchMedia('(display-mode:standalone)');
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  let installEvent=null,installed=false,registration=null,reloadForUpdate=false;
  function isInstalled(){return installed||standalone.matches||navigator.standalone===true;}
  function sync(){button.hidden=!mobile.matches||isInstalled();}
  function announce(text){status.textContent=text;status.hidden=false;}
  function instructions(){
    const steps=dialog.querySelector('[data-pwa-install-steps]');
    const items=ios
      ? ['Apri questo sito in Safari.','Tocca Condividi (il quadrato con la freccia verso l’alto).','Scegli Aggiungi alla schermata Home e conferma con Aggiungi.']
      : ['Apri il menu ⋮ del browser.','Scegli Installa app oppure Aggiungi alla schermata Home.','Conferma per aggiungere Fantallenatore al telefono.'];
    const onlineSite=window.isSecureContext&&/^https?:$/.test(location.protocol);
    dialog.querySelector('[data-pwa-install-intro]').textContent=onlineSite
      ? 'Un’icona sul telefono, per aprire il gioco come un’app.'
      : 'Per installare il gioco, apri la sua versione online in HTTPS e segui questi passaggi.';
    steps.replaceChildren(...items.map(text=>{const item=document.createElement('li');item.textContent=text;return item;}));
    if(!dialog.open)dialog.showModal();
  }
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();installEvent=event;sync();
  });
  window.addEventListener('appinstalled',()=>{
    installed=true;installEvent=null;sync();announce('Fantallenatore installato! Aprilo dall’icona sul telefono.');
  });
  button.addEventListener('click',async()=>{
    if(ios||!installEvent){instructions();return;}
    const event=installEvent;installEvent=null;button.disabled=true;
    try{await event.prompt();await event.userChoice;}
    catch{instructions();}
    finally{button.disabled=false;sync();}
  });
  dialog.querySelector('[data-pwa-install-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  mobile.addEventListener('change',sync);standalone.addEventListener('change',sync);sync();
  function offerUpdate(){
    const available=!!registration?.waiting&&!!navigator.serviceWorker.controller;
    updateButton.hidden=!available;
    if(available)announce('È disponibile un aggiornamento del gioco.');
  }
  updateButton.addEventListener('click',()=>{
    if(!registration?.waiting||!document.querySelector('#setupScreen.active'))return;
    reloadForUpdate=true;updateButton.disabled=true;
    registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
  });
  if(!('serviceWorker' in navigator)||!window.isSecureContext||!/^https?:$/.test(location.protocol))return;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloadForUpdate)location.reload();else offerUpdate();});
  navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(value=>{
    registration=value;offerUpdate();
    registration.addEventListener('updatefound',()=>{
      const worker=registration.installing;
      worker?.addEventListener('statechange',()=>{if(worker.state==='installed')setTimeout(offerUpdate,0);});
    });
    navigator.serviceWorker.ready.then(()=>{offerUpdate();if(!registration.waiting&&!isInstalled())announce('Gioco pronto anche offline.');});
  }).catch(async()=>{
    // An offline update check can fail even when an existing worker is usable.
    const existing=await navigator.serviceWorker.getRegistration('./').catch(()=>null);
    if(existing?.active){registration=existing;offerUpdate();if(!existing.waiting)announce('Gioco pronto anche offline.');}
    else announce('Puoi continuare a giocare online. La modalità offline non è disponibile in questo browser.');
  });
})();
