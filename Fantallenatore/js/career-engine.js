(() => {
  'use strict';

  function normalizeCareer(value,startingEuros=20,startingDivision=3){
    const career=value&&typeof value==='object'?value:{};
    if(!Number.isFinite(Number(career.euros))) career.euros=startingEuros;
    if(!Number.isFinite(Number(career.startingEuros))) career.startingEuros=startingEuros;
    if(!Number.isFinite(Number(career.totalEarned))) career.totalEarned=0;
    if(!Number.isFinite(Number(career.totalSpent))) career.totalSpent=0;
    if(!Number.isFinite(Number(career.seasonNumber))) career.seasonNumber=1;
    if(!Number.isFinite(Number(career.division))) career.division=startingDivision;
    if(!Array.isArray(career.prizeHistory)) career.prizeHistory=[];
    if(!Array.isArray(career.seasonHistory)) career.seasonHistory=[];
    if(!Number.isFinite(Number(career.nextAuctionBonusCredits))) career.nextAuctionBonusCredits=0;
    if(!Number.isFinite(Number(career.fantapoints))) career.fantapoints=0;
    if(!Number.isFinite(Number(career.totalFantapointsEarned))) career.totalFantapointsEarned=0;
    if(!Number.isFinite(Number(career.totalFantapointsSpent))) career.totalFantapointsSpent=0;
    if(!Array.isArray(career.fantapointsHistory)) career.fantapointsHistory=[];
    return career;
  }

  function balance(career){
    return Math.max(0,Math.floor(Number(career?.euros||0)));
  }

  function credit(career,amount){
    const value=Math.max(0,Number(amount||0));
    career.euros=balance(career)+value;
    career.totalEarned=Number(career.totalEarned||0)+value;
    return value;
  }

  function debit(career,amount){
    const value=Math.max(0,Number(amount||0));
    if(balance(career)<value) return false;
    career.euros=Math.max(0,balance(career)-value);
    career.totalSpent=Number(career.totalSpent||0)+value;
    return true;
  }

  function createSeasonSponsor(choice,now=Date.now()){
    if(!choice) return null;
    return {
      id:choice.id,name:choice.name,selectedAt:now,earnedEuros:0,
      winRewards:{},bigMatchRewards:{},streakRewards:{},
      immediateBonusGranted:false,midseasonBonusGranted:false,freeSubscriptionUsed:false,futureBonusGranted:false,
      playerId:choice.playerId?String(choice.playerId):null,academyGrowthGranted:false
    };
  }

  // Keep the first sponsor compatible with existing saves; the second has its own reward ledger.
  function seasonSponsors(season){
    return [season?.sponsor,...(season?.sponsor?.additionalSponsors||[])].filter(Boolean);
  }

  function findSeasonSponsor(season,id){
    return seasonSponsors(season).find(sponsor=>sponsor.id===id)||null;
  }

  function opponentBlockLimit(season){
    return findSeasonSponsor(season,'double_block')?2:1;
  }

  function selectedSponsorChoices(state){
    const first=state?.sponsorChoice;
    return [first,...(first?.additionalChoices||[])].filter(Boolean).map(choice=>typeof choice==='string'?{id:choice}:choice);
  }

  const withSponsors=reward=>(career,season,...args)=>seasonSponsors(season).reduce((total,sponsor)=>total+reward(career,{...season,sponsor},...args),0);

  function userMatch(dayResult){
    const match=(dayResult?.matches||[]).find(item=>item.homeId==='user'||item.awayId==='user');
    if(!match) return null;
    const userHome=match.homeId==='user';
    return {
      match,userHome,
      userScore:Number(userHome?match.homeScore:match.awayScore),
      opponentScore:Number(userHome?match.awayScore:match.homeScore),
      opponentId:String(userHome?match.awayId:match.homeId)
    };
  }

  function addSponsorEuros(career,season,amount){
    if(['big_match','streak_bonus'].includes(season.sponsor.id)) amount=Math.max(0,Math.min(amount,40-Number(season.sponsor.earnedEuros||0)));
    credit(career,amount);
    season.sponsor.earnedEuros=Number(season.sponsor.earnedEuros||0)+amount;
    return amount;
  }

  function grantImmediateSponsorBonus(career,season){
    if(!season||season.sponsor?.id!=='bonus_firma'||season.sponsor.immediateBonusGranted) return 0;
    season.sponsor.immediateBonusGranted=true;
    season.sponsor.immediateBonus=12;
    return addSponsorEuros(career,season,12);
  }

  function grantMidseasonSponsorBonus(career,season,day,standings=[]){
    if(!season || season.sponsor?.id!=='bonus_firma' || Number(day)!==19 || season.sponsor.midseasonBonusGranted) return 0;
    season.sponsor.midseasonBonusGranted=true;
    const position=(standings||[]).findIndex(row=>String(row.managerId)==='user')+1;
    season.sponsor.midseasonPosition=position;
    return position>0 && position<=2 ? addSponsorEuros(career,season,12) : 0;
  }

  function grantBigMatchSponsorReward(career,season,day,dayResult,topManagerIds=[]){
    if(!season||season.sponsor?.id!=='big_match') return 0;
    season.sponsor.bigMatchRewards||={};
    if(season.sponsor.bigMatchRewards[String(day)]) return 0;
    const played=userMatch(dayResult);
    if(!played||played.userScore<=played.opponentScore||!topManagerIds.map(String).includes(played.opponentId)) return 0;
    season.sponsor.bigMatchRewards[String(day)]={amount:Math.min(8,Math.max(0,40-Number(season.sponsor.earnedEuros||0))),opponentId:played.opponentId};
    return addSponsorEuros(career,season,8);
  }

  function grantStreakSponsorReward(career,season,day,dayResult){
    if(!season||season.sponsor?.id!=='streak_bonus') return 0;
    season.sponsor.streakRewards||={};
    if(season.sponsor.streakRewards[String(day)]) return 0;
    const played=userMatch(dayResult);
    if(!played||played.userScore<=played.opponentScore) return 0;
    let streak=0;
    for(let index=Number(day);index>=1;index--){
      const previous=userMatch(season.matchdayResults?.[String(index)]);
      if(!previous||previous.userScore<=previous.opponentScore) break;
      streak++;
    }
    if(streak<3||streak%3!==0) return 0;
    season.sponsor.streakRewards[String(day)]={amount:Math.min(10,Math.max(0,40-Number(season.sponsor.earnedEuros||0))),streak};
    return addSponsorEuros(career,season,10);
  }

  function grantWinSponsorReward(career,season,day,dayResult){
    if(!season||season.sponsor?.id!=='win_bonus') return 0;
    season.sponsor.winRewards||={};
    if(season.sponsor.winRewards[String(day)]) return 0;
    const played=userMatch(dayResult);
    if(!played||played.userScore<=played.opponentScore) return 0;
    season.sponsor.winRewards[String(day)]=1;
    return addSponsorEuros(career,season,1);
  }

  function grantFutureAuctionBonus(career,season){
    if(!season||season.sponsor?.id!=='future_auction'||season.sponsor.futureBonusGranted) return 0;
    career.nextAuctionBonusCredits=Number(career.nextAuctionBonusCredits||0)+30;
    season.sponsor.futureBonusGranted=true;
    season.sponsor.futureBonusCredits=30;
    return 30;
  }

  function sponsorCanMakeItemFree(id,season,freeItemIds=[]){
    const sponsor=findSeasonSponsor(season,'free_subscription');
    return !!(sponsor&&!sponsor.freeSubscriptionUsed&&freeItemIds.map(String).includes(String(id)));
  }

  function buyShopItem(career,season,item,id,{freeItemIds=[],now=Date.now(),currency='eur',fpCost=null}={}){
    if(!career||!season||!item) return {ok:false,reason:'invalid'};
    season.shopPurchases||={};
    if(season.completed) return {ok:false,reason:'season_completed'};
    if(season.shopPurchases[id]) return {ok:false,reason:'already_active'};
    const free=sponsorCanMakeItemFree(id,season,freeItemIds);
    const payWithFp=!free && currency==='fp';
    const resolvedFpCost=Math.max(0,Math.floor(Number(fpCost??item.fpCost??0)));
    if(payWithFp){
      if(!resolvedFpCost) return {ok:false,reason:'fp_not_available'};
      const currentFp=Math.max(0,Math.floor(Number(career.fantapoints||0)));
      if(currentFp<resolvedFpCost) return {ok:false,reason:'insufficient_fantapoints'};
      career.fantapoints=currentFp-resolvedFpCost;
      career.totalFantapointsSpent=Number(career.totalFantapointsSpent||0)+resolvedFpCost;
    }else if(!free&&!debit(career,item.cost)) return {ok:false,reason:'insufficient_funds'};
    if(free){
      const sponsor=findSeasonSponsor(season,'free_subscription');
      sponsor.freeSubscriptionUsed=true;
      sponsor.freeSubscriptionId=id;
    }
    const paymentCurrency=free?'sponsor':payWithFp?'fp':'eur';
    const paidCost=free?0:payWithFp?resolvedFpCost:item.cost;
    season.shopPurchases[id]={
      id,cost:paidCost,currency:paymentCurrency,purchasedAt:now,seasonNumber:Number(career.seasonNumber||1),
      ...(free?{sponsorFree:true}:{})
    };
    return {ok:true,free,currency:paymentCurrency,cost:paidCost,purchase:season.shopPurchases[id]};
  }

  function grantSeasonPrize(career,season,standings,now=Date.now()){
    if(!season?.completed||season.careerPrize?.granted) return season?.careerPrize||null;
    const position=Math.max(1,(standings||[]).findIndex(row=>row.managerId==='user')+1);
    const amount=position===1?40:position===2?25:position===3?15:position<=6?8:0;
    season.careerPrize={granted:true,position,amount,grantedAt:now};
    if(amount>0) credit(career,amount);
    career.prizeHistory.push({seasonNumber:Number(career.seasonNumber||1),position,amount,grantedAt:now});
    return season.careerPrize;
  }

  window.FantaCareerEngine=Object.freeze({
    normalizeCareer,balance,credit,debit,createSeasonSponsor,
    seasonSponsors,findSeasonSponsor,opponentBlockLimit,selectedSponsorChoices,
    grantImmediateSponsorBonus:withSponsors(grantImmediateSponsorBonus),
    grantMidseasonSponsorBonus:withSponsors(grantMidseasonSponsorBonus),
    grantBigMatchSponsorReward:withSponsors(grantBigMatchSponsorReward),
    grantStreakSponsorReward:withSponsors(grantStreakSponsorReward),
    grantWinSponsorReward:withSponsors(grantWinSponsorReward),
    grantFutureAuctionBonus:withSponsors(grantFutureAuctionBonus),
    sponsorCanMakeItemFree,buyShopItem,grantSeasonPrize
  });
})();
