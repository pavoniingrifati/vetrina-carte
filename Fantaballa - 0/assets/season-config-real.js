window.FANTABALLA_SEASON_CONFIG=Object.freeze({
 mode:'real',
 storage:{
  saveBase:'fantaballa_campionato_real_2026_27_v1',
  legacySaveKeys:[],
  activeSlotKey:'fantaballa_campionato_real_active_slot',
  teamNameKey:'fantaballa_campionato_real_team_name',
  coachNameKey:'fantaballa_campionato_real_coach_name',
  paletteKey:'fantaballa_real_team_palette'
 },
 user:{
  teamId:'fantaballa-real-xi',
  freshClubId:'fantaballa-real',
  normalizedClubFallback:'fantaballa-fc',
  defaultTeamName:'Fantaballa REAL',
  fallbackClub:{id:'fantaballa-real',name:'Fantaballa REAL',shortName:'REAL',colorClub:{primary:'#173A61',secondary:'#F2C84B',accent:'#E84A3A',text:'#FFFFFF'}}
 },
 data:{
  primaryPlayers:'data/giocatori-real.json?v=f1935b487f74',
  primaryClubs:'data/club-real.json?v=5fb25c7dcb21',
  secondaryPlayers:'data/giocatori.json?v=4660acc7579f',
  secondaryClubs:'data/club.json?v=1fd1a1a16d68',
  commentary:'data/cronaca-gol.json?v=2c486bc8c395',
  variants:{
   'serie-a':{id:'serie-a',label:'Serie A',players:'data/giocatori-real.json?v=f1935b487f74',clubs:'data/club-real.json?v=5fb25c7dcb21',playerCount:494,description:'I club e i calciatori della Serie A 2026/2027.'},
   legend:{id:'legend',label:'Legend',players:'data/storico/giocatori-storici.json?v=4ea5df59d634',clubs:'data/storico/club-storiche.json?v=eb3557845d3a',playerCount:796,description:'Quaranta squadre storiche italiane e internazionali. Ogni run seleziona casualmente 19 avversarie, mentre il draft usa l’intero database.'}
  }
 },
 validation:{
  minimumClubCount:21,
  minimumClubMessage:'Sono presenti soltanto {count} club: servono la squadra utente e almeno 20 club reali.',
  expectedClubCount:21,
  expectedClubMessage:'Sono presenti {count} club invece dei 20 club reali più la squadra utente.',
  excludeClubId:'fantaballa-real',
  minimumRosterSize:14,
  warningRosterUnder:0
 },
 labels:{
  competitionName:'Fantacampionato del Ca***',
  packKicker:'Campionato REAL Pack'
 },
 submission:{
  prefix:'campionato_real',
  standardLabel:'Fantacampionato del Ca***',
  chaosLabel:'Modalità Caos REAL',
  standardType:'campionato_real',
  chaosType:'caos_real'
 },
 events:{
  commonCatalog:'data/events/events-common.json?v=b3e293a5bc8c',
  modeCatalog:'data/events/events-real.json?v=b700642af15a',
  excludedAutoEventTitles:['Sostegno degli abbonati'],
  excludedDecisionIds:['whatsapp-pubblicato','cuggino-influencer','tiktok-boomer','ma-che-mollo']
 }
});
