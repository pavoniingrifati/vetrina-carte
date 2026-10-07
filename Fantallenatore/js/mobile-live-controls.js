/* Mobile live controls remain closed until explicitly opened. */
(function(){
  function init(){
    const actions=document.querySelector('#serieALiveScreen .fantasy-live-actions-box');
    if(!actions)return;
    actions.id='mobileLiveActions';
    const toggle=document.createElement('button');
    toggle.type='button';toggle.className='secondary mobile-live-controls-toggle';
    toggle.textContent='CONTROLLI DIRETTA ▾';
    toggle.setAttribute('aria-controls',actions.id);toggle.setAttribute('aria-expanded','false');
    toggle.addEventListener('click',function(){
      const expanded=actions.classList.toggle('is-expanded');
      toggle.setAttribute('aria-expanded',String(expanded));
      toggle.textContent=expanded?'CHIUDI CONTROLLI ▴':'CONTROLLI DIRETTA ▾';
    });
    actions.before(toggle);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
