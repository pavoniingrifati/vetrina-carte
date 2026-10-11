/* Responsibility: visual-identity. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: visual-identity');
  function fixtureTeamColors(manager, isUser=false){
    if(isUser || manager?.id==='user') return $runtime.FIXTURE_TEAM_COLORS.user;
    if(manager?.teamColors?.primary && manager?.teamColors?.secondary) return manager.teamColors;
    return $runtime.FIXTURE_TEAM_COLORS[$runtime.profileArchetype(manager)] || $runtime.FIXTURE_TEAM_COLORS.ragioniere;
  }

  function applyFixtureTeamColors(element, colors){
    if(!element || !colors) return;
    element.style.setProperty('--team-primary', colors.primary);
    element.style.setProperty('--team-secondary', colors.secondary);
  }

  function seasonFixtureTheme(manager, isUser=false){
    if(isUser || manager?.id==='user') return $runtime.FIXTURE_HERO_THEMES.user;
    const tone = $runtime.RIVAL_PRESENTATION[$runtime.profileArchetype(manager)]?.tone || 'blue';
    return $runtime.FIXTURE_HERO_THEMES[tone] || $runtime.FIXTURE_HERO_THEMES.blue;
  }

  function teamBadgeInitials(team){
    const clean = String(team || '').replace(/[^A-Za-zÀ-ÿ0-9 ]+/g,' ').trim();
    const words = clean.split(/\s+/).filter(Boolean);
    if(words.length >= 2) return (words[0][0] + words[1][0]).slice(0,2).toUpperCase();
    return clean.slice(0,2).toUpperCase() || 'FC';
  }

  function simpleHash(value){
    let hash = 0;
    const str = String(value || '');
    for(let i=0;i<str.length;i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    return Math.abs(hash);
  }

  function buildPixelCrestData(label, palette){
    const seed = $runtime.simpleHash(label);
    const cells = [];
    const startX = 23, startY = 22, size = 8;
    for(let y=0;y<5;y++){
      for(let x=0;x<3;x++){
        const bit = ((seed >> (y*3 + x)) & 1) === 1 || (y===0 && x===1);
        if(!bit) continue;
        const left = startX + x*size;
        const mirror = startX + (4-x)*size;
        const top = startY + y*size;
        cells.push(`<rect x="${left}" y="${top}" width="${size}" height="${size}" fill="${palette.primary}"/>`);
        if(mirror !== left) cells.push(`<rect x="${mirror}" y="${top}" width="${size}" height="${size}" fill="${palette.primary}"/>`);
      }
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" shape-rendering="crispEdges">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${palette.secondary}"/><stop offset="1" stop-color="#0b1024"/></linearGradient>
      </defs>
      <path d="M24 10h48l12 12v25c0 18-13 29-36 39C25 76 12 65 12 47V22z" fill="url(#g)" stroke="${palette.line}" stroke-width="4"/>
      <path d="M27 15h42l8 8v22c0 14-10 23-29 31C29 68 19 59 19 45V23z" fill="rgba(255,255,255,.05)"/>
      ${cells.join('')}
      <rect x="22" y="60" width="52" height="6" fill="${palette.line}" opacity="0.55"/>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function buildCoachSilhouette(label, palette){
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 76 76" shape-rendering="crispEdges">
      <path d="M15 76V61c0-12 10-20 23-20s23 8 23 20v15z" fill="${palette.secondary}" stroke="#07101e" stroke-width="3"/>
      <path d="M25 46l13 13 13-13 6 5-9 25H28l-9-25z" fill="${palette.panel}"/>
      <path d="M29 40h18v12l-9 7-9-7z" fill="#d8a36f"/>
      <path d="M23 20h30v13c0 12-7 18-15 18s-15-6-15-18z" fill="#efbd82" stroke="#07101e" stroke-width="3"/>
      <path d="M22 25V15h5V9h22v5h5v15h-6V20H29v5z" fill="${palette.primary}" stroke="#07101e" stroke-width="3"/>
      <rect x="28" y="30" width="5" height="4" fill="#07101e"/><rect x="43" y="30" width="5" height="4" fill="#07101e"/>
      <path d="M31 41h14v4H31z" fill="#8b4938"/>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function renderFixtureCrest(targetId, team, theme){
    const el = $runtime.$(targetId);
    if(!el) return;
    const initials = $runtime.teamBadgeInitials(team);
    el.innerHTML = `<img src="${$runtime.buildPixelCrestData(team, theme)}" alt="Stemma ${$runtime.escapeHtml(team)}"><span>${$runtime.escapeHtml(initials)}</span>`;
  }

  function renderFixtureCoachPortrait(targetId, manager, theme){
    const el = $runtime.$(targetId);
    if(!el) return;
    el.classList.add('is-coach-portrait');
    if(manager?.id==='user'){
      const coach={id:'coach-user',name:manager.name||$runtime.state?.managerName||'Mister',avatarCustomization:$runtime.normalizedCoachAvatar($runtime.state?.coachAvatar)};
      el.innerHTML=`<img src="${$runtime.pixelPlayerAvatarData(coach)}" alt="Avatar di ${$runtime.escapeHtml(coach.name)}">`;
      return;
    }
    if(manager && manager.id !== 'user'){
      const art = $runtime.RIVAL_ART[$runtime.profileArchetype(manager)];
      if(art){
        el.innerHTML = `<img src="assets/rivals/${art}.webp" alt="${$runtime.escapeHtml(manager.profile?.label || manager.name || 'Allenatore')}">`;
        return;
      }
    }
    el.innerHTML = `<img src="${$runtime.buildCoachSilhouette(manager?.name || 'Mister', theme)}" alt="Allenatore">`;
  }

  function applySeasonFixtureHeroVisuals(me, opponent){
    const userTheme = $runtime.seasonFixtureTheme(me, true);
    const opponentTheme = $runtime.seasonFixtureTheme(opponent, false);
    const fixtureTeams=document.querySelectorAll('#seasonScreen .next-fixture .fixture-team');
    $runtime.applyFixtureTeamColors(fixtureTeams[0], $runtime.fixtureTeamColors(me, true));
    $runtime.applyFixtureTeamColors(fixtureTeams[1], $runtime.fixtureTeamColors(opponent, false));
    // Finché non sono disponibili stemmi ufficiali, il volto del mister
    // diventa l'immagine principale della squadra nel box Prossima partita.
    $runtime.renderFixtureCoachPortrait('seasonUserCrest', me || {id:'user', name:$runtime.state.managerName || 'Mister'}, userTheme);
    $runtime.renderFixtureCoachPortrait('seasonOpponentCrest', opponent, opponentTheme);
    if($runtime.$('seasonUserCoachPortrait')) $runtime.$('seasonUserCoachPortrait').innerHTML = '';
    if($runtime.$('seasonOpponentCoachPortrait')) $runtime.$('seasonOpponentCoachPortrait').innerHTML = '';
  }

  function rivalCards(managers) {
    return (managers||[]).filter(m=>m.id!=='user').map(m=>{
      const archetype=$runtime.profileArchetype(m);
      const art=$runtime.RIVAL_ART[archetype];
      const presentation=$runtime.RIVAL_PRESENTATION[archetype] || {description:'Un avversario da non sottovalutare.',tags:['RIVALE','ASTA'],tone:'violet'};
      const portrait=art?`<img src="assets/rivals/${art}.webp" alt="${$runtime.escapeHtml(m.profile.label)}">`
        :`<span class="rival-initials" aria-hidden="true">${$runtime.escapeHtml($runtime.playerInitials(m.name))}</span>`;
      return `<article class="visible-rival-card rival-tone-${$runtime.escapeHtml(presentation.tone)}">
        <div class="rival-avatar">${portrait}</div>
        <div class="rival-info">
          <strong>${$runtime.escapeHtml(m.profile.label)}</strong>
          <p>${$runtime.escapeHtml(presentation.description)}</p>
          <div class="rival-tags"><span>${$runtime.escapeHtml(presentation.tags[0])}</span><span>${$runtime.escapeHtml(presentation.tags[1])}</span></div>
        </div>
      </article>`;
    }).join('');
  }

  function renderVisibleRivals(){
    if($runtime.$('visibleRivals')) $runtime.$('visibleRivals').innerHTML=$runtime.rivalCards($runtime.state?.managers);
  }
    return Object.freeze({fixtureTeamColors,applyFixtureTeamColors,seasonFixtureTheme,teamBadgeInitials,simpleHash,buildPixelCrestData,buildCoachSilhouette,renderFixtureCrest,renderFixtureCoachPortrait,applySeasonFixtureHeroVisuals,rivalCards,renderVisibleRivals});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['visual-identity']=Object.freeze({create});
})();
