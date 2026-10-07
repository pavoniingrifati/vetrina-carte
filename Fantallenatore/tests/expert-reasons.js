'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const app=require('./helpers/production-source').readProductionSource();
const start=app.indexOf('  function expertReasonParagraphs(');
const end=app.indexOf('  function closeExpertReason(',start);
assert(start>=0&&end>start);
const context={INTUITION_EXPERTS:{intuitivo:{},visionario:{},sibilla:{},glitch:{}}};
vm.runInNewContext(app.slice(start,end),context);
const player={name:'Rossi'};
const analysis={reasons:['è in buona forma'],starterPct:72,matchup:{key:'favorable'},fixture:{opponentName:'Napoli',home:true}};
for(const mode of ['form','attack','data']){
  const copy=context.expertReasonParagraphs({id:'professore',mode},player,analysis,null).join(' ');
  assert(copy.includes('Rossi')&&copy.includes('Napoli'),`Motivazione ${mode} contestuale`);
  const pro=context.expertReasonParagraphs({id:'professore',mode},player,analysis,null,true).join(' ');
  assert(pro.includes('Rossi')&&pro!==copy&&/più (convinto|sicuro)/.test(pro),`Tono Esperti Pro ${mode}`);
}
for(const [id,kind] of [['intuitivo','starter'],['visionario','goal'],['sibilla','vote'],['glitch','assist']]){
  const copy=context.expertReasonParagraphs({id},player,null,{kind}).join(' ');
  assert(copy.includes('posso anche sbagliarmi'),`Previsione ${id} fallibile`);
  assert(!copy.includes('boost')&&!copy.includes('Napoli'),`Nessun dato nascosto svelato da ${id}`);
  const pro=context.expertReasonParagraphs({id},player,null,{kind},true).join(' ');
  assert(pro!==copy&&pro.includes('più')&&pro.includes('posso ancora sbagliarmi'),`Tono sicuro ma fallibile di ${id}`);
  assert(!pro.includes('boost'),`Esperti Pro non svela il boost di ${id}`);
}
console.log('OK: motivazioni contestuali, intuizioni fallibili e nessun boost rivelato.');

context.state={season:{currentMatchday:1},career:{seasonNumber:1}};
for(let variant=0;variant<3;variant++){
  context.careerHash=()=>variant/3;
  for(const kind of ['goal','assist']){
    const normal=context.expertReasonParagraphs({id:'visionario'},player,null,{kind});
    const pro=context.expertReasonParagraphs({id:'visionario'},player,null,{kind},true);
    assert(normal.length===3&&normal[0].includes(player.name));
    assert(normal[1].includes(kind==='goal'?'gol':'assist'));
    assert(normal.join(' ')!==pro.join(' '));
    assert(normal.every(text=>text.length<260),'Testi brevi per la storia verticale');
    assert.deepStrictEqual(normal,context.expertReasonParagraphs({id:'visionario'},player,null,{kind}));
  }
}
console.log('OK: Visionario, tre varianti gol/assist, Pro e testi stabili e brevi.');
for(let variant=0;variant<3;variant++){
  context.careerHash=()=>variant/3;
  for(const kind of ['starter','vote']){
    const normal=context.expertReasonParagraphs({id:'intuitivo'},player,null,{kind});
    const pro=context.expertReasonParagraphs({id:'intuitivo'},player,null,{kind},true);
    assert(normal.length===3&&normal[0].includes(player.name));
    assert((kind==='starter'?/spazio|minuti/:/voto|rendimento/).test(normal[1]));
    assert(normal.every(text=>text.length<260));
    assert(normal.join(' ')!==pro.join(' '));
    assert.deepStrictEqual(normal,context.expertReasonParagraphs({id:'intuitivo'},player,null,{kind}));
  }
}
console.log('OK: Intuitivo, varianti spazio/voto, tono Pro e testi brevi.');
