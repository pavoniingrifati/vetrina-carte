window.FANTABALLA_SEASON_CONFIG=Object.freeze({
 mode:'weekly-pisa',
 storage:{
  saveBase:'fantaballa_sfida_settimana_pisa_v1',
  legacySaveKeys:[],
  activeSlotKey:'fantaballa_sfida_settimana_pisa_active_slot',
  teamNameKey:'fantaballa_sfida_settimana_pisa_team_name',
  coachNameKey:'fantaballa_sfida_settimana_pisa_coach_name',
  paletteKey:'fantaballa_sfida_settimana_pisa_palette'
 },
 user:{
  teamId:'weekly-pisa-xi',
  freshClubId:'pisa',
  normalizedClubFallback:'pisa',
  defaultTeamName:'Pisa',
  fallbackClub:{id:'pisa',name:'Pisa',shortName:'PIS',colorClub:{primary:'#1565C0',secondary:'#111111',accent:'#FFFFFF',text:'#FFFFFF'}}
 },
 data:{
  primaryPlayers:'data/giocatori-real.json',
  primaryClubs:'data/club-weekly-pisa.json',
  secondaryPlayers:'data/giocatori-real.json',
  secondaryClubs:'data/club-weekly-pisa.json',
  commentary:'data/cronaca-gol.json',
  variants:{
   'serie-a':{id:'serie-a',label:'Tricolore col Pisa!',players:'data/giocatori-real.json',clubs:'data/club-weekly-pisa.json',playerCount:455,description:'Sfida della settimana con il Pisa e la Serie A 2025/26.'},
   legend:{id:'serie-a',label:'Tricolore col Pisa!',players:'data/giocatori-real.json',clubs:'data/club-weekly-pisa.json',playerCount:455,description:'Sfida della settimana con il Pisa e la Serie A 2025/26.'}
  }
 },
 validation:{
  minimumClubCount:20,
  minimumClubMessage:'Sono presenti soltanto {count} club: ne servono 20 per la Sfida della settimana.',
  expectedClubCount:20,
  expectedClubMessage:'Sono presenti {count} club invece dei 20 previsti.',
  excludeClubId:'pisa',
  minimumRosterSize:14,
  warningRosterUnder:0
 },
 labels:{
  competitionName:'Tricolore col Pisa!',
  packKicker:'Rosa completa del Pisa'
 },
 submission:{
  prefix:'sfida_settimana_pisa',
  standardLabel:'Sfida della settimana',
  chaosLabel:'Sfida della settimana · Caos',
  standardType:'sfida_settimana',
  chaosType:'sfida_settimana',
  allowAnyFinish:true,
  buttonText:'Invia risultato',
  successText:'Risultato inviato alla Sfida della settimana'
 },
 weeklyChallenge:{
  enabled:true,
  clubId:'pisa',
  fixedTeamName:'Pisa',
  selectionCount:14,
  leaderboardName:'Sfida della settimana',
  leaderboardUrl:'sfida-settimana.html',
  rewardText:'I primi 10 classificati ricevono un +2 OVR al proprio giocatore.'
 },
 events:{
  commonCatalog:'data/events/events-common.json',
  modeCatalog:'data/events/events-real.json',
  excludedAutoEventTitles:['Sostegno degli abbonati'],
  excludedDecisionIds:['whatsapp-pubblicato','cuggino-influencer','tiktok-boomer','ma-che-mollo']
 }
});
