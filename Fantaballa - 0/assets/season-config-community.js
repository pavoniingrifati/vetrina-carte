window.FANTABALLA_SEASON_CONFIG=Object.freeze({
 mode:'community',
 storage:{
  saveBase:'fantaballa_campionato_v7',
  legacySaveKeys:['fantaballa_campionato_v1'],
  activeSlotKey:'fantaballa_campionato_active_slot',
  teamNameKey:'fantaballa_campionato_team_name',
  coachNameKey:'fantaballa_campionato_coach_name',
  paletteKey:'fantaballa_campionato_team_palette'
 },
 user:{
  teamId:'fantaballa-xi',
  freshClubId:'fantaballa-fc',
  normalizedClubFallback:'fantaballa-fc',
  defaultTeamName:'Fantaballa FC',
  fallbackClub:{id:'fantaballa-fc',name:'Fantaballa FC',shortName:'FAN',colorClub:{primary:'#1769AA',secondary:'#FFFFFF',accent:'#E4C84E',text:'#FFFFFF'}}
 },
 data:{
  primaryPlayers:'data/giocatori.json?v=4660acc7579f',
  primaryClubs:'data/club.json?v=1fd1a1a16d68',
  secondaryPlayers:'data/giocatori-real.json?v=f1935b487f74',
  secondaryClubs:'data/club-real.json?v=5fb25c7dcb21',
  commentary:'data/cronaca-gol.json?v=2c486bc8c395'
 },
 validation:{
  minimumClubCount:20,
  minimumClubMessage:'Sono presenti soltanto {count} club: ne servono almeno 20.',
  expectedClubCount:37,
  expectedClubMessage:'Sono presenti {count} club invece dei 37 configurati.',
  excludeClubId:'',
  minimumRosterSize:11,
  warningRosterUnder:14
 },
 labels:{
  competitionName:'Campionato del Ca***',
  packKicker:'Campionato Pack'
 },
 submission:{
  prefix:'campionato',
  standardLabel:'Campionato del Ca***',
  chaosLabel:'Modalità Caos',
  standardType:'campionato',
  chaosType:'caos'
 },
 events:{
  commonCatalog:'data/events/events-common.json?v=b3e293a5bc8c',
  modeCatalog:'data/events/events-community.json?v=75428ba7000b',
  excludedAutoEventTitles:[],
  excludedDecisionIds:[]
 }
});
