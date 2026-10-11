(() => {
  'use strict';

  const WINDOW_CONFIG = Object.freeze({
    winter:Object.freeze({
      internal:Object.freeze([3,5]),
      abroad:Object.freeze([2,3]),
      arrivals:Object.freeze([2,3]),
      volatility:.72
    }),
    summer:Object.freeze({
      internal:Object.freeze([14,20]),
      abroad:Object.freeze([10,15]),
      arrivals:Object.freeze([10,15]),
      volatility:1.15
    })
  });

  const ROLE_FLOOR = Object.freeze({P:2,D:5,C:5,A:3});
  const VALID_ROLES = Object.freeze(['P','D','C','A']);

  const FOREIGN_POOL_SIZE = 300;
  const FOREIGN_ROLE_WEIGHTS = Object.freeze([
    Object.freeze({role:'P',weight:.12}),
    Object.freeze({role:'D',weight:.34}),
    Object.freeze({role:'C',weight:.34}),
    Object.freeze({role:'A',weight:.20})
  ]);

  const FOREIGN_NAME_BANKS = Object.freeze([
    Object.freeze({nation:'Spagna',league:'LaLiga',first:['Alejandro','Mateo','Hugo','Iker','Nico','Adrián','Sergio','Martín'],last:['Navarro','Molina','Serrano','Vega','Campos','Ortega','Ferrer','Roldán']}),
    Object.freeze({nation:'Francia',league:'Ligue 1',first:['Lucas','Théo','Mathis','Enzo','Noah','Hugo','Amine','Yanis'],last:['Morel','Girard','Perrin','Mercier','Fontaine','Roux','Diallo','Benali']}),
    Object.freeze({nation:'Germania',league:'Bundesliga',first:['Lukas','Jonas','Felix','Leon','Nico','Florian','Julian','Max'],last:['Keller','Hartmann','Vogel','Neumann','Krüger','Brandt','Seidel','Baumann']}),
    Object.freeze({nation:'Inghilterra',league:'Premier League',first:['Oliver','Jack','Harry','Theo','Ethan','Noah','Mason','Jamie'],last:['Bennett','Turner','Walsh','Foster','Coleman','Parker','Hughes','Sutton']}),
    Object.freeze({nation:'Portogallo',league:'Primeira Liga',first:['João','Tiago','Diogo','Gonçalo','Rui','Nuno','Tomás','André'],last:['Tavares','Mendes','Correia','Faria','Coelho','Barros','Moura','Pinto']}),
    Object.freeze({nation:'Paesi Bassi',league:'Eredivisie',first:['Daan','Sem','Finn','Jesse','Luuk','Milan','Thijs','Mees'],last:['De Boer','Van Dijk','Smit','Visser','Meijer','Bos','Mulder','Kuiper']}),
    Object.freeze({nation:'Belgio',league:'Jupiler Pro League',first:['Arthur','Louis','Victor','Milan','Jules','Noah','Mathis','Elias'],last:['Peeters','Jacobs','Willems','Maes','Claes','Vermeulen','Goossens','Wouters']}),
    Object.freeze({nation:'Brasile',league:'Brasileirão',first:['Gabriel','Matheus','João','Pedro','Lucas','Caio','Bruno','Rafael'],last:['Silva','Santos','Oliveira','Costa','Rocha','Almeida','Teixeira','Moura']}),
    Object.freeze({nation:'Argentina',league:'Primera División',first:['Santiago','Mateo','Tomás','Joaquín','Facundo','Lautaro','Nicolás','Bruno'],last:['Acosta','Benítez','Pereyra','Romero','Quiroga','Ferreyra','Mendoza','Cabrera']}),
    Object.freeze({nation:'Uruguay',league:'Primera División Uruguay',first:['Agustín','Franco','Santiago','Martín','Joaquín','Nicolás','Federico','Matías'],last:['Silveira','Pereira','Cabrera','Suárez','Olivera','Viera','Cardozo','Méndez']}),
    Object.freeze({nation:'Croazia',league:'HNL',first:['Luka','Ivan','Ante','Marko','Petar','Josip','Marin','Lovro'],last:['Kovač','Babić','Marić','Jurić','Novak','Perić','Radić','Božić']}),
    Object.freeze({nation:'Serbia',league:'SuperLiga Serbia',first:['Nikola','Luka','Stefan','Miloš','Dušan','Marko','Filip','Aleksa'],last:['Jovanović','Petrović','Nikolić','Ilić','Pavlović','Stojanović','Simić','Đorđević']}),
    Object.freeze({nation:'Danimarca',league:'Superligaen',first:['Mikkel','Emil','Oliver','Magnus','Victor','Noah','Frederik','Kasper'],last:['Nielsen','Jensen','Larsen','Madsen','Christensen','Thomsen','Poulsen','Olsen']}),
    Object.freeze({nation:'Svezia',league:'Allsvenskan',first:['Erik','Oscar','Viktor','Hugo','Elias','Anton','Albin','Isak'],last:['Andersson','Johansson','Lindberg','Bergström','Sjöberg','Nyberg','Ekström','Holm']}),
    Object.freeze({nation:'Turchia',league:'Süper Lig',first:['Emir','Kerem','Arda','Mert','Burak','Eren','Yusuf','Kaan'],last:['Yılmaz','Kaya','Demir','Şahin','Aydın','Arslan','Çelik','Koç']}),
    Object.freeze({nation:'Colombia',league:'Primera A Colombia',first:['Santiago','Juan','Sebastián','Daniel','Nicolás','Andrés','Mateo','Kevin'],last:['Ramírez','Moreno','Rojas','Castro','Vargas','Medina','Salazar','Córdoba']}),
    Object.freeze({nation:'Nigeria',league:'Campionato estero',first:['Chinedu','Samuel','Victor','Daniel','Ibrahim','Emeka','Tobi','Kelvin'],last:['Okafor','Balogun','Nwosu','Adeyemi','Obi','Eze','Onyeka','Udo']}),
    Object.freeze({nation:'Senegal',league:'Campionato estero',first:['Mamadou','Ibrahima','Cheikh','Ousmane','Pape','Abdou','Moussa','Aliou'],last:['Diop','Ndiaye','Fall','Sarr','Ba','Gueye','Faye','Cissé']})
  ]);

  function hash01(input){
    const text=String(input||'');
    let h=2166136261;
    for(let i=0;i<text.length;i++){
      h^=text.charCodeAt(i);
      h=Math.imul(h,16777619);
    }
    h^=h>>>13; h=Math.imul(h,0x5bd1e995); h^=h>>>15;
    return (h>>>0)/4294967296;
  }

  function randomFor(seed,key){ return hash01(`${seed}|${key}`); }
  function clamp(value,min,max){ return Math.max(min,Math.min(max,Number(value)||0)); }
  function average(values){
    const clean=(values||[]).map(Number).filter(Number.isFinite);
    return clean.length?clean.reduce((sum,value)=>sum+value,0)/clean.length:0;
  }
  function rangeCount(seed,key,range){
    const min=Number(range?.[0]||0),max=Number(range?.[1]??min);
    if(max<=min) return min;
    return min+Math.floor(randomFor(seed,key)*(max-min+1));
  }


  function weightedValue(seed,key,rows){
    const total=(rows||[]).reduce((sum,row)=>sum+Math.max(0,Number(row.weight||0)),0);
    if(!total) return rows?.[0]||null;
    let cursor=randomFor(seed,key)*total;
    for(const row of rows){
      cursor-=Math.max(0,Number(row.weight||0));
      if(cursor<=0) return row;
    }
    return rows[rows.length-1]||null;
  }

  function foreignRole(seed,index){
    return weightedValue(seed,`foreign-role|${index}`,FOREIGN_ROLE_WEIGHTS)?.role||'C';
  }

  function foreignOvrProfile(seed,index){
    const tierRoll=randomFor(seed,`foreign-tier|${index}`);
    const strength=randomFor(seed,`foreign-strength|${index}`);
    if(tierRoll<.15) return {tier:'top',ovr:82+Math.floor(strength*9)};
    if(tierRoll<.45) return {tier:'good',ovr:76+Math.floor(strength*6)};
    if(tierRoll<.80) return {tier:'standard',ovr:70+Math.floor(strength*6)};
    return {tier:'prospect',ovr:62+Math.floor(strength*12)};
  }

  function foreignAge(seed,index,tier){
    const roll=randomFor(seed,`foreign-age|${index}`);
    if(tier==='prospect') return 18+Math.floor(roll*5);
    if(tier==='top') return 22+Math.floor(roll*9);
    if(tier==='good') return 21+Math.floor(roll*11);
    return 20+Math.floor(roll*13);
  }

  function foreignPotential(seed,index,ovr,age,tier){
    const roll=randomFor(seed,`foreign-potential|${index}`);
    let extra=tier==='prospect'?6+Math.floor(roll*13):tier==='good'?2+Math.floor(roll*8):Math.floor(roll*6);
    if(age>=29) extra=Math.min(extra,2);
    if(age>=32) extra=0;
    return clamp(Math.max(ovr,ovr+extra),ovr,94);
  }

  function foreignEconomy(role,ovr,age,potential){
    const roleFactor={P:.82,D:.92,C:1.02,A:1.12}[role]||1;
    const youthFactor=age<=22?1.12:age>=30?.86:1;
    const upside=1+Math.max(0,potential-ovr)*.018;
    const base=Math.max(1,(ovr-58)*1.05*roleFactor*youthFactor*upside);
    return {
      quotation:Math.max(1,Math.round(base*.72)),
      fvm:Math.max(2,Math.round(base*2.05))
    };
  }

  function generateProceduralForeignPool(seed='career',count=FOREIGN_POOL_SIZE){
    const total=Math.max(40,Math.floor(Number(count)||FOREIGN_POOL_SIZE));
    const pool=[];
    for(let index=0;index<total;index++){
      const bankIndex=Math.min(FOREIGN_NAME_BANKS.length-1,Math.floor(randomFor(seed,`foreign-bank|${index}`)*FOREIGN_NAME_BANKS.length));
      const bank=FOREIGN_NAME_BANKS[bankIndex];
      const first=bank.first[Math.min(bank.first.length-1,Math.floor(randomFor(seed,`foreign-first|${index}`)*bank.first.length))];
      const last=bank.last[Math.min(bank.last.length-1,Math.floor(randomFor(seed,`foreign-last|${index}`)*bank.last.length))];
      const name=`${first} ${last}`;
      const role=foreignRole(seed,index);
      const profile=foreignOvrProfile(seed,index);
      const age=foreignAge(seed,index,profile.tier);
      const potentialOvr=foreignPotential(seed,index,profile.ovr,age,profile.tier);
      const economy=foreignEconomy(role,profile.ovr,age,potentialOvr);
      pool.push({
        id:`foreign-${index+1}-${Math.floor(randomFor(seed,`foreign-id|${index}`)*1e8).toString(36)}`,
        name,role,roleLabel:{P:'Portiere',D:'Difensore',C:'Centrocampista',A:'Attaccante'}[role],
        nation:bank.nation,age,ovr:profile.ovr,potentialOvr,
        quotation:economy.quotation,fvm:economy.fvm,
        sourceLeague:bank.league,sourceNation:bank.nation,
        originClub:`Club estero ${1+Math.floor(randomFor(seed,`foreign-club|${index}`)*24)}`,
        foreignTier:profile.tier,
        marketStatus:'foreign_pool',hidden:true,club:'estero'
      });
    }
    return pool;
  }

  function generateForeignPool(seed='career',count=FOREIGN_POOL_SIZE){
    const total=Math.max(40,Math.floor(Number(count)||FOREIGN_POOL_SIZE));
    const catalog=Array.isArray(window.FANTA_FOREIGN_PLAYERS)?window.FANTA_FOREIGN_PLAYERS:[];
    if(catalog.length>=total){
      return catalog.slice(0,total).map((identity,index)=>{
        const bankIndex=Math.min(FOREIGN_NAME_BANKS.length-1,Math.floor(randomFor(seed,`catalog-bank|${identity.id}`)*FOREIGN_NAME_BANKS.length));
        const bank=FOREIGN_NAME_BANKS[bankIndex];
        const role=foreignRole(seed,`catalog-${identity.id}`);
        const profile=foreignOvrProfile(seed,`catalog-${identity.id}`);
        const age=foreignAge(seed,`catalog-${identity.id}`,profile.tier);
        const potentialOvr=foreignPotential(seed,`catalog-${identity.id}`,profile.ovr,age,profile.tier);
        const economy=foreignEconomy(role,profile.ovr,age,potentialOvr);
        return {
          id:String(identity.id||`foreign-name-${index+1}`),name:String(identity.name),
          role,roleLabel:{P:'Portiere',D:'Difensore',C:'Centrocampista',A:'Attaccante'}[role],
          nation:bank.nation,age,ovr:profile.ovr,potentialOvr,
          quotation:economy.quotation,fvm:economy.fvm,
          sourceLeague:bank.league,sourceNation:bank.nation,
          originClub:`Club estero ${1+Math.floor(randomFor(seed,`catalog-club|${identity.id}`)*24)}`,
          foreignTier:profile.tier,marketStatus:'foreign_pool',hidden:true,club:'estero',
          catalogVersion:String(identity.catalogVersion||'foreign-names-v2')
        };
      });
    }
    return generateProceduralForeignPool(seed,total);
  }

  function foreignPoolSummary(pool){
    const active=(pool||[]).filter(player=>player?.marketStatus==='foreign_pool');
    const roles=Object.fromEntries(VALID_ROLES.map(role=>[role,active.filter(player=>player.role===role).length]));
    return {total:(pool||[]).length,available:active.length,roles};
  }

  function playerStats(statsByPlayer,playerId){
    const raw=statsByPlayer?.[String(playerId)]||statsByPlayer?.[playerId]||{};
    return {
      appearances:Number(raw.appearances||raw.played||0),
      starts:Number(raw.starts||0),
      goals:Number(raw.goals||0),
      assists:Number(raw.assists||0),
      avgVote:Number(raw.avgVote||raw.averageVote||0),
      fantasyAverage:Number(raw.fantasyAverage||raw.avgFantasy||0)
    };
  }

  function formScore(stats){
    const apps=Math.max(0,stats.appearances);
    const vote=stats.avgVote>0?(stats.avgVote-6)*7:0;
    return clamp(
      stats.goals*1.8+stats.assists*1.15+vote+Math.min(6,apps*.12)+Math.max(0,stats.fantasyAverage-6)*2.1,
      -8,28
    );
  }

  function rawPlayerValue(player,statsByPlayer){
    const ovr=Number(player?.ovr||60);
    const quote=Number(player?.quotation||0);
    const fvm=Number(player?.fvm||0);
    return ovr*1.35+Math.log1p(Math.max(0,fvm))*4.2+Math.sqrt(Math.max(0,quote))*3.3+formScore(playerStats(statsByPlayer,player?.id));
  }

  function activeSerieAPlayers(players,clubIds){
    const valid=new Set((clubIds||[]).map(String));
    return (players||[]).filter(player=>player&&VALID_ROLES.includes(player.role)&&valid.has(String(player.club))&&player.marketStatus!=='abroad');
  }

  function rosterMap(players,clubs){
    const map=new Map((clubs||[]).map(club=>[String(club.id),[]]));
    (players||[]).forEach(player=>{
      const list=map.get(String(player.club));
      if(list) list.push(player);
    });
    return map;
  }

  function leagueRoleBenchmarks(players){
    const byRole={P:[],D:[],C:[],A:[]};
    VALID_ROLES.forEach(role=>{
      const rolePlayers=(players||[]).filter(player=>player.role===role);
      byRole[role]=rolePlayers.map(player=>Number(player.ovr||60));
    });
    const clubCount=Math.max(1,new Set((players||[]).map(player=>String(player.club))).size);
    return Object.fromEntries(VALID_ROLES.map(role=>[role,{
      avgOvr:average(byRole[role]),
      avgCount:byRole[role].length/clubCount
    }]));
  }

  function clubProfiles(players,clubs,statsByPlayer){
    const rosters=rosterMap(players,clubs);
    const raw=(clubs||[]).map(club=>{
      const roster=rosters.get(String(club.id))||[];
      const top=roster.slice().sort((a,b)=>rawPlayerValue(b,statsByPlayer)-rawPlayerValue(a,statsByPlayer)).slice(0,18);
      const quality=average(top.map(player=>Number(player.ovr||60)));
      return {clubId:String(club.id),quality,rosterSize:roster.length};
    });
    const qualities=raw.map(row=>row.quality).filter(Boolean);
    const min=Math.min(...qualities),max=Math.max(...qualities);
    return new Map(raw.map(row=>{
      const normalized=max>min?(row.quality-min)/(max-min):.5;
      return [row.clubId,{
        ...row,
        reputation:.68+normalized*.64,
        spending:.72+normalized*.72,
        selling:.92+(1-normalized)*.34
      }];
    }));
  }

  function roleCount(roster,role){ return (roster||[]).filter(player=>player.role===role).length; }
  function roleAverageOvr(roster,role){ return average((roster||[]).filter(player=>player.role===role).map(player=>Number(player.ovr||60))); }
  function roleCoreAverageOvr(roster,role){
    const coreSize={P:2,D:5,C:5,A:4}[role]||4;
    const values=(roster||[])
      .filter(player=>player.role===role)
      .map(player=>Number(player.ovr||60))
      .sort((a,b)=>b-a)
      .slice(0,coreSize);
    return average(values);
  }

  // Evita trasferimenti poco credibili verso club/reparti molto più forti.
  // Il bisogno numerico del ruolo può allargare leggermente la soglia, ma non
  // deve trasformare una big in una destinazione plausibile per un OVR 50-60.
  function destinationQualityFloor(destination,role,rosters,profiles){
    const roster=rosters.get(String(destination))||[];
    const roleAvg=roleAverageOvr(roster,role)||65;
    const coreAvg=roleCoreAverageOvr(roster,role)||roleAvg;
    const reference=Math.max(roleAvg,coreAvg-1);
    const count=roleCount(roster,role);

    // La qualità reale del reparto pesa più della sola reputazione del club.
    // Più il reparto è forte, meno può scendere il livello dell'acquisto.
    const tolerance=reference>=82?7:reference>=78?8:reference>=74?10:13;
    const emergencyDepth=reference<76
      ? (count<=ROLE_FLOOR[role]?2:count<=ROLE_FLOOR[role]+1?1:0)
      : 0;
    const profile=profiles.get(String(destination))||{reputation:1};
    const reputation=Number(profile.reputation||1);
    const roleFloor=reference>=82?72:reference>=78?69:reference>=74?65:58;
    const clubFloor=reputation>=1.25?73:reputation>=1.15?71:reputation>=1.10?70:reputation>=1.02?66:58;
    return Math.max(roleFloor,clubFloor,reference-tolerance-emergencyDepth);
  }

  function roleNeedScore(clubId,role,rosters,benchmarks,profiles){
    const roster=rosters.get(String(clubId))||[];
    const benchmark=benchmarks[role]||{avgCount:0,avgOvr:70};
    const count=roleCount(roster,role);
    const avg=roleAverageOvr(roster,role)||0;
    const shortage=Math.max(0,benchmark.avgCount-count)*16;
    const thinDepth=count<=ROLE_FLOOR[role]?22:count<=ROLE_FLOOR[role]+1?9:0;
    const qualityGap=Math.max(0,benchmark.avgOvr-avg)*1.5;
    const profile=profiles.get(String(clubId))||{spending:1};
    return (shortage+thinDepth+qualityGap+5)*profile.spending;
  }

  function canSellPlayer(player,rosters){
    const roster=rosters.get(String(player.club))||[];
    return roleCount(roster,player.role)>ROLE_FLOOR[player.role] && roster.length>17;
  }

  function depthRank(player,rosters,statsByPlayer){
    const peers=(rosters.get(String(player.club))||[])
      .filter(item=>item.role===player.role)
      .slice().sort((a,b)=>rawPlayerValue(b,statsByPlayer)-rawPlayerValue(a,statsByPlayer));
    const index=peers.findIndex(item=>String(item.id)===String(player.id));
    return {rank:index<0?peers.length:index+1,total:peers.length};
  }

  function internalCandidateScore(player,rosters,profiles,statsByPlayer,seed,windowType){
    if(!canSellPlayer(player,rosters)) return -Infinity;
    const depth=depthRank(player,rosters,statsByPlayer);
    const profile=profiles.get(String(player.club))||{selling:1,reputation:1};
    const depthRatio=depth.total>1?(depth.rank-1)/(depth.total-1):0;
    const benchPressure=depthRatio*(windowType==='summer'?34:42);
    const value=rawPlayerValue(player,statsByPlayer);
    const sweetSpot=18-Math.abs(value-106)*.10;
    const breakout=formScore(playerStats(statsByPlayer,player.id));
    const smallClubShowcase=Math.max(0,1.02-profile.reputation)*Math.max(0,Number(player.ovr||60)-72)*1.9;
    const protectedStar=(depth.rank<=2 && profile.reputation>1.02)
      ? (windowType==='winter'?-34:-19)
      : 0;
    const noise=(randomFor(seed,`internal-candidate|${player.id}`)-.5)*(windowType==='summer'?18:9);
    return value*.16+benchPressure+sweetSpot+profile.selling*8+breakout*.22+smallClubShowcase+protectedStar+noise;
  }

  function abroadCandidateScore(player,rosters,profiles,statsByPlayer,seed,windowType){
    if(!canSellPlayer(player,rosters)) return -Infinity;
    const stats=playerStats(statsByPlayer,player.id);
    const profile=profiles.get(String(player.club))||{reputation:1,selling:1};
    const value=rawPlayerValue(player,statsByPlayer);
    const breakout=formScore(stats);
    const ovr=Number(player.ovr||60);
    const depth=depthRank(player,rosters,statsByPlayer);

    // L'interesse estero non deve coincidere sempre con la lista dei giocatori
    // più forti della Serie A. Il mercato cerca soprattutto titolari e giocatori
    // nel pieno del valore (circa 77-84 OVR), mentre le superstar restano
    // cedibili ma sono protette e quindi molto meno automatiche.
    const marketSweetSpot=18-Math.abs(ovr-83)*.82;
    const eliteProtection=ovr>=90?(windowType==='winter'?-8:-4)
      :ovr>=87?(windowType==='winter'?-4:-2)
      :0;
    const keyPlayerProtection=depth.rank<=2
      ? -(3+Math.max(0,profile.reputation-.92)*6)
      : 0;
    const smallerClubPull=(1.35-profile.reputation)*10;
    const noise=(randomFor(seed,`abroad-candidate|${player.id}`)-.5)*(windowType==='summer'?18:10);
    return value*.18+marketSweetSpot+breakout*.52+smallerClubPull+profile.selling*5+eliteProtection+keyPlayerProtection+noise;
  }

  function destinationScore(player,destination,source,rosters,benchmarks,profiles,statsByPlayer,seed,windowType){
    if(destination===source) return -Infinity;
    const destProfile=profiles.get(String(destination))||{reputation:1,spending:1};
    const sourceProfile=profiles.get(String(source))||{reputation:1};
    const need=roleNeedScore(destination,player.role,rosters,benchmarks,profiles);
    const playerQuality=Number(player.ovr||60);
    const destRoster=rosters.get(String(destination))||[];
    const destRoleAvg=roleAverageOvr(destRoster,player.role)||65;
    const minQuality=destinationQualityFloor(destination,player.role,rosters,profiles);
    if(playerQuality<minQuality) return -Infinity;
    const coreRoleAvg=roleCoreAverageOvr(destRoster,player.role)||destRoleAvg;
    const targetQuality=Math.max(destRoleAvg+2,coreRoleAvg-1);
    const fit=20-Math.abs(playerQuality-targetQuality)*1.45;
    const reputationDelta=destProfile.reputation-sourceProfile.reputation;
    const upward=reputationDelta*25;
    const sourceDepth=depthRank(player,rosters,statsByPlayer);
    const importantAtSource=sourceDepth.rank<=2;
    const downwardGap=Math.max(0,-reputationDelta);
    const downwardPenalty=downwardGap*(importantAtSource?95:48)+(downwardGap>.20?(importantAtSource?34:14):0);
    const spend=destProfile.spending*6;
    const noise=(randomFor(seed,`destination|${player.id}|${destination}`)-.5)*(windowType==='summer'?12:8);
    return need+fit+upward-downwardPenalty+spend+noise+rawPlayerValue(player,statsByPlayer)*.03;
  }

  function weightedTop(rows,seed,key,topN=6){
    const ordered=(rows||[]).filter(row=>Number.isFinite(row.score)).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,topN));
    if(!ordered.length) return null;
    // I punteggi vicini restano in competizione; un'opzione molto peggiore
    // conserva una piccola probabilità senza pesare quasi quanto la migliore.
    const best=ordered[0].score;
    const weights=ordered.map((row,index)=>Math.max(.002,Math.exp(-Math.max(0,best-row.score)/9)*(1-index*.025)));
    const total=weights.reduce((sum,value)=>sum+value,0);
    let cursor=randomFor(seed,key)*total;
    for(let index=0;index<ordered.length;index++){
      cursor-=weights[index];
      if(cursor<=0) return ordered[index];
    }
    return ordered[0];
  }

  function moveVirtualPlayer(player,toClub,rosters){
    const from=String(player.club);
    const fromRoster=rosters.get(from)||[];
    rosters.set(from,fromRoster.filter(item=>String(item.id)!==String(player.id)));
    const moved={...player,club:String(toClub)};
    rosters.set(String(toClub),[...(rosters.get(String(toClub))||[]),moved]);
    return moved;
  }

  function removeVirtualPlayer(player,rosters){
    const from=String(player.club);
    rosters.set(from,(rosters.get(from)||[]).filter(item=>String(item.id)!==String(player.id)));
  }

  function recordDeparture(player,rosters,needs,statsByPlayer,source='internal'){
    const key=`${player.club}|${player.role}`;
    const depth=depthRank(player,rosters,statsByPlayer);
    const important=depth.rank<=2;
    const isAbroad=source==='abroad';
    const previous=needs.get(key)||{
      count:0,quality:0,important:false,
      abroadCount:0,abroadQuality:0,abroadImportant:false
    };
    needs.set(key,{
      count:previous.count+1,
      quality:Math.max(previous.quality,Number(player.ovr||60)),
      important:previous.important||important,
      abroadCount:Number(previous.abroadCount||0)+(isAbroad?1:0),
      abroadQuality:isAbroad?Math.max(Number(previous.abroadQuality||0),Number(player.ovr||60)):Number(previous.abroadQuality||0),
      abroadImportant:!!previous.abroadImportant||(isAbroad&&important)
    });
  }

  function coverDepartureNeed(clubId,player,needs){
    const key=`${clubId}|${player.role}`;
    const needed=needs.get(key);
    if(!needed) return;
    if(needed.count<=1){ needs.delete(key); return; }
    const abroadCount=Math.max(0,Number(needed.abroadCount||0)-1);
    needs.set(key,{
      ...needed,
      count:needed.count-1,
      abroadCount,
      abroadQuality:abroadCount?Number(needed.abroadQuality||0):0,
      abroadImportant:abroadCount?!!needed.abroadImportant:false
    });
  }

  function selectInternalTransfers({players,clubs,rosters,benchmarks,profiles,statsByPlayer,seed,windowType,count,used,departureNeeds}){
    const operations=[];
    const incomingByClub=new Map();
    const incomingRoleByClub=new Map();
    const clubCap=windowType==='summer'?4:2;
    const roleCap=windowType==='summer'?2:1;
    for(let step=0;step<count;step++){
      const candidates=players
        .filter(player=>!used.has(String(player.id)) && canSellPlayer(player,rosters))
        .map(player=>({player,score:internalCandidateScore(player,rosters,profiles,statsByPlayer,seed,windowType)}));
      const selected=weightedTop(candidates,seed,`internal-pick|${step}`,Math.min(18,candidates.length));
      if(!selected) break;
      const player=selected.player;
      const destinations=clubs.map(club=>{
        const clubId=String(club.id);
        const totalIncoming=Number(incomingByClub.get(clubId)||0);
        const roleKey=`${clubId}|${player.role}`;
        const roleIncoming=Number(incomingRoleByClub.get(roleKey)||0);
        const capacityPenalty=totalIncoming>=clubCap || roleIncoming>=roleCap ? 1000 : 0;
        return {
          clubId,
          score:destinationScore(player,clubId,String(player.club),rosters,benchmarks,profiles,statsByPlayer,seed,windowType)-capacityPenalty
        };
      });
      const destination=weightedTop(destinations,seed,`internal-destination|${step}|${player.id}`,7);
      if(!destination || !Number.isFinite(destination.score)) { used.add(String(player.id)); continue; }
      const fromClub=String(player.club),toClub=String(destination.clubId);
      recordDeparture(player,rosters,departureNeeds,statsByPlayer,'internal');
      const moved=moveVirtualPlayer(player,toClub,rosters);
      coverDepartureNeed(toClub,moved,departureNeeds);
      incomingByClub.set(toClub,Number(incomingByClub.get(toClub)||0)+1);
      const incomingRoleKey=`${toClub}|${player.role}`;
      incomingRoleByClub.set(incomingRoleKey,Number(incomingRoleByClub.get(incomingRoleKey)||0)+1);
      const idx=players.findIndex(item=>String(item.id)===String(player.id));
      if(idx>=0) players[idx]=moved;
      used.add(String(player.id));
      operations.push({
        id:`internal-${windowType}-${step+1}-${player.id}`,
        type:'internal',playerId:String(player.id),playerName:String(player.name||''),role:player.role,
        fromClub,toClub,ovr:Number(player.ovr||60),
        reason:'club_need',score:Number((selected.score+destination.score).toFixed(2))
      });
    }
    return operations;
  }

  function selectAbroadDepartures({players,rosters,profiles,statsByPlayer,seed,windowType,count,used,departureNeeds}){
    const operations=[];
    for(let step=0;step<count;step++){
      const candidates=players
        .filter(player=>!used.has(String(player.id)) && canSellPlayer(player,rosters))
        .map(player=>({player,score:abroadCandidateScore(player,rosters,profiles,statsByPlayer,seed,windowType)}));
      const selected=weightedTop(candidates,seed,`abroad-pick|${step}`,Math.min(20,candidates.length));
      if(!selected) break;
      const player=selected.player;
      recordDeparture(player,rosters,departureNeeds,statsByPlayer,'abroad');
      removeVirtualPlayer(player,rosters);
      used.add(String(player.id));
      operations.push({
        id:`abroad-${windowType}-${step+1}-${player.id}`,
        type:'abroad',playerId:String(player.id),playerName:String(player.name||''),role:player.role,
        fromClub:String(player.club),toClub:null,destination:'ESTERO',ovr:Number(player.ovr||60),
        reason:'foreign_interest',score:Number(selected.score.toFixed(2))
      });
    }
    return operations;
  }

  function arrivalClubRoleOptions(clubs,rosters,benchmarks,profiles,seed,step,departureNeeds=new Map()){
    const options=[];
    clubs.forEach(club=>{
      VALID_ROLES.forEach(role=>{
        const need=roleNeedScore(String(club.id),role,rosters,benchmarks,profiles);
        const vacancy=departureNeeds.get(`${club.id}|${role}`);
        const abroadReplacement=Number(vacancy?.abroadCount||0)>0;
        const vacancyQuality=abroadReplacement?Number(vacancy?.abroadQuality||0):Number(vacancy?.quality||0);
        const vacancyImportant=abroadReplacement?!!vacancy?.abroadImportant:!!vacancy?.important;
        const replacement=vacancy?Math.min(68,(abroadReplacement?46:(vacancyImportant?23:9))+Math.max(0,vacancyQuality-(roleAverageOvr(rosters.get(String(club.id))||[],role)||65))*.9+Math.max(0,Number(vacancy.count||1)-1)*5):0;
        const noise=(randomFor(seed,`arrival-need|${step}|${club.id}|${role}`)-.5)*8;
        options.push({clubId:String(club.id),role,score:need+replacement+noise,replacement:!!vacancy,abroadReplacement});
      });
    });
    return options;
  }

  function selectExternalPlayer(externalPool,role,targetOvr,usedExternal,seed,key){
    const candidates=(externalPool||[])
      .filter(player=>player&&player.role===role&&!usedExternal.has(String(player.id))&&(!player.marketStatus||player.marketStatus==='foreign_pool'))
      .map(player=>{
        const gap=Math.abs(Number(player.ovr||60)-targetOvr);
        const closeBonus=gap<=1?8:gap<=3?4:0;
        return {player,score:34-gap*2.8+closeBonus+(randomFor(seed,`${key}|${player.id}`)-.5)*6};
      });
    return weightedTop(candidates,seed,`${key}|pick`,10)?.player||null;
  }

  function selectArrivals({externalPool,clubs,rosters,benchmarks,profiles,seed,windowType,count,usedExternal,departureNeeds}){
    const operations=[];
    for(let step=0;step<count;step++){
      const choice=weightedTop(arrivalClubRoleOptions(clubs,rosters,benchmarks,profiles,seed,step,departureNeeds),seed,`arrival-target|${step}`,16);
      if(!choice) break;
      const roster=rosters.get(choice.clubId)||[];
      const clubProfile=profiles.get(choice.clubId)||{reputation:1};
      const roleAvg=roleAverageOvr(roster,choice.role)||68;
      const vacancy=departureNeeds.get(`${choice.clubId}|${choice.role}`);
      const abroadReplacement=Number(vacancy?.abroadCount||0)>0;
      const vacancyQuality=abroadReplacement?Number(vacancy?.abroadQuality||0):Number(vacancy?.quality||0);
      const vacancyImportant=abroadReplacement?!!vacancy?.abroadImportant:!!vacancy?.important;
      let replacementOvr=0;
      if(vacancyImportant){
        const soldQuality=vacancyQuality;
        const reputation=Number(clubProfile.reputation||1);
        const baseGap=soldQuality>=88?(reputation>=1.05?1:3)
          :soldQuality>=83?(reputation>=1.05?2:4)
          :(reputation>=1.05?3:5);
        const variation=Math.floor(randomFor(seed,`replacement-gap|${step}|${choice.clubId}|${choice.role}`)*2);
        replacementOvr=soldQuality-baseGap-variation;
      }else if(abroadReplacement && vacancyQuality){
        // Anche la partenza di un giocatore non-top genera un rimpiazzo
        // coerente, senza obbligare il club a comprare una superstar.
        replacementOvr=vacancyQuality-(2+Math.floor(randomFor(seed,`replacement-depth-gap|${step}|${choice.clubId}|${choice.role}`)*4));
      }
      const targetOvr=Math.round(clamp(Math.max(roleAvg+(clubProfile.reputation-1)*8+(windowType==='summer'?2:1),replacementOvr),62,90));
      const external=selectExternalPlayer(externalPool,choice.role,targetOvr,usedExternal,seed,`arrival-player|${step}|${choice.clubId}`);
      if(external){
        usedExternal.add(String(external.id));
        rosters.set(choice.clubId,[...roster,{...external,club:choice.clubId,marketStatus:'serie_a'}]);
        coverDepartureNeed(choice.clubId,external,departureNeeds);
      }
      operations.push({
        id:`arrival-${windowType}-${step+1}-${external?.id||`${choice.clubId}-${choice.role}`}`,
        type:external?'arrival':'arrival_request',
        playerId:external?String(external.id):null,
        playerName:external?String(external.name||''):null,
        role:choice.role,fromClub:null,toClub:choice.clubId,destination:null,
        ovr:external?Number(external.ovr||targetOvr):targetOvr,
        targetOvr,
        reason:choice.replacement?'replacement':'club_need',
        replacementSource:choice.abroadReplacement?'abroad':(choice.replacement?'internal':null),
        score:Number(choice.score.toFixed(2)),
        externalPlayer:external?{...external}:null
      });
    }
    return operations;
  }

  function createMarketState(seed='career'){
    const normalizedSeed=String(seed);
    return {
      version:3,seed:normalizedSeed,windows:[],history:[],playerClubOverrides:{},
      abroadPlayerIds:[],incomingPlayerIds:[],foreignPool:generateForeignPool(normalizedSeed,FOREIGN_POOL_SIZE),specialPlayers:[]
    };
  }

  function planWindow(options={}){
    const windowType=options.windowType==='summer'?'summer':'winter';
    const config=WINDOW_CONFIG[windowType];
    const clubs=(options.clubs||[]).map(club=>({...club,id:String(club.id)}));
    const clubIds=clubs.map(club=>club.id);
    const active=activeSerieAPlayers(options.players||[],clubIds).map(player=>({...player,club:String(player.club)}));
    const statsByPlayer=options.statsByPlayer||{};
    const seed=String(options.seed||`market-${windowType}`);
    const rosters=rosterMap(active,clubs);
    const benchmarks=leagueRoleBenchmarks(active);
    const profiles=clubProfiles(active,clubs,statsByPlayer);
    const used=new Set(),usedExternal=new Set(),departureNeeds=new Map();
    const internalTarget=rangeCount(seed,'target-internal',config.internal);
    const abroadTarget=rangeCount(seed,'target-abroad',config.abroad);

    const internal=selectInternalTransfers({players:active,clubs,rosters,benchmarks,profiles,statsByPlayer,seed,windowType,count:internalTarget,used,departureNeeds});
    const abroad=selectAbroadDepartures({players:active,rosters,profiles,statsByPlayer,seed,windowType,count:abroadTarget,used,departureNeeds});
    // Gli arrivi dall'estero compensano le partenze effettive verso l'estero.
    // I trasferimenti interni ridistribuiscono giocatori ma non devono gonfiare
    // artificialmente il numero totale di calciatori presenti in Serie A.
    const arrivalTarget=abroad.length;
    const arrivals=selectArrivals({externalPool:options.externalPool||[],clubs,rosters,benchmarks,profiles,seed,windowType,count:arrivalTarget,usedExternal,departureNeeds});
    const operations=[...internal,...abroad,...arrivals];

    return {
      id:`${windowType}-${seed}`,
      windowType,seed,
      generatedAt:Number(options.generatedAt||0),
      targets:{internal:internalTarget,abroad:abroadTarget,arrivals:arrivalTarget},
      counts:{
        internal:internal.length,
        abroad:abroad.length,
        arrivals:arrivals.filter(op=>op.type==='arrival').length,
        arrivalRequests:arrivals.filter(op=>op.type==='arrival_request').length,
        total:operations.length
      },
      operations,
      clubProfiles:Object.fromEntries([...profiles.entries()]),
      roleBenchmarks:benchmarks
    };
  }

  function compactMarketState(marketState){
    if(!marketState || typeof marketState!=='object') return marketState;
    const windows=marketState.windows||[];
    const kept=windows.slice(-4);
    const windowIds=new Set(kept.map(item=>item.id));
    const history=marketState.history||[];
    const latest=new Map();
    history.forEach((operation,index)=>{if(operation?.playerId) latest.set(String(operation.playerId),index);});
    const latestIndices=new Set(latest.values());
    return {...marketState,
      appliedWindowIds:[...new Set([...(marketState.appliedWindowIds||[]),...windows.map(item=>item.id)])],
      windows:kept,
      history:history.filter((operation,index)=>latestIndices.has(index)||windowIds.has(operation.windowId))
    };
  }

  function applyPlan(marketState,plan){
    const next={...compactMarketState(marketState||createMarketState(plan?.seed||'career'))};
    next.windows=Array.isArray(next.windows)?next.windows.slice():[];
    next.history=Array.isArray(next.history)?next.history.slice():[];
    next.playerClubOverrides={...(next.playerClubOverrides||{})};
    next.abroadPlayerIds=Array.isArray(next.abroadPlayerIds)?next.abroadPlayerIds.slice():[];
    next.incomingPlayerIds=Array.isArray(next.incomingPlayerIds)?next.incomingPlayerIds.slice():[];
    next.foreignPool=Array.isArray(next.foreignPool)&&next.foreignPool.length
      ? next.foreignPool.map(player=>({...player}))
      : generateForeignPool(next.seed||plan?.seed||'career',FOREIGN_POOL_SIZE);
    next.specialPlayers=Array.isArray(next.specialPlayers)?next.specialPlayers.map(player=>({...player})):[];
    if(!plan || next.windows.some(item=>item.id===plan.id) || (next.appliedWindowIds||[]).includes(plan.id)) return next;
    next.windows.push(plan);
    (plan.operations||[]).forEach(operation=>{
      if(operation.type==='internal' && operation.playerId){
        next.playerClubOverrides[operation.playerId]=operation.toClub;
      }else if(operation.type==='abroad' && operation.playerId){
        delete next.playerClubOverrides[operation.playerId];
        if(!next.abroadPlayerIds.includes(operation.playerId)) next.abroadPlayerIds.push(operation.playerId);
        // Anche un giocatore originariamente arrivato dal pool estero può
        // lasciare successivamente la Serie A: aggiorniamo il pool persistente
        // per evitare che venga rimaterializzato come ancora presente.
        const foreignIndex=next.foreignPool.findIndex(player=>String(player.id)===String(operation.playerId));
        if(foreignIndex>=0){
          next.foreignPool[foreignIndex]={
            ...next.foreignPool[foreignIndex],
            marketStatus:'abroad',hidden:true,club:'estero',
            lastSerieAClub:String(operation.fromClub||next.foreignPool[foreignIndex].club||'')
          };
        }
        const specialIndex=next.specialPlayers.findIndex(player=>String(player.id)===String(operation.playerId));
        if(specialIndex>=0) next.specialPlayers[specialIndex]={...next.specialPlayers[specialIndex],marketStatus:'abroad',hidden:true,club:'estero',lastSerieAClub:String(operation.fromClub||'')};
      }else if(operation.type==='arrival' && operation.playerId){
        next.playerClubOverrides[operation.playerId]=operation.toClub;
        if(!next.incomingPlayerIds.includes(operation.playerId)) next.incomingPlayerIds.push(operation.playerId);
        const poolIndex=next.foreignPool.findIndex(player=>String(player.id)===String(operation.playerId));
        if(poolIndex>=0){
          next.foreignPool[poolIndex]={
            ...next.foreignPool[poolIndex],
            marketStatus:'serie_a',hidden:false,club:String(operation.toClub),
            arrivedWindowId:plan.id,arrivedWindowType:plan.windowType
          };
        }
        const specialIndex=next.specialPlayers.findIndex(player=>String(player.id)===String(operation.playerId));
        if(specialIndex>=0) next.specialPlayers[specialIndex]={...next.specialPlayers[specialIndex],marketStatus:'serie_a',hidden:false,club:String(operation.toClub),arrivedWindowId:plan.id,arrivedWindowType:plan.windowType};
      }
      next.history.push({...operation,windowId:plan.id,windowType:plan.windowType});
    });
    return compactMarketState(next);
  }


  function latestHistoryByPlayer(marketState){
    const map=new Map();
    (marketState?.history||[]).forEach(operation=>{
      if(operation?.playerId) map.set(String(operation.playerId),operation);
    });
    return map;
  }

  function materializeWorldPlayers(basePlayers=[],marketState={}){
    const overrides=marketState?.playerClubOverrides||{};
    const abroad=new Set((marketState?.abroadPlayerIds||[]).map(String));
    const latest=latestHistoryByPlayer(marketState);
    const all=[];
    const seen=new Set();

    (basePlayers||[]).forEach(source=>{
      if(!source?.id) return;
      const id=String(source.id);
      const last=latest.get(id);
      const originalClub=String(source.originalClub||source.club||'');
      const isAbroad=abroad.has(id);
      const overridden=overrides[id];
      const player={
        ...source,
        id,
        originalClub,
        club:isAbroad?'estero':String(overridden||source.club||''),
        marketStatus:isAbroad?'abroad':'serie_a',
        hidden:isAbroad,
        lastSerieAClub:isAbroad?String(last?.fromClub||overridden||source.club||''):undefined
      };
      all.push(player); seen.add(id);
    });

    [...(marketState?.foreignPool||[]),...(marketState?.specialPlayers||[])].forEach(source=>{
      if(!source?.id || source.marketStatus!=='serie_a' || !source.club || source.club==='estero') return;
      const id=String(source.id);
      if(abroad.has(id)) return;
      if(seen.has(id)) return;
      all.push({
        ...source,
        id,
        roleLabel:source.roleLabel||({P:'Portiere',D:'Difensore',C:'Centrocampista',A:'Attaccante'}[source.role]||source.role),
        originalClub:source.originalClub||source.originClub||'estero',
        marketStatus:'serie_a',hidden:false,club:String(source.club),incoming:true
      });
      seen.add(id);
    });

    const activePlayers=all.filter(player=>player.marketStatus==='serie_a' && player.club && player.club!=='estero' && !player.hidden);
    const abroadPlayers=all.filter(player=>player.marketStatus==='abroad');
    const incomingPlayers=activePlayers.filter(player=>player.incoming || String(player.id).startsWith('foreign-'));
    return {allPlayers:all,activePlayers,abroadPlayers,incomingPlayers};
  }

  function bestRolePlayers(roster,role,count){
    return (roster||[]).filter(player=>player.role===role).slice().sort((a,b)=>Number(b.ovr||0)-Number(a.ovr||0)).slice(0,count);
  }

  function clubWorldStrength(roster){
    const shape={P:1,D:4,C:3,A:3};
    const xi=[];
    VALID_ROLES.forEach(role=>xi.push(...bestRolePlayers(roster,role,shape[role])));
    if(xi.length<11){
      const used=new Set(xi.map(player=>String(player.id)));
      xi.push(...(roster||[]).filter(player=>!used.has(String(player.id))).slice().sort((a,b)=>Number(b.ovr||0)-Number(a.ovr||0)).slice(0,11-xi.length));
    }
    return xi.length?Number(average(xi.map(player=>Number(player.ovr||60))).toFixed(2)):0;
  }

  function buildClubWorldMetrics(players=[],clubs=[]){
    const rosters=rosterMap(players,clubs);
    return Object.fromEntries((clubs||[]).map(club=>{
      const roster=rosters.get(String(club.id))||[];
      const roleCounts=Object.fromEntries(VALID_ROLES.map(role=>[role,roleCount(roster,role)]));
      const roleOvr=Object.fromEntries(VALID_ROLES.map(role=>[role,Number(roleAverageOvr(roster,role).toFixed(2))]));
      return [String(club.id),{
        rosterSize:roster.length,
        strength:clubWorldStrength(roster),
        roleCounts,roleOvr
      }];
    }));
  }

  window.FantaTransferEngine=Object.freeze({
    WINDOW_CONFIG,ROLE_FLOOR,FOREIGN_POOL_SIZE,createMarketState,generateForeignPool,foreignPoolSummary,planWindow,applyPlan,compactMarketState,
    materializeWorldPlayers,buildClubWorldMetrics,
    _test:Object.freeze({hash01,weightedTop,arrivalClubRoleOptions,rawPlayerValue,roleNeedScore,clubProfiles,leagueRoleBenchmarks,foreignOvrProfile,foreignPotential,foreignEconomy,clubWorldStrength,roleCoreAverageOvr,destinationQualityFloor,destinationScore})
  });
})();
