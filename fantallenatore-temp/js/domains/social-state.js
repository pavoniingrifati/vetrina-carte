/* Domain service: social-state. No DOM, timers, or persistence; state accessors remain live. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: social-state');
  function socialOwnedPlayers(){
    const user=$runtime.managerById('user');
    return (user?.roster||[]).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'it'));
  }

  function ensureSocialState(season=$runtime.state?.season){
    if(!season || !season.started) return null;
    if(!season.social || typeof season.social!=='object') season.social={conversations:{},motivationByDay:{},activity:[]};
    if(!season.social.conversations || typeof season.social.conversations!=='object') season.social.conversations={};
    if(!season.social.motivationByDay || typeof season.social.motivationByDay!=='object') season.social.motivationByDay={};
    if(!Array.isArray(season.social.activity)) season.social.activity=[];

    socialOwnedPlayers().forEach(player=>{
      const id=String(player.id);
      const conv=season.social.conversations[id] ||= {
        playerId:id,followed:true,blocked:false,relationship:50,totalMessages:0,lastMessageDay:0,lastReaction:'none',messages:[]
      };
      conv.followed=true;
      if(!Array.isArray(conv.messages)) conv.messages=[];
      if(!Number.isFinite(Number(conv.relationship))) conv.relationship=50;
      if(!Number.isFinite(Number(conv.totalMessages))) conv.totalMessages=0;
      if(conv.blocked===undefined) conv.blocked=false;
    });
    return season.social;
  }

  function socialMotivationForPlayer(playerId,day){
    return $runtime.state?.season?.social?.motivationByDay?.[String(day)]?.[String(playerId)]||null;
  }

    return Object.freeze({socialOwnedPlayers,ensureSocialState,socialMotivationForPlayer});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['social-state']=Object.freeze({create});
})();
