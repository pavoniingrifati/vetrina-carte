'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/domains/social-controller.js'),'utf8'),window={};
vm.runInNewContext(source,{window});
const player={id:'p1',name:'Mario'},season={started:true,currentMatchday:1},runtime={state:{season},managerById:()=>({roster:[player]}),ensureSeasonState:()=>season,playerFormMetrics:()=>({score:0}),clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),saveState:()=>{},renderLeagueSocialScreen:()=>{},showToast:()=>{}};
let reactionRoll=.6,blockRoll=.1,spamRoll=.99,replyRoll=0,profileRoll=0;
runtime.careerHash=key=>key.startsWith('social-personality')?profileRoll:key.startsWith('social-immediate-block')?blockRoll:key.startsWith('social-block')?spamRoll:key.startsWith('social-reaction')?reactionRoll:replyRoll;
const api=window.FantaDomains['social-controller'].create(runtime);Object.assign(runtime,api);runtime.renderLeagueSocialScreen=()=>{};
const bank=JSON.parse(source.match(/const socialReplies=([\s\S]*?);\n\n  function socialOwnedPlayers/)[1]);
assert.equal(Object.values(bank).flatMap(profile=>Object.values(profile).flat()).length,128);
for(const profile of Object.values(bank))for(const pool of Object.values(profile)){assert.equal(pool.length,8);assert.equal(new Set(pool).size,8);}
assert.equal(api.socialMessageTone('Bravo, ma sei un idiota'),'hostile');
assert.equal(api.socialMessageTone('Dai, sei scarso'),'hostile');
assert.equal(api.socialMessageTone('Sei INUTILE!'),'hostile');
let conv=api.socialConversation(player.id);
conv.messages=[{sender:'user',day:1,text:'Devi reagire'}];conv.totalMessages=1;
let r=api.socialReactionData(player,'Devi reagire',conv,1);assert.equal(r.outcome,'blocked');assert.equal(r.voteDelta,-.25);
blockRoll=.13;r=api.socialReactionData(player,'Devi reagire',conv,1);assert.equal(r.outcome,'bad');
blockRoll=.39;r=api.socialReactionData(player,'Sei scarso',conv,1);assert.equal(r.outcome,'blocked');
blockRoll=.41;r=api.socialReactionData(player,'Sei scarso',conv,1);assert.equal(r.outcome,'bad');
reactionRoll=.45;profileRoll=.3;blockRoll=.17;r=api.socialReactionData(player,'Devi reagire',conv,1);assert.equal(r.outcome,'blocked');
profileRoll=.9;blockRoll=.15;r=api.socialReactionData(player,'Devi reagire',conv,1);assert.equal(r.outcome,'blocked');
profileRoll=0;conv.relationship=20;blockRoll=.21;reactionRoll=.6;r=api.socialReactionData(player,'Devi reagire',conv,1);assert.equal(r.outcome,'blocked');conv.relationship=50;
reactionRoll=0;blockRoll=0;r=api.socialReactionData(player,'Bravo',conv,1);assert.equal(r.outcome,'good');
r=api.socialReactionData(player,'Sei scarso',conv,1);assert.equal(r.outcome,'blocked');
reactionRoll=.99;r=api.socialReactionData(player,'Ricevuto',conv,1);assert.equal(r.outcome,'neutral');
// Exact first-message flow: blocked flag, system notice, saved motivation and no further messages.
delete season.social;reactionRoll=.6;blockRoll=0;
api.socialSendMessage(player.id,'Sei scarso');conv=api.socialConversation(player.id);
assert.equal(conv.blocked,true);assert.equal(conv.messages.length,3);assert.equal(conv.messages[2].sender,'system');
assert.equal(api.socialMotivationForPlayer(player.id,1).voteDelta,-.25);
api.socialSendMessage(player.id,'Scusa');assert.equal(conv.messages.length,3);
// Later blocks cannot overwrite or stack the first daily effect.
delete season.social;reactionRoll=0;blockRoll=.99;api.socialSendMessage(player.id,'Bravo');
reactionRoll=.6;blockRoll=0;api.socialSendMessage(player.id,'Sei inutile');
assert.equal(api.socialConversation(player.id).blocked,true);assert.equal(api.socialMotivationForPlayer(player.id,1).voteDelta,.25);
// Spam still blocks, independently of the immediate negative-reaction check.
conv={messages:[1,2,3].map(()=>({sender:'user',day:1})),relationship:50,totalMessages:3};spamRoll=0;reactionRoll=0;
assert.equal(api.socialReactionData(player,'Bravo',conv,1).outcome,'blocked');spamRoll=.99;
// Personality bank used; recent replies excluded, including legacy conversations without metadata.
delete season.social;conv=api.socialConversation(player.id);reactionRoll=0;
for(const [id,roll] of [['ambitious',0],['sensitive',.3],['proud',.6],['reserved',.9]]){
 profileRoll=roll;conv.messages=[];
 for(const outcome of ['good','neutral','bad','blocked']){
  const reaction={outcome,tone:'neutral',profile:api.socialPersonality(player)};
  const first=api.socialReplyText(player,reaction);assert(bank[id][outcome].includes(first));
  conv.messages=[{sender:'player',text:first}];assert.notEqual(api.socialReplyText(player,reaction),first);conv.messages=[];
 }
}
profileRoll=0;let text=api.socialReplyText(player,{outcome:'bad',tone:'hostile'});assert(/insult|rispetto|offender/.test(text));
text=api.socialReplyText(player,{outcome:'bad',tone:'praise'});assert(/complimento|aspettative|incoraggi/.test(text));
console.log('OK: 128 personality replies, tone context, no immediate repetition, first-message blocks, probability thresholds, spam and one daily effect.');
