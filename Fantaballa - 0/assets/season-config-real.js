window.FANTABALLA_SEASON_CONFIG=Object.freeze({
 mode:'real',
 storage:{
  saveBase:'fantaballa_campionato_real_v1',
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
  primaryPlayers:'data/giocatori-real.json',
  primaryClubs:'data/club-real.json',
  secondaryPlayers:'data/giocatori.json',
  secondaryClubs:'data/club.json',
  commentary:'data/cronaca-gol.json'
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
  excludedAutoEventTitles:['Sostegno degli abbonati'],
  excludedDecisionIds:['whatsapp-pubblicato','cuggino-influencer','tiktok-boomer','ma-che-mollo']
 }
});
