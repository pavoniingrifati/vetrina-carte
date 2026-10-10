/* Responsibility: social-controller. Runtime state and cross-domain callbacks are explicit live accessors. */
(() => {
  'use strict';
  function create($runtime){
    if(!$runtime) throw new TypeError('Runtime richiesto: social-controller');
  const socialReplies={
  "ambitious": {
    "good": [
      "Voglio fare la differenza, mister. Ci puoi contare.",
      "Messaggio ricevuto. Oggi voglio lasciare il segno.",
      "Mi hai dato una spinta in più. Andiamo a prendercela.",
      "Sono pronto a mettermi alla prova.",
      "Voglio essere decisivo per questa squadra.",
      "Darò tutto per ripagare la fiducia.",
      "Mi piace sapere che conti su di me.",
      "Ora ho ancora più voglia di scendere in campo."
    ],
    "neutral": [
      "Ricevuto. Pensiamo alla partita.",
      "Ho letto, mister. Ora torno al lavoro.",
      "Il mio obiettivo resta dare il massimo.",
      "Vediamo cosa dirà il campo.",
      "Tengo la testa sulla prossima gara.",
      "Ci sentiamo dopo la partita.",
      "Va bene. Mi concentro sulla prestazione.",
      "Il lavoro continua, mister."
    ],
    "bad": [
      "Questo messaggio non mi aiuta a concentrarmi.",
      "So cosa devo fare. Non serve ricordarmelo ogni volta.",
      "Preferirei parlarne faccia a faccia.",
      "Così mi passa la voglia di rispondere.",
      "Voglio pensare al campo, non a questa chat.",
      "Mi aspettavo un altro modo di parlarne.",
      "Lasciami lavorare con un po’ di serenità.",
      "Ho letto, ma questo tono non mi aiuta."
    ],
    "blocked": [
      "Chiudo qui la conversazione, mister.",
      "Non voglio altri messaggi. Ti blocco.",
      "Per me questa chat finisce qui.",
      "Preferisco interrompere i contatti qui.",
      "Basta così. Non mi scrivere più qui.",
      "Non voglio continuare. Bloccherò questo account.",
      "Parleremo al campo. Qui ti blocco.",
      "Ora chiudo la chat e ti blocco."
    ]
  },
  "sensitive": {
    "good": [
      "Sapere che credi in me mi aiuta davvero.",
      "Grazie mister. Mi sento un po’ più sereno.",
      "Avevo bisogno di sentirmi parte della squadra.",
      "Le tue parole mi hanno fatto bene.",
      "Cercherò di ripagarti sul campo.",
      "Grazie per avermi scritto, mister.",
      "Mi hai aiutato a ritrovare la concentrazione.",
      "Ora affronto la partita con più fiducia."
    ],
    "neutral": [
      "Ho letto, mister.",
      "Va bene. Provo a concentrarmi sulla partita.",
      "Grazie del messaggio. Ora torno ad allenarmi.",
      "Ne riparliamo con calma?",
      "Mi prendo un momento per concentrarmi.",
      "Ricevuto. Ci vediamo al campo.",
      "Ok, mister. Una cosa alla volta.",
      "Adesso penso alla prossima gara."
    ],
    "bad": [
      "Questo messaggio mi ha messo in difficoltà.",
      "Così mi sento ancora più sotto esame.",
      "Avrei preferito parlarne di persona.",
      "Non mi sento meglio dopo averlo letto.",
      "Mi serve un po’ di tranquillità.",
      "Mister, queste parole mi pesano.",
      "Non è facile rispondere a un messaggio così.",
      "Vorrei sentire più fiducia da parte tua."
    ],
    "blocked": [
      "Questa chat mi fa stare male. Ti blocco.",
      "Ho bisogno di tranquillità. Chiudo qui.",
      "Non voglio ricevere altri messaggi qui.",
      "Preferisco bloccare il contatto e fermarmi.",
      "Non riesco a continuare questa conversazione. Ti blocco.",
      "Basta, mister. Qui non ti risponderò più.",
      "Per stare tranquillo, interrompo questa chat.",
      "Adesso ti blocco. Ne parleremo di persona."
    ]
  },
  "proud": {
    "good": [
      "Fa piacere quando ti accorgi del mio lavoro.",
      "So cosa posso dare. Voglio fartelo vedere.",
      "Grazie mister. Voglio meritarmi questo spazio.",
      "Mi hai dato una motivazione in più.",
      "Voglio essere all’altezza della fiducia.",
      "Sono pronto a dimostrare quanto valgo.",
      "Mi fa piacere sentirmi importante per la squadra.",
      "Ora voglio rispondere con una grande prestazione."
    ],
    "neutral": [
      "Ricevuto, mister.",
      "Il campo parlerà per me.",
      "So qual è il mio compito.",
      "Adesso penso soltanto a giocare.",
      "Ne terrò conto.",
      "Ho letto. Ci vediamo alla partita.",
      "Continuo a lavorare come sempre.",
      "Va bene. Preferisco rispondere sul campo."
    ],
    "bad": [
      "Non mi piace essere trattato così.",
      "Mi aspettavo più rispetto in questa conversazione.",
      "Possiamo parlarne senza questo tono?",
      "Non penso di meritare un messaggio così.",
      "Conosco il mio valore. Questo non mi aiuta.",
      "Preferisco una discussione chiara, di persona.",
      "Non ho apprezzato queste parole.",
      "Mister, così il nostro rapporto non migliora."
    ],
    "blocked": [
      "Il rispetto viene prima. Qui ti blocco.",
      "Non accetto di continuare questa chat.",
      "Per me il discorso è chiuso. Ti blocco.",
      "Non voglio altri messaggi da questo account.",
      "Basta così. Qui non mi contatti più.",
      "Questa conversazione finisce adesso.",
      "Preferisco bloccarti e parlarne al campo.",
      "Non ho altro da aggiungere. Ti blocco."
    ]
  },
  "reserved": {
    "good": [
      "Grazie. Preferisco risponderti sul campo.",
      "Apprezzo il messaggio, mister.",
      "Ricevuto. Darò tutto.",
      "Grazie per la fiducia.",
      "Mi fa piacere. Ora mi concentro.",
      "Va bene, mister. Sono pronto.",
      "Poche parole: ci puoi contare.",
      "Grazie. Torno al lavoro con la testa giusta."
    ],
    "neutral": [
      "Ok, mister.",
      "Ricevuto.",
      "Ci vediamo al campo.",
      "Ho letto. Ora mi concentro.",
      "Va bene.",
      "Ne parliamo all’allenamento.",
      "Adesso penso alla gara.",
      "Messaggio letto, mister."
    ],
    "bad": [
      "Preferirei parlarne di persona.",
      "Questo messaggio non mi aiuta.",
      "Adesso ho bisogno di concentrarmi.",
      "Non mi piace questa conversazione.",
      "Lasciamo stare la chat per un po’.",
      "Ne parliamo domani all’allenamento?",
      "Ho letto. Preferisco fermarmi qui.",
      "Mi serve un po’ di spazio, mister."
    ],
    "blocked": [
      "Chiudo la chat. Ti blocco.",
      "Basta messaggi qui.",
      "Preferisco bloccare il contatto.",
      "Non continuerò questa conversazione. Ti blocco.",
      "Qui non mi scrivere più.",
      "Stop, mister. Ti blocco.",
      "Parliamone al campo. Questa chat è chiusa.",
      "Ho bisogno di spazio. Blocco questo account."
    ]
  }
};

  function socialOwnedPlayers(){
    const user=$runtime.managerById('user');
    return (user?.roster||[]).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'it'));
  }

  function socialHandle(player){
    const clean=String(player?.name||'giocatore')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.+|\.+$/g,'');
    return `@${clean||'giocatore'}`;
  }

  function socialPersonality(player){
    const roll=$runtime.careerHash(`social-personality|${player?.id}`);
    if(roll<.25) return {id:'ambitious',label:'AMBIZIOSO',desc:'Apprezza obiettivi chiari e pressione positiva.',pressure:.12,support:.02,praise:.04,spam:.02};
    if(roll<.50) return {id:'sensitive',label:'SENSIBILE',desc:'Reagisce bene alla fiducia, male alla pressione.',pressure:-.15,support:.14,praise:.07,spam:.07};
    if(roll<.75) return {id:'proud',label:'ORGOGLIOSO',desc:'Ama essere riconosciuto, sopporta poco le critiche.',pressure:-.06,support:.04,praise:.15,spam:.05};
    return {id:'reserved',label:'RISERVATO',desc:'Preferisce pochi messaggi e toni tranquilli.',pressure:-.04,support:.07,praise:.05,spam:.10};
  }

  function ensureSocialState(season=$runtime.state?.season){
    if(!season || !season.started) return null;
    if(!season.social || typeof season.social!=='object') season.social={conversations:{},motivationByDay:{},activity:[]};
    if(!season.social.conversations || typeof season.social.conversations!=='object') season.social.conversations={};
    if(!season.social.motivationByDay || typeof season.social.motivationByDay!=='object') season.social.motivationByDay={};
    if(!Array.isArray(season.social.activity)) season.social.activity=[];

    $runtime.socialOwnedPlayers().forEach(player=>{
      const id=String(player.id);
      const conv=season.social.conversations[id] ||= {
        playerId:id,followed:true,blocked:false,relationship:50,totalMessages:0,lastMessageDay:0,lastReaction:'none',messages:[]
      };
      conv.followed=true;
      if(!Array.isArray(conv.messages)) conv.messages=[];
      if(!Number.isFinite(Number(conv.relationship))) conv.relationship=50;
      if(!Number.isFinite(Number(conv.totalMessages))) conv.totalMessages=0;
      if(conv.blocked===undefined) conv.blocked=false;
    });
    return season.social;
  }

  function socialConversation(playerId,season=$runtime.state?.season){
    const social=$runtime.ensureSocialState(season);
    if(!social) return null;
    return social.conversations[String(playerId)]||null;
  }

  function socialMotivationForPlayer(playerId,day){
    return $runtime.state?.season?.social?.motivationByDay?.[String(day)]?.[String(playerId)]||null;
  }

  function socialRelationLabel(value){
    const n=Number(value||0);
    if(n>=72) return 'RAPPORTO OTTIMO';
    if(n>=58) return 'RAPPORTO BUONO';
    if(n>=42) return 'RAPPORTO NORMALE';
    if(n>=25) return 'RAPPORTO TESO';
    return 'RAPPORTO DIFFICILE';
  }

  function socialMessageTone(text){
    const norm=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const has=(words)=>words.some(w=>norm.includes(w));
    if(/\b(scarso|scarsa|vergogna|inutile|ridicolo|ridicola|disastro|idiota|incapace|stupido|stupida|cretino|cretina|fai schifo|vaffanculo)\b/.test(norm)) return 'hostile';
    if(has(['grande','bravo','complimenti','orgoglioso','continua cosi','ottimo','super','fenomeno'])) return 'praise';
    if(has(['credo in te','fiducia','testa alta','tranquillo','forza','dai','sono con te','puoi farcela'])) return 'support';
    if(has(['reazione','devi','pretendo','sveglia','voglio di piu','dimostrami','non basta','panchina'])) return 'pressure';
    return 'neutral';
  }

  function socialReactionData(player,text,conv,day){
    const profile=$runtime.socialPersonality(player);
    const tone=$runtime.socialMessageTone(text);
    const outgoing=(conv.messages||[]).filter(m=>m.sender==='user');
    const sameDay=outgoing.filter(m=>Number(m.day)===Number(day)).length;
    const recent=outgoing.filter(m=>Number(m.day)>=Number(day)-2).length;
    const form=$runtime.playerFormMetrics(player.id);
    const relation=Number(conv.relationship||50);

    let toneGood=0;
    let toneBad=0;
    if(tone==='support') toneGood+=profile.support;
    else if(tone==='praise') toneGood+=profile.praise;
    else if(tone==='pressure') { toneGood+=profile.pressure; toneBad+=profile.pressure<0?Math.abs(profile.pressure)*.72:0; }
    else if(tone==='hostile') { toneGood-=.22; toneBad+=.32; }

    if(form.score<-.45 && tone==='support') toneGood+=.08;
    if(form.score<-.45 && tone==='pressure') toneBad+=.07;
    if(form.score>.45 && tone==='praise') toneGood+=.05;

    const spamPenalty=Math.max(0,sameDay-1)*.15 + Math.max(0,recent-4)*.055;
    const relationBias=$runtime.clamp((relation-50)/100,-.20,.20);

    let blockChance=0;
    if(sameDay>=3) blockChance=.08 + (sameDay-3)*.22 + profile.spam;
    if(recent>=7) blockChance+=.10;
    if(relation<28) blockChance+=.10;
    if(tone==='hostile') blockChance+=.12;
    blockChance=$runtime.clamp(blockChance,0,.88);

    const signature=`${day}|${player.id}|${conv.totalMessages+1}|${String(text).slice(0,64)}`;
    if(sameDay>=3 && $runtime.careerHash(`social-block|${signature}`)<blockChance){
      return {outcome:'blocked',tone,profile,voteDelta:-.25,relationshipDelta:-18};
    }

    let goodChance=$runtime.clamp(.40+toneGood+relationBias*.45-spamPenalty*.60,.10,.76);
    let badChance=$runtime.clamp(.22+toneBad-relationBias*.22+spamPenalty*.72,.10,.68);
    if(tone==='hostile') { goodChance=0; badChance=Math.max(badChance,.80); }
    if(goodChance+badChance>.88){
      const scale=.88/(goodChance+badChance);
      goodChance*=scale; badChance*=scale;
    }

    const roll=$runtime.careerHash(`social-reaction|${signature}`);
    if(roll<goodChance) return {outcome:'good',tone,profile,voteDelta:.25,relationshipDelta:6};
    if(roll<goodChance+badChance){
      // Conditional on a negative reaction: ordinary messages 12%, insults 40%.
      const immediateBlockChance=$runtime.clamp((tone==='hostile'?.40:.12)+(profile.id==='sensitive'?.06:profile.id==='reserved'?.04:0)+(relation<28?.10:0),0,.65);
      if($runtime.careerHash(`social-immediate-block|${signature}`)<immediateBlockChance){
        return {outcome:'blocked',tone,profile,voteDelta:-.25,relationshipDelta:-18};
      }
      return {outcome:'bad',tone,profile,voteDelta:-.25,relationshipDelta:-7};
    }
    return {outcome:'neutral',tone,profile,voteDelta:0,relationshipDelta:1};
  }

  function socialReplyText(player,reaction){
    const conv=$runtime.socialConversation(player.id);
    const day=$runtime.state?.season?.currentMatchday||1;
    const profile=reaction.profile||$runtime.socialPersonality(player);
    let pool=socialReplies[profile.id]?.[reaction.outcome]||socialReplies.reserved.neutral;
    if(reaction.tone==='hostile'){
      if(reaction.outcome==='blocked') pool=['Puoi criticarmi, ma non insultarmi. Ti blocco.','Non accetto questi insulti. Questa chat finisce qui.','Con questo tono non continuiamo. Ti blocco.','Non voglio ricevere altri insulti. Blocco il contatto.'];
      else if(reaction.outcome==='bad') pool=['Puoi criticare la mia partita, ma così mi manchi di rispetto.','Gli insulti non mi aiutano a giocare meglio.','Accetto una critica, non un insulto.','Mister, possiamo parlarne senza offenderci?'];
      else pool=['Ho letto. Ne parleremo di persona.','Preferisco non rispondere a questo tono.','Adesso penso al campo.','Non voglio discutere qui.'];
    }else if(reaction.outcome==='bad'){
      if(reaction.tone==='praise') pool=['Grazie, ma oggi faccio fatica a prendere bene anche un complimento.','Capisco il complimento, ma in questo momento mi mette sotto pressione.','Apprezzo l’intenzione. Preferisco concentrarmi senza aspettative.','So che volevi incoraggiarmi, ma oggi mi sento teso.'];
      else if(reaction.tone==='support') pool=['So che vuoi aiutarmi, ma adesso ho bisogno di un po’ di spazio.','Capisco l’intenzione, mister. Oggi però faccio fatica.','Grazie per la fiducia, ma sento comunque troppa pressione.','So che sei con me. Preferirei parlarne al campo.'];
    }
    const outgoing=(conv?.messages||[]).filter(m=>m.sender==='user'&&Number(m.day)===Number(day)).length;
    if(outgoing>=3&&reaction.outcome==='bad') pool=['Mister, ho letto. Adesso lasciami concentrarmi.','Tutti questi messaggi mi stanno distraendo.','Possiamo fermarci qui per oggi?','Mi serve una pausa da questa chat.'];
    const recent=(conv?.messages||[]).filter(m=>m.sender==='player').slice(-4).map(m=>m.text);
    let candidates=pool.filter(text=>!recent.includes(text));
    if(!candidates.length)candidates=pool.filter(text=>text!==recent[recent.length-1]);
    if(!candidates.length)candidates=pool;
    const key=Math.min(candidates.length-1,Math.floor($runtime.careerHash(`social-reply|${player.id}|${day}|${conv?.totalMessages||0}`)*candidates.length));
    return candidates[key];
  }

  function socialRecordMotivation(player,reaction,day,messageId){
    const season=$runtime.state?.season;
    const social=$runtime.ensureSocialState(season);
    if(!social) return {applied:false,effect:null};
    const dayKey=String(day), id=String(player.id);
    social.motivationByDay[dayKey] ||= {};
    if(social.motivationByDay[dayKey][id]) return {applied:false,effect:social.motivationByDay[dayKey][id]};

    const effect={
      playerId:id,day:Number(day),outcome:reaction.outcome,
      voteDelta:Number(reaction.voteDelta||0),tone:reaction.tone,
      messageId,createdAt:Date.now()
    };
    social.motivationByDay[dayKey][id]=effect;
    return {applied:true,effect};
  }

  function socialSendMessage(playerId,text){
    const season=$runtime.ensureSeasonState();
    const player=$runtime.socialOwnedPlayers().find(p=>String(p.id)===String(playerId));
    const conv=$runtime.socialConversation(playerId,season);
    const clean=String(text||'').trim().slice(0,180);
    if(!season || !player || !conv || !clean) return;
    if(conv.blocked){
      $runtime.showToast(`${player.name} ti ha bloccato: non puoi più inviargli messaggi.`,true);
      return;
    }

    const day=Number(season.currentMatchday||1);
    const messageId=`dm_${day}_${player.id}_${Date.now()}`;
    const outgoing={id:messageId,sender:'user',text:clean,day,createdAt:Date.now()};
    conv.messages.push(outgoing);
    conv.totalMessages=Number(conv.totalMessages||0)+1;
    conv.lastMessageDay=day;

    const reaction=$runtime.socialReactionData(player,clean,conv,day);
    conv.relationship=$runtime.clamp(Number(conv.relationship||50)+Number(reaction.relationshipDelta||0),0,100);
    conv.lastReaction=reaction.outcome;

    const motivation=$runtime.socialRecordMotivation(player,reaction,day,messageId);
    const reply=$runtime.socialReplyText(player,reaction);
    conv.messages.push({
      id:`reply_${messageId}`,sender:'player',text:reply,day,createdAt:Date.now()+1,
      reaction:reaction.outcome
    });

    if(reaction.outcome==='blocked'){
      conv.blocked=true;
      conv.messages.push({
        id:`blocked_${messageId}`,sender:'system',
        text:'Non puoi più inviare messaggi a questo account per il resto della stagione.',
        day,createdAt:Date.now()+2,reaction:'blocked'
      });
    }

    conv.messages=conv.messages.slice(-80);
    season.social.activity.push({
      id:messageId,playerId:String(player.id),day,outcome:reaction.outcome,
      applied:motivation.applied,voteDelta:motivation.applied?Number(reaction.voteDelta||0):0,
      createdAt:Date.now()
    });
    season.social.activity=season.social.activity.slice(-120);

    $runtime.saveState();
    $runtime.renderLeagueSocialScreen();

    const feedback = reaction.outcome==='good'
      ? `${player.name} ha reagito bene al messaggio.`
      : reaction.outcome==='bad'
        ? `${player.name} non ha reagito bene.`
        : reaction.outcome==='blocked'
          ? `${player.name} ti ha bloccato.`
          : `${player.name} ha risposto.`;
    $runtime.showToast(feedback,reaction.outcome==='bad'||reaction.outcome==='blocked');
  }

  function socialPlayerAvatarHtml(player,size='normal'){
    return `<span class="social-player-avatar ${size}">${$runtime.playerAvatarMarkup(player,player.name)}</span>`;
  }

  function socialConversationPreview(conv){
    const last=(conv?.messages||[]).slice(-1)[0];
    if(!last) return 'Invia il primo messaggio';
    if(last.sender==='system') return '🚫 Non puoi più scrivere';
    return `${last.sender==='user'?'Tu: ':''}${String(last.text||'').slice(0,46)}`;
  }

  function socialStoryHtml(player){
    const conv=$runtime.socialConversation(player.id);
    const effect=$runtime.socialMotivationForPlayer(player.id,$runtime.state?.season?.currentMatchday||1);
    const ring=conv?.blocked?'blocked':effect?.outcome==='good'?'good':effect?.outcome==='bad'?'bad':'default';
    return `<button type="button" class="social-story ${ring} ${String($runtime.socialSelectedPlayerId)===String(player.id)?'active':''}" data-social-player="${$runtime.escapeHtml(player.id)}">
      <span class="social-story-ring">${$runtime.socialPlayerAvatarHtml(player,'story')}</span>
      <strong>${$runtime.escapeHtml(String(player.name||'').split(' ')[0])}</strong>
    </button>`;
  }

  function socialConversationRowHtml(player){
    const conv=$runtime.socialConversation(player.id);
    const active=String($runtime.socialSelectedPlayerId)===String(player.id);
    const relation=$runtime.socialRelationLabel(conv?.relationship);
    return `<button type="button" class="social-conversation-row ${active?'active':''} ${conv?.blocked?'blocked':''}" data-social-player="${$runtime.escapeHtml(player.id)}">
      ${$runtime.socialPlayerAvatarHtml(player,'small')}
      <span class="social-conversation-copy">
        <strong>${$runtime.escapeHtml(player.name)}</strong>
        <small>${$runtime.escapeHtml($runtime.socialConversationPreview(conv))}</small>
      </span>
      <span class="social-conversation-meta">
        <b>${conv?.blocked?'BLOCCATO':$runtime.escapeHtml(relation.replace('RAPPORTO ',''))}</b>
        <small>${$runtime.escapeHtml(player.role)} · ${$runtime.playerOvrLabel(player)}</small>
      </span>
    </button>`;
  }

  function socialMessageHtml(message,player){
    if(message.sender==='system'){
      return `<div class="social-system-message"><span>🚫</span>${$runtime.escapeHtml(message.text)}</div>`;
    }
    const mine=message.sender==='user';
    const reaction=message.reaction?` reaction-${$runtime.escapeHtml(message.reaction)}`:'';
    return `<div class="social-message-row ${mine?'mine':'theirs'}${reaction}">
      ${mine?'':$runtime.socialPlayerAvatarHtml(player,'tiny')}
      <div class="social-message-bubble">
        <p>${$runtime.escapeHtml(message.text)}</p>
        <small>G${Number(message.day||1)}</small>
      </div>
    </div>`;
  }

  function renderSocialChat(player){
    const season=$runtime.ensureSeasonState();
    const conv=$runtime.socialConversation(player.id,season);
    const empty=$runtime.$('socialChatEmpty'),active=$runtime.$('socialChatActive');
    if(!conv || !active) return;

    empty?.classList.add('hidden');
    active.classList.remove('hidden');

    const profile=$runtime.socialPersonality(player);
    const relation=$runtime.socialRelationLabel(conv.relationship);
    const effect=$runtime.socialMotivationForPlayer(player.id,season.currentMatchday);
    const effectText=effect
      ? effect.outcome==='good'?'💚 Motivato oggi'
      : effect.outcome==='bad'||effect.outcome==='blocked'?'⚠ Pressione negativa oggi'
      : '💬 Reazione neutra oggi'
      : 'Nessun DM oggi';

    $runtime.$('socialChatHeader').innerHTML=`
      <div class="social-chat-player">
        ${$runtime.socialPlayerAvatarHtml(player,'header')}
        <div><strong>${$runtime.escapeHtml(player.name)}</strong><span>${$runtime.escapeHtml($runtime.socialHandle(player))} · ${$runtime.escapeHtml($runtime.clubShort(player.club))}</span></div>
      </div>
      <div class="social-chat-profile">
        <span>${$runtime.escapeHtml(profile.label)}</span>
        <b>${$runtime.escapeHtml(relation)}</b>
        <small>${$runtime.escapeHtml(effectText)}</small>
      </div>`;

    const messages=$runtime.$('socialChatMessages');
    messages.innerHTML=(conv.messages||[]).length
      ? conv.messages.map(m=>$runtime.socialMessageHtml(m,player)).join('')
      : `<div class="social-first-message"><div>${$runtime.socialPlayerAvatarHtml(player,'header')}</div><strong>${$runtime.escapeHtml(player.name)}</strong><span>${$runtime.escapeHtml(profile.desc)}</span><p>Segui già questo giocatore. Scrivigli un messaggio privato per provare a motivarlo.</p></div>`;

    const input=$runtime.$('socialMessageInput');
    const send=$runtime.$('socialSendBtn');
    const info=$runtime.$('socialComposeInfo');
    const alreadyEffective=!!effect;

    if(input){
      input.disabled=!!conv.blocked;
      input.placeholder=conv.blocked?'Questo giocatore ti ha bloccato':'Scrivi un messaggio...';
    }
    if(send){
      send.disabled=!!conv.blocked;
      send.textContent=conv.blocked?'BLOCCATO':'INVIA';
    }
    $runtime.$('socialQuickMessages')?.classList.toggle('is-disabled',!!conv.blocked);

    if(info){
      info.className=`social-compose-info ${conv.blocked?'blocked':alreadyEffective?'used':''}`;
      info.textContent=conv.blocked
        ? 'Questo giocatore ti ha bloccato: non puoi più scrivergli per il resto della stagione.'
        : alreadyEffective
          ? 'Hai già influenzato questo giocatore oggi. Altri messaggi non sommano bonus, ma possono irritarlo e farti bloccare.'
          : 'La prima reazione di oggi può dare un bonus, nessun effetto o un malus. Se reagisce male, può anche bloccarti subito.';
    }

    requestAnimationFrame(()=>{ if(messages) messages.scrollTop=messages.scrollHeight; });
  }

  function renderLeagueSocialScreen(){
    $runtime.stopHubNewsCarousel();
    const season=$runtime.ensureSeasonState();
    const social=$runtime.ensureSocialState(season);
    if(!season || !social) return $runtime.renderSummary();
    $runtime.showScreen('leagueSocialScreen');
    $runtime.renderLeagueNavActive('social');
    $runtime.renderCareerWallets();

    const players=$runtime.socialOwnedPlayers();
    if(!players.length) return;

    if(!$runtime.socialSelectedPlayerId || !players.some(p=>String(p.id)===String($runtime.socialSelectedPlayerId))){
      $runtime.socialSelectedPlayerId=String(players[0].id);
    }

    $runtime.$('socialFollowingCount').textContent=String(players.length);
    $runtime.$('socialAccountHandle').textContent=`@${String($runtime.state?.teamName||'fantallenatore').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,18)||'fantallenatore'}`;

    const query=String($runtime.socialSearchQuery||'').trim().toLowerCase();
    const visible=players.filter(p=>!query || String(p.name||'').toLowerCase().includes(query) || String($runtime.clubName(p.club)||'').toLowerCase().includes(query));
    $runtime.$('socialStories').innerHTML=visible.length
      ? visible.map($runtime.socialStoryHtml).join('')
      : '<div class="social-stories-no-results">Nessun giocatore trovato.</div>';

    document.querySelectorAll('#leagueSocialScreen [data-social-player]').forEach(btn=>{
      btn.onclick=()=>{
        $runtime.socialSelectedPlayerId=String(btn.dataset.socialPlayer);
        $runtime.renderLeagueSocialScreen();
      };
    });

    const selected=players.find(p=>String(p.id)===String($runtime.socialSelectedPlayerId));
    if(selected) $runtime.renderSocialChat(selected);

    document.querySelectorAll('#leagueSocialScreen [data-social-quick]').forEach(btn=>{
      btn.onclick=()=>{
        const input=$runtime.$('socialMessageInput');
        if(!input || input.disabled) return;
        input.value=btn.dataset.socialQuick||'';
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.focus();
      };
    });
  }

  function sendCurrentSocialMessage(){
    const input=$runtime.$('socialMessageInput');
    if(!input || !$runtime.socialSelectedPlayerId) return;
    const text=input.value.trim();
    if(!text) return;
    input.value='';
    if($runtime.$('socialMessageCounter')) $runtime.$('socialMessageCounter').textContent='0/180';
    $runtime.socialSendMessage($runtime.socialSelectedPlayerId,text);
  }

  function renderLeagueShopScreen(){
    $runtime.stopHubNewsCarousel();
    const season=$runtime.ensureSeasonState();
    if(!season) return $runtime.renderSummary();
    $runtime.showScreen('leagueShopScreen');
    $runtime.renderLeagueNavActive('shop');
    $runtime.renderCareerWallets();
    $runtime.renderShopItems();
  }
    return Object.freeze({socialOwnedPlayers,socialHandle,socialPersonality,ensureSocialState,socialConversation,socialMotivationForPlayer,socialRelationLabel,socialMessageTone,socialReactionData,socialReplyText,socialRecordMotivation,socialSendMessage,socialPlayerAvatarHtml,socialConversationPreview,socialStoryHtml,socialConversationRowHtml,socialMessageHtml,renderSocialChat,renderLeagueSocialScreen,sendCurrentSocialMessage,renderLeagueShopScreen});
  }
  window.FantaDomains ||= {};
  window.FantaDomains['social-controller']=Object.freeze({create});
})();
