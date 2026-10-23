(() => {
  'use strict';
  const shell = document.querySelector('.fu-shell');
  if (!shell) return;
  const world = shell.dataset.world;
  const team = world === 'gothamcity' ? 'Gotham City' : 'Fantaballa FC';
  const nav = document.getElementById('fu-sidebar');
  const backdrop = document.getElementById('fu-backdrop');
  const toggle = document.getElementById('fu-toggle');
  const module = shell.dataset.module;
  const params = new URLSearchParams(location.search);
  let section = module === 'campionato' && params.get('tab') === 'standings' ? 'standings' : module === 'campionato' ? 'matches' : module === 'scouting' ? 'database' : 'fantacalcio';
  function syncNav(){
    shell.querySelectorAll('.fu-navitem').forEach(el => {
      const active = el.dataset.section === section;
      el.classList.toggle('fu-nav-active', active);
      if(active)el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
    });
    const titles={fantacalcio:'FANTACALCIO',matches:'RISULTATI E CALENDARIO',standings:'CLASSIFICHE',database:'DATABASE GIOCATORI'};
    const pageTitle=titles[section]||'FANTABALLA UNIVERSE';
    document.getElementById('fu-top-section').textContent=pageTitle;
    document.getElementById('fu-top-title').textContent=pageTitle;
    document.getElementById('fu-page-desc').textContent=pageTitle;
    document.title=pageTitle+' · '+team+' · Fantaballa Universe';
  }
  function setMenu(open){nav.classList.toggle('open',open);backdrop.hidden=!open;toggle.setAttribute('aria-expanded',String(open));}
  toggle.addEventListener('click',()=>setMenu(!nav.classList.contains('open')));
  backdrop.addEventListener('click',()=>setMenu(false));
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape')setMenu(false);});
  // Keep universe selection on the same page, including selected calendar tab.
  if (module === 'campionato') {
    shell.querySelectorAll('.fu-worlditem').forEach(a=>{
      const url=new URL(a.href,location.href);
      url.searchParams.set('tab',params.get('tab')||'upcoming');
      a.href=url.href;
    });
    const update=()=>{
      const selected=document.querySelector('.fu-main .tabs [data-mode][aria-pressed="true"]');
      if(!selected)return;
      const newSection=selected.dataset.mode==='standings'?'standings':'matches';
      if(newSection!==section){section=newSection;syncNav();}
      shell.querySelectorAll('.fu-worlditem').forEach(a=>{const target=new URL(a.href);target.searchParams.set('tab',selected.dataset.mode);a.href=target.href;});
    };
    document.addEventListener('click',e=>{if(e.target.closest('[data-mode]'))requestAnimationFrame(update);});
  }
  syncNav();
  // This metadata is fetched only from this world's directory; no cross-universe fallbacks.
  fetch('database_info.json',{cache:'no-store'}).then(resp=>{if(!resp.ok)throw new Error('metadata');return resp.json();}).then(meta=>{
    document.getElementById('fu-date').textContent=meta.saveDate?new Intl.DateTimeFormat('it-IT',{day:'numeric',month:'short',year:'numeric'}).format(new Date(meta.saveDate+'T12:00:00')):'—';
    const year=Number(meta.season);
    document.getElementById('fu-season').textContent=Number.isInteger(year)?year+'/'+String(year+1).slice(-2):'SAVE FM';
    document.getElementById('fu-data-info').textContent=`${meta.clubs||'—'} SQUADRE · ${(meta.players||0).toLocaleString('it-IT')} GIOCATORI`;
  }).catch(()=>{document.getElementById('fu-data-info').textContent='Consulta il database locale';});
})();
