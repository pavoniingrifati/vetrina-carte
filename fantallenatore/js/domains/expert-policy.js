/* Domain service: expert-policy. No DOM, timers, or persistence; state accessors remain live. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: expert-policy');
  function expertPrecisionActive(season=null){
    return typeof $runtime.shopItemActive==='function' && !!$runtime.shopItemActive('expert_precision',season);
  }

  function expertDayState(day){
    const season=$runtime.state?.season;
    const manager=$runtime.managerById('user');
    if(!season || !manager) return null;
    if(!season.expertDays || typeof season.expertDays!=='object') season.expertDays={};
    const key=String(Math.max(1,Number(day||season.currentMatchday||1)));
    const precisionActive=expertPrecisionActive(season);
    const cached=season.expertDays[key];
    if(cached && !!cached.precisionActive===precisionActive) return cached;
    const seasonNo=Number($runtime.state?.career?.seasonNumber||1);
    const hash=(label)=>$runtime.careerHash(`experts|season${seasonNo}|day${key}|${label}`);
    const eligible=(manager.roster||[]).filter(p=>{
      const canonical=$runtime.playerMap.get(String(p.id));
      return canonical && canonical.marketStatus!=='abroad' && !$runtime.playerStatusForDay(p.id,Number(key)).unavailable;
    });
    const shuffled=eligible.slice().sort((a,b)=>hash(`boost-player|${a.id}`)-hash(`boost-player|${b.id}`));
    const countRoll=hash('boost-count');
    const count=countRoll<.24?0:countRoll<.82?1:2;
    const kinds=['starter','vote','goal','assist'];
    const boosts=shuffled.slice(0,count).map((player,index)=>({
      playerId:String(player.id),
      kind:kinds[Math.floor(hash(`boost-kind|${index}|${player.id}`)*kinds.length)],
      size:hash(`boost-size|${index}|${player.id}`)<.7?'small':'large'
    }));
    const experts=$runtime.EXPERT_IDS.slice().sort((a,b)=>hash(`visible|${a}`)-hash(`visible|${b}`)).slice(0,3);
    const forecasts={};
    Object.entries($runtime.INTUITION_EXPERTS).forEach(([id,cfg])=>{
      if(!eligible.length) return;
      const relevant=boosts.filter(boost=>cfg.kinds.includes(boost.kind));
      const accuracy=precisionActive?cfg.proAccuracy:cfg.accuracy;
      const hits=relevant.length && hash(`hit|${id}`)<accuracy;
      const misses=eligible.filter(p=>!boosts.some(boost=>boost.playerId===String(p.id)));
      const pool=hits?relevant:misses.length?misses:eligible;
      const index=Math.floor(hash(`pick|${id}`)*pool.length);
      const picked=pool[index];
      const playerId=String(hits?picked.playerId:picked.id);
      const kind=hits?picked.kind:cfg.kinds[Math.floor(hash(`claim|${id}`)*cfg.kinds.length)];
      forecasts[id]={playerId,kind};
    });
    return season.expertDays[key]={experts,boosts,forecasts,precisionActive};
  }

    return Object.freeze({expertPrecisionActive,expertDayState});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['expert-policy']=Object.freeze({create});
})();
