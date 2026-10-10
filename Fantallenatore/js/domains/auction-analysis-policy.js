/* Responsibility: auction-analysis-policy. Only external collaborators use live runtime accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: auction-analysis-policy');
  function playerSeasonPotentialProfile(player){
    if(!player) return {label:'NORMALE',trend:0,potential:55,tier:'normal'};
    const seasonNo=Math.max(1,Number($runtime.state?.career?.seasonNumber||1));
    const roll=$runtime.careerHash(`season-potential-tier|${seasonNo}|${player.id}`);
    const strength=$runtime.careerHash(`season-potential-strength|${seasonNo}|${player.id}`);
    if(roll<.03){
      return {label:'ELITE',trend:8+Math.floor(strength*3),potential:94+Math.floor(strength*5),tier:'elite'};
    }
    if(roll<.14){
      return {label:'ALTO',trend:4+Math.floor(strength*4),potential:78+Math.floor(strength*10),tier:'high'};
    }
    if(roll>=.97){
      return {label:'RISCHIO CALO',trend:-(8+Math.floor(strength*3)),potential:12+Math.floor(strength*10),tier:'collapse'};
    }
    if(roll>=.84){
      return {label:'BASSO',trend:-(3+Math.floor(strength*4)),potential:28+Math.floor(strength*14),tier:'low'};
    }
    const neutralTrend=-1+Math.floor(strength*5); // da -1 a +3: giocatore normalmente stabile.
    return {label:'NORMALE',trend:neutralTrend,potential:50+Math.floor(strength*17),tier:'normal'};
  }

  function clubRoleStarterSlots(clubId,role){
    const formation=String($runtime.clubMap.get(clubId)?.defaultFormation||'4-3-3').split('-').map(Number);
    return Math.max(1,Number({P:1,D:formation[0]||4,C:formation[1]||3,A:formation[2]||3}[role]||3));
  }

  function starterHierarchyBias(role,rank,slots){
    if(role==='P'){
      if(rank<=0) return 8;
      if(rank===1) return 0;
      return -5-Math.max(0,rank-2)*2;
    }
    return $runtime.clamp((Number(slots||1)-Number(rank)-.5)*1.45,-5.5,5.5);
  }

  function normalizedStarterProbability(entries,targetId,slots,temperature){
    const engine=window.FantaSeasonEngine;
    if(engine?.normalizeStarterProbabilities){
      const probabilities=engine.normalizeStarterProbabilities(entries,slots,{cap:96,floor:1,temperature});
      return Number(probabilities[String(targetId)]||0);
    }
    const row=(entries||[]).find(entry=>String(entry.id)===String(targetId));
    return row?.unavailable?0:50;
  }

  function auctionStarterProbability(player){
    if(!player) return 0;
    const slots=clubRoleStarterSlots(player.club,player.role);
    const peers=(window.FANTA_PLAYERS||[])
      .filter(p=>p.club===player.club&&p.role===player.role&&p.marketStatus!=='abroad')
      .slice()
      .sort((a,b)=>{
        const av=Number(a.ovr||0)*100+Number(a.fvm||0)*.22+Number(a.quotation||0)*.4;
        const bv=Number(b.ovr||0)*100+Number(b.fvm||0)*.22+Number(b.quotation||0)*.4;
        return bv-av;
      });
    const entries=peers.map((candidate,rank)=>({
      id:candidate.id,
      score:Number(candidate.ovr||0)+Number(candidate.fvm||0)*.008+Number(candidate.quotation||0)*.025+starterHierarchyBias(candidate.role,rank,slots),
      unavailable:false
    }));
    return normalizedStarterProbability(entries,player.id,slots,player.role==='P'?2.4:4.4);
  }

  function auctionPlayerAnalysis(player){
    if(!player) return {potential:0,label:'—',starterPct:0,trend:0,tier:'normal'};
    const profile=playerSeasonPotentialProfile(player);

    const starterPct=auctionStarterProbability(player);
    return {potential:profile.potential,label:profile.label,starterPct,trend:profile.trend,tier:profile.tier};
  }
    return Object.freeze({playerSeasonPotentialProfile,clubRoleStarterSlots,starterHierarchyBias,normalizedStarterProbability,auctionStarterProbability,auctionPlayerAnalysis});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['auction-analysis-policy']=Object.freeze({create});
})();
