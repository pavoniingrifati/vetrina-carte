/** Fantaballa FC: backend indipendente dal sito Champions. */
function inizializzaFantaballaFC() {
  const props=PropertiesService.getScriptProperties();
  let id=props.getProperty('SPREADSHEET_ID');
  const book=id?SpreadsheetApp.openById(id):SpreadsheetApp.create('Fantaballa FC - Super Lega 2025-26');
  props.setProperty('SPREADSHEET_ID',book.getId());
  let sheet=book.getSheetByName('Rose');if(!sheet)sheet=book.insertSheet('Rose');
  if(sheet.getLastRow()===0)sheet.appendRow(['Ricevuta','Squadra','Modulo','Crediti','Titolari','Panchina','Dati JSON']);
  Logger.log(book.getUrl());return book.getUrl();
}
function testoFoglio(value){const s=String(value??'');return /^[=+@-]/.test(s)?"'"+s:s;}
function verificaRosa(p){
  if(p.progetto!=='fantaballafc')throw Error('Progetto errato');
  if(!String(p.squadra||'').trim()||String(p.squadra).length>120)throw Error('Nome squadra non valido');
  const moduli={'4-4-2':{P:1,D:4,C:4,A:2},'4-3-3':{P:1,D:4,C:3,A:3},'3-4-3':{P:1,D:3,C:4,A:3},'3-5-2':{P:1,D:3,C:5,A:2}};
  const required=moduli[p.modulo];if(!required)throw Error('Modulo non valido');
  if(!Array.isArray(p.titolari)||p.titolari.length!==11||!Array.isArray(p.panchina)||p.panchina.length!==5)throw Error('Servono 11 titolari e 5 riserve');
  const seen=new Set();let cost=0;const used={P:0,D:0,C:0,A:0};
  for(const [i,x] of [...p.titolari,...p.panchina].entries()){
    const player=CATALOGO[x.key];if(!player||seen.has(x.key))throw Error('Giocatore mancante o ripetuto');seen.add(x.key);
    const expected=i<11?x.ruolo:['P','D','C','A','ALL'][i-11];
    if((expected!=='ALL'&&player.role!==expected)||x.ruolo!==expected)throw Error('Ruolo non valido');
    if(i<11)used[player.role]++;
    cost+=player.cost;x.giocatore=player.name;x.club=player.club;x.nazione=player.club;x.costo=player.cost;
  }
  if(Object.keys(required).some(k=>used[k]!==required[k])||cost>300)throw Error('Formazione o budget non valido');
  p.creditiUsati=cost;return p;
}
function doPost(e){
  let lock;
  try{
    if(!e||!e.postData||e.postData.contents.length>40000)throw Error('Richiesta non valida');
    const p=verificaRosa(JSON.parse(e.postData.contents));
    const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');if(!id)throw Error('Eseguire inizializzaFantaballaFC prima della pubblicazione');
    lock=LockService.getScriptLock();lock.waitLock(15000);
    const sheet=SpreadsheetApp.openById(id).getSheetByName('Rose');
    sheet.appendRow([new Date(),testoFoglio(p.squadra),p.modulo,p.creditiUsati,testoFoglio(p.titolari.map(x=>x.giocatore+' ('+x.club+')').join(' | ')),testoFoglio(p.panchina.map(x=>x.giocatore+' ('+x.club+')').join(' | ')),JSON.stringify(p)]);
    return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
  }catch(error){return ContentService.createTextOutput(JSON.stringify({ok:false,error:String(error.message)})).setMimeType(ContentService.MimeType.JSON);}
  finally{if(lock)lock.releaseLock();}
}
function doGet(){return ContentService.createTextOutput('Fantaballa FC: servizio invio rose.');}
