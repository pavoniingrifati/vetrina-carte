/* Domain service: league-state. No DOM, timers, or persistence; state accessors remain live. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: league-state');
  function currentUserFixture() {
    const season = $runtime.ensureSeasonState();
    if (!season) return null;
    const round = season.schedule[season.currentMatchday-1];
    return round?.matches?.find(m=>m.homeId==='user' || m.awayId==='user') || null;
  }

  function userOpponentIdForDay(day=$runtime.ensureSeasonState()?.currentMatchday){
    const season=$runtime.ensureSeasonState();
    if(!season || !Number(day)) return null;
    const round=season.schedule?.[Number(day)-1];
    const fixture=round?.matches?.find(m=>m.homeId==='user' || m.awayId==='user');
    if(!fixture) return null;
    return fixture.homeId==='user' ? fixture.awayId : fixture.homeId;
  }

    return Object.freeze({currentUserFixture,userOpponentIdForDay});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['league-state']=Object.freeze({create});
})();
