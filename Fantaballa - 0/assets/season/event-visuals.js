/* Fantaballa Season Engine — event-visuals.js
 * Mappa le scelte evento a uno sfondo illustrato coerente con il tipo di decisione.
 */
(function(global){
  if(global.SEASON_EVENT_VISUALS)return;

  const EVENT_VISUAL_ASSET_BASE = (()=>{
    try{
      const source=document.currentScript&&document.currentScript.src?document.currentScript.src:'';
      return source?new URL('../event-choice-backgrounds/',source).href:'assets/event-choice-backgrounds/';
    }catch{return 'assets/event-choice-backgrounds/'}
  })();
  const eventVisualAsset=name=>`${EVENT_VISUAL_ASSET_BASE}${name}`;

  const VISUALS = Object.freeze({
    campo: Object.freeze({ category:'campo', label:'Campo', asset:eventVisualAsset('bg_evento_campo.webp') }),
    regolamento: Object.freeze({ category:'regolamento', label:'Regolamento', asset:eventVisualAsset('bg_evento_regolamento.webp') }),
    potenziamento: Object.freeze({ category:'potenziamento', label:'Potenziamento', asset:eventVisualAsset('bg_evento_potenziamento.webp') }),
    rischio: Object.freeze({ category:'rischio', label:'Rischio', asset:eventVisualAsset('bg_evento_rischio.webp') }),
    spogliatoio: Object.freeze({ category:'spogliatoio', label:'Spogliatoio', asset:eventVisualAsset('bg_evento_spogliatoio.webp') }),
    tifosi: Object.freeze({ category:'tifosi', label:'Tifosi', asset:eventVisualAsset('bg_evento_tifosi.webp') }),
    dirigenza: Object.freeze({ category:'dirigenza', label:'Dirigenza', asset:eventVisualAsset('bg_evento_dirigenza.webp') }),
    tattica: Object.freeze({ category:'tattica', label:'Tattica', asset:eventVisualAsset('bg_evento_tattica.webp') }),
    misterioso: Object.freeze({ category:'misterioso', label:'Misterioso', asset:eventVisualAsset('bg_evento_misterioso.webp') }),
    medico: Object.freeze({ category:'medico', label:'Medico', asset:eventVisualAsset('bg_evento_medico.webp') })
  });

  const CATEGORY_ALIASES = Object.freeze({
    regolamento:'regolamento', regola:'regolamento', regole:'regolamento', arbitro:'regolamento', referee:'regolamento', var:'regolamento',
    boost:'potenziamento', powerup:'potenziamento', upgrade:'potenziamento', potenziamento:'potenziamento', bonus:'potenziamento',
    risk:'rischio', rischio:'rischio', drama:'rischio',
    campo:'campo', partita:'campo', match:'campo',
    spogliatoio:'spogliatoio', locker:'spogliatoio', team:'spogliatoio',
    tifosi:'tifosi', curva:'tifosi', ultras:'tifosi', fans:'tifosi',
    dirigenza:'dirigenza', presidente:'dirigenza', board:'dirigenza', manager:'dirigenza',
    tattica:'tattica', tattico:'tattica', modulo:'tattica', coach:'tattica',
    misterioso:'misterioso', mystery:'misterioso', mascotte:'misterioso',
    medico:'medico', medical:'medico', infortunio:'medico'
  });

  const KEYWORDS = Object.freeze({
    campo: ['campo','partita','gol','rete','rigore segnato','rimonta','corner','cross','attacco','difesa','vs','stadio','palo','fuorigioco','titolare','tributa','esult','giocare'],
    regolamento: ['arbitro','var','regolamento','regola','regole','cartellino','squalifica','fallo','fischio','fischietto','rigore contro','decisione arbitrale','federazione','figc','giudice'],
    potenziamento: ['+ ovr','+ovr','+ intesa','+intesa','ovr','intesa','potenzi','migliora','upgrade','bonus','crescita','allenamento','boost','raddoppia','aumenta','sviluppa','premio','ottiene','riceve','guadagna','permanente'],
    rischio: ['rischio','perdi','perdita','fallimento','crisi','caos','maledizione','piange','lacrime','crollo','disastro','rovina','tradimento','punizione','abbandona','lascia la squadra','venduto','penalita'],
    spogliatoio: ['spogliatoio','gruppo','morale','festa','compagni','squadra unita','litigio interno','armonia','leader','capitano nello spogliatoio'],
    tifosi: ['curva','tifosi','ultras','pubblico','applaus','fischi','coreografia','sotto la curva','tribuna','sostenitori'],
    dirigenza: ['presidente','dirigenza','direttore','procuratore','sponsor','contratto','telefonata','riunione','investimento','societa','budget'],
    tattica: ['tattica','tattico','allenatore','modulo','formazione','panchina','turnover','schema','assetto','piano gara','istruzioni','panca'],
    misterioso: ['misterioso','enigmatic','mistero','leggenda','mascotte','leone','amuleto','ombra','strano','oscuro','segreto'],
    medico: ['infortun','medico','barella','staff medico','recupero','terapia','dolore','distorsione','guarigione','lesione']
  });

  function stripAccents(value){
    return String(value||'').normalize('NFD').replace(/[̀-ͯ]/g,'');
  }
  function normalize(value){
    const key = stripAccents(value).toLowerCase().trim().replace(/[_\-]+/g,' ');
    if(!key)return '';
    const compact = key.replace(/\s+/g,' ');
    return CATEGORY_ALIASES[compact] || CATEGORY_ALIASES[compact.split(' ')[0]] || compact;
  }
  function normalizeText(value){
    return stripAccents(value).toLowerCase().replace(/[_\-]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function scoreText(text){
    const normalized = normalizeText(text);
    if(!normalized)return {category:'', score:0};
    let bestCategory = '';
    let bestScore = 0;
    for(const [category, words] of Object.entries(KEYWORDS)){
      let score = 0;
      for(const keyword of words){
        if(normalized.includes(keyword))score += keyword.length > 8 ? 2 : 1;
      }
      if(score > bestScore){
        bestScore = score;
        bestCategory = category;
      }
    }
    return {category:bestCategory, score:bestScore};
  }
  function explicitCategoryFrom(entity){
    if(!entity || typeof entity !== 'object')return '';
    const candidates = [entity.visualCategory, entity.eventCategory, entity.bgType, entity.backgroundType, entity.imageType, entity.choiceTheme, entity.visualType];
    for(const candidate of candidates){
      const normalized = normalize(candidate);
      if(normalized && VISUALS[normalized])return normalized;
    }
    return '';
  }
  function infer(payload={}){
    const explicitChoice = explicitCategoryFrom(payload.choice);
    if(explicitChoice && VISUALS[explicitChoice])return explicitChoice;
    const explicitEvent = explicitCategoryFrom(payload.event);
    if(explicitEvent && VISUALS[explicitEvent])return explicitEvent;

    const choiceText = [payload.choice?.label, payload.choice?.effect, payload.choice?.text, payload.choice?.description].filter(Boolean).join(' · ');
    const eventText = [payload.event?.title, payload.event?.text, payload.event?.description].filter(Boolean).join(' · ');
    const choiceScore = scoreText(choiceText);
    const eventScore = scoreText(eventText);

    /* Le categorie che descrivono l'intero contesto dell'evento devono prevalere
       sul semplice tono positivo/negativo della singola opzione. */
    const contextualCategories = new Set(['regolamento','dirigenza','spogliatoio','tifosi','tattica','misterioso','medico']);
    if(eventScore.score >= 3 && contextualCategories.has(eventScore.category) && choiceScore.score <= eventScore.score + 1){
      return eventScore.category;
    }
    if(choiceScore.score >= 2 && choiceScore.score > eventScore.score)return choiceScore.category;
    if(eventScore.score > 0)return eventScore.category;
    if(choiceScore.score > 0)return choiceScore.category;

    const fallback = normalize(payload.fallbackCategory);
    if(fallback && VISUALS[fallback])return fallback;
    return String(payload.tone||'').toLowerCase()==='red' ? 'rischio' : 'campo';
  }
  function get(payload={}){
    const category = infer(payload);
    return VISUALS[category] || VISUALS.campo;
  }

  global.SEASON_EVENT_VISUALS = Object.freeze({
    map: VISUALS,
    normalize,
    infer,
    get
  });
})(globalThis);
