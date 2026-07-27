/* Fantaballa — editor grafico dei cataloghi evento. Nessun eval, nessuna scrittura server. */
(() => {
  'use strict';
  const CATALOGS = ['common', 'community', 'real'];
  const KINDS = ['decisions', 'autoEvents'];
  const DRAFT_KEY = 'fantaballa_event_editor_draft_v1';
  const state = {
    catalogs: {},
    activeCatalog: 'common',
    activeKind: 'decisions',
    selected: null,
    dirty: false,
    report: null,
    confirmAction: null
  };
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const clone = value => JSON.parse(JSON.stringify(value));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
  const slug = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,64);
  const catalogLabel = value => ({ common:'Comune', community:'Community', real:'REAL' }[value] || value);
  const kindLabel = value => value === 'autoEvents' ? 'Evento automatico' : 'Decisione';
  const catalogPath = name => `data/events/events-${name}.json`;

  async function readJson(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  }

  function showFatal(message) {
    const fatal = $('#fatal');
    fatal.textContent = message;
    fatal.style.display = message ? 'block' : 'none';
  }

  function setDirty(value = true) {
    state.dirty = value;
    const status = $('#dirtyStatus');
    status.className = `status ${value ? 'dirty' : 'ok'}`;
    status.textContent = value ? 'Modifiche non esportate' : 'Cataloghi caricati';
  }

  function sortedItems(catalog = state.activeCatalog, kind = state.activeKind) {
    return [...(state.catalogs[catalog]?.[kind] || [])].sort((a,b) => Number(a.order) - Number(b.order) || String(a.id).localeCompare(String(b.id)));
  }

  function currentRef() {
    if (!state.selected) return null;
    const list = state.catalogs[state.selected.catalog]?.[state.selected.kind] || [];
    const item = list.find(entry => entry.__editorKey === state.selected.key);
    return item ? { item, list, catalog: state.selected.catalog, kind: state.selected.kind } : null;
  }

  function attachKeys() {
    let index = 0;
    for (const catalog of CATALOGS) {
      const data = state.catalogs[catalog];
      if (!data) continue;
      for (const kind of KINDS) {
        for (const item of data[kind] || []) {
          if (!item.__editorKey) Object.defineProperty(item, '__editorKey', { value:`editor-${Date.now()}-${index++}-${Math.random().toString(36).slice(2,7)}`, enumerable:false, writable:true });
        }
      }
    }
  }

  function selectItem(catalog, kind, key) {
    state.activeCatalog = catalog;
    state.activeKind = kind;
    state.selected = { catalog, kind, key };
    renderAll();
  }

  function usedOrders(kind) {
    const set = new Set();
    for (const catalog of CATALOGS) for (const item of state.catalogs[catalog]?.[kind] || []) set.add(Number(item.order));
    return set;
  }

  function nextFreeOrder(kind) {
    const used = usedOrders(kind);
    let order = 0;
    while (used.has(order)) order += 1;
    return order;
  }

  function uniqueId(base, kind) {
    const used = new Set(CATALOGS.flatMap(catalog => (state.catalogs[catalog]?.[kind] || []).map(item => String(item.id))));
    let candidate = slug(base) || (kind === 'autoEvents' ? 'nuovo-auto-evento' : 'nuovo-evento');
    let index = 2;
    while (used.has(candidate)) candidate = `${slug(base) || 'nuovo-evento'}-${index++}`;
    return candidate;
  }

  function createItem(kind) {
    const item = kind === 'autoEvents'
      ? { id: uniqueId('nuovo-auto-evento', kind), order: nextFreeOrder(kind), title:'Nuovo evento automatico', text:'Descrivi cosa accade.', applyHandler:'' }
      : { id: uniqueId('nuovo-evento', kind), order: nextFreeOrder(kind), title:'Nuovo evento', text:'Descrivi la situazione e la decisione richiesta.', choices:[
          { label:'Opzione A', effect:'Descrivi l’effetto.', applyHandler:'' },
          { label:'Opzione B', effect:'Descrivi l’effetto.', applyHandler:'' }
        ] };
    Object.defineProperty(item, '__editorKey', { value:`editor-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, enumerable:false, writable:true });
    state.catalogs[state.activeCatalog][kind].push(item);
    state.activeKind = kind;
    state.selected = { catalog:state.activeCatalog, kind, key:item.__editorKey };
    setDirty();
    renderAll();
    requestAnimationFrame(() => $('[data-field="title"]')?.focus());
  }

  function duplicateCurrent() {
    const ref = currentRef();
    if (!ref) return;
    const copy = clone(ref.item);
    copy.id = uniqueId(`${ref.item.id}-copia`, ref.kind);
    copy.order = nextFreeOrder(ref.kind);
    Object.defineProperty(copy, '__editorKey', { value:`editor-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, enumerable:false, writable:true });
    ref.list.push(copy);
    state.selected = { catalog:ref.catalog, kind:ref.kind, key:copy.__editorKey };
    setDirty();
    renderAll();
  }

  function confirm(title, html, action, confirmLabel = 'Conferma') {
    state.confirmAction = action;
    $('#dialogTitle').textContent = title;
    $('#dialogBody').innerHTML = html;
    $('#dialogConfirm').textContent = confirmLabel;
    $('#confirmDialog').showModal();
  }

  function deleteCurrent() {
    const ref = currentRef();
    if (!ref) return;
    confirm('Elimina evento', `<p>Vuoi eliminare <b>${esc(ref.item.id)}</b> dal catalogo ${esc(catalogLabel(ref.catalog))}?</p><p class="help">L’operazione resta solo nell’editor finché non esporti il JSON.</p>`, () => {
      const index = ref.list.indexOf(ref.item);
      ref.list.splice(index,1);
      state.selected = null;
      setDirty();
      renderAll();
    }, 'Elimina');
  }

  function moveCurrentCatalog(destination) {
    const ref = currentRef();
    if (!ref || destination === ref.catalog) return;
    const index = ref.list.indexOf(ref.item);
    ref.list.splice(index,1);
    state.catalogs[destination][ref.kind].push(ref.item);
    state.activeCatalog = destination;
    state.selected = { catalog:destination, kind:ref.kind, key:ref.item.__editorKey };
    setDirty();
    renderAll();
  }

  function cleanCatalog(catalog) {
    const output = { schemaVersion:1, catalog:catalog.catalog, autoEvents:[], decisions:[] };
    output.autoEvents = (catalog.autoEvents || []).map(source => {
      const item = clone(source);
      if (!item.disabled) delete item.disabled;
      return item;
    });
    output.decisions = (catalog.decisions || []).map(source => {
      const item = clone(source);
      for (const key of ['questEvent','chainOnly','userOnly','disabled']) if (!item[key]) delete item[key];
      for (const key of ['availableHandler','titleHandler','describeHandler','createContextHandler']) if (!String(item[key] || '').trim()) delete item[key];
      if (!String(item.title || '').trim()) delete item.title;
      if (!Object.prototype.hasOwnProperty.call(item,'text') || !String(item.text || '').trim()) delete item.text;
      return item;
    });
    output.autoEvents.sort((a,b) => Number(a.order)-Number(b.order));
    output.decisions.sort((a,b) => Number(a.order)-Number(b.order));
    return output;
  }

  function cleanCatalogs() {
    return CATALOGS.map(name => cleanCatalog(state.catalogs[name]));
  }

  function validate() {
    const catalogs = cleanCatalogs();
    const report = FantaballaEventValidator.validateCatalogs(catalogs, SEASON_EVENT_HANDLER_IDS, { strictCounts:false, strictModeSeparation:true });
    const localWarnings = [];
    for (const catalog of catalogs) {
      for (const item of catalog.decisions) {
        if (String(item.title || '').length > 70) localWarnings.push(`${item.id}: titolo lungo (${String(item.title).length} caratteri).`);
        if (String(item.text || '').length > 220) localWarnings.push(`${item.id}: descrizione lunga (${String(item.text).length} caratteri).`);
        for (const [index, choice] of (item.choices || []).entries()) {
          if (String(choice.label || '').length > 55) localWarnings.push(`${item.id}: etichetta opzione ${index+1} lunga (${String(choice.label).length} caratteri).`);
          if (String(choice.effect || '').length > 220) localWarnings.push(`${item.id}: effetto opzione ${index+1} lungo (${String(choice.effect).length} caratteri).`);
        }
      }
    }
    report.warnings.push(...localWarnings);
    state.report = report;
    return report;
  }

  function renderMetrics() {
    const report = state.report || validate();
    $('#mCommon').textContent = state.catalogs.common.decisions.length;
    $('#mCommunity').textContent = state.catalogs.community.decisions.length;
    $('#mReal').textContent = state.catalogs.real.decisions.length;
    $('#mAuto').textContent = CATALOGS.reduce((sum,catalog) => sum + state.catalogs[catalog].autoEvents.length,0);
    $('#mErrors').textContent = report.errors.length;
    $('#mErrors').className = report.errors.length ? 'bad' : '';
    $('#mWarnings').textContent = report.warnings.length;
    $('#mWarnings').className = report.warnings.length ? 'warn' : '';
    $('#exportSelectedBtn').disabled = report.errors.length > 0;
    $('#exportAllBtn').disabled = report.errors.length > 0;
  }

  function renderList() {
    $$('[data-catalog]').forEach(button => button.classList.toggle('active', button.dataset.catalog === state.activeCatalog));
    $$('[data-kind]').forEach(button => button.classList.toggle('active', button.dataset.kind === state.activeKind));
    const query = $('#searchInput').value.trim().toLowerCase();
    const items = sortedItems().filter(item => !query || `${item.id} ${item.title || ''} ${item.text || ''}`.toLowerCase().includes(query));
    $('#listCount').textContent = items.length;
    $('#eventList').innerHTML = items.length ? items.map(item => `
      <button class="event-item ${state.selected?.key === item.__editorKey ? 'active' : ''}" data-select-key="${esc(item.__editorKey)}" type="button">
        <span class="event-item-top"><b>${esc(item.title || item.id || 'Senza titolo')}</b><span class="pill ${item.disabled ? 'off' : ''}">${item.disabled ? 'OFF' : `#${Number(item.order)+1}`}</span></span>
        <small>${esc(item.id || 'ID mancante')}</small>
      </button>`).join('') : '<div class="empty">Nessun evento corrisponde alla ricerca.</div>';
  }

  function handlerInput(field, value, list, label, help = '') {
    return `<div class="field"><label for="field-${field}">${esc(label)}</label><input id="field-${field}" data-field="${esc(field)}" list="${esc(list)}" value="${esc(value || '')}" placeholder="Nessuno">${help ? `<span class="help">${esc(help)}</span>` : ''}</div>`;
  }

  function renderEditor() {
    const ref = currentRef();
    if (!ref) {
      $('#editorTitle').textContent = 'Seleziona un evento';
      $('#itemType').textContent = '—';
      $('#editorBody').innerHTML = '<div class="empty">Scegli un evento dall’elenco oppure creane uno nuovo.</div>';
      return;
    }
    const item = ref.item;
    $('#editorTitle').textContent = item.title || item.id || 'Evento senza titolo';
    $('#itemType').textContent = kindLabel(ref.kind);
    const commonFields = `
      <div class="form-grid">
        <div class="field"><label for="field-catalog">Catalogo</label><select id="field-catalog" data-action="move-catalog">${CATALOGS.map(name => `<option value="${name}" ${name===ref.catalog?'selected':''}>${catalogLabel(name)}</option>`).join('')}</select><span class="help">Comune appare in entrambe le modalità.</span></div>
        <div class="field"><label for="field-order">Ordine</label><div class="inline-actions"><input id="field-order" data-field="order" type="number" min="0" step="1" value="${esc(item.order)}"><button class="btn ghost" data-action="free-order" type="button">Primo libero</button></div></div>
        <div class="field full"><label for="field-id">ID univoco</label><input id="field-id" data-field="id" value="${esc(item.id || '')}" autocomplete="off"><span class="help">Usa lettere minuscole, numeri e trattini. L’ID non esegue codice.</span></div>
        <div class="field full"><label for="field-title">Titolo</label><input id="field-title" data-field="title" value="${esc(item.title || '')}" maxlength="160"></div>
        <div class="field full"><label for="field-text">Descrizione</label><textarea id="field-text" data-field="text" maxlength="1000">${esc(item.text || '')}</textarea></div>
      </div>
      <div class="switches"><label class="check"><input data-field="disabled" type="checkbox" ${item.disabled?'checked':''}> Disattivato</label>${ref.kind==='decisions'?`<label class="check"><input data-field="questEvent" type="checkbox" ${item.questEvent?'checked':''}> Quest</label><label class="check"><input data-field="chainOnly" type="checkbox" ${item.chainOnly?'checked':''}> Solo catena</label><label class="check"><input data-field="userOnly" type="checkbox" ${item.userOnly?'checked':''}> Solo utente</label>`:''}</div>`;
    let specific = '';
    if (ref.kind === 'autoEvents') {
      specific = `<div class="section-title"><h3>Logica automatica</h3></div>${handlerInput('applyHandler', item.applyHandler, 'autoHandlers', 'Handler di applicazione', 'Solo handler registrati nel motore.')}`;
    } else {
      specific = `<div class="section-title"><h3>Condizioni e contenuti dinamici</h3></div><div class="form-grid">
        ${handlerInput('availableHandler',item.availableHandler,'availableHandlers','Condizione di disponibilità')}
        ${handlerInput('titleHandler',item.titleHandler,'titleHandlers','Titolo dinamico')}
        ${handlerInput('describeHandler',item.describeHandler,'describeHandlers','Descrizione dinamica')}
        ${handlerInput('createContextHandler',item.createContextHandler,'contextHandlers','Contesto dinamico')}
      </div>
      <div class="section-title"><h3>Opzioni</h3><button class="btn" data-action="add-choice" type="button">+ Aggiungi opzione</button></div>
      <div class="choice-list">${(item.choices || []).map((choice,index) => `
        <article class="choice" data-choice="${index}">
          <div class="choice-head"><strong>Opzione ${String.fromCharCode(65+index)}</strong><div class="inline-actions"><button class="icon-btn" data-action="choice-up" data-index="${index}" type="button" aria-label="Sposta su" ${index===0?'disabled':''}>↑</button><button class="icon-btn" data-action="choice-down" data-index="${index}" type="button" aria-label="Sposta giù" ${index===(item.choices.length-1)?'disabled':''}>↓</button><button class="icon-btn danger" data-action="remove-choice" data-index="${index}" type="button" aria-label="Rimuovi opzione">×</button></div></div>
          <div class="choice-grid">
            <div class="field full"><label>Testo pulsante</label><input data-choice-index="${index}" data-choice-field="label" value="${esc(choice.label || '')}" maxlength="180"></div>
            <div class="field full"><label>Descrizione effetto</label><textarea data-choice-index="${index}" data-choice-field="effect" maxlength="1200">${esc(choice.effect || '')}</textarea></div>
            <div class="field full"><label>Handler applicazione</label><input data-choice-index="${index}" data-choice-field="applyHandler" list="choiceHandlers" value="${esc(choice.applyHandler || '')}" placeholder="Cerca handler registrato"></div>
          </div>
        </article>`).join('')}</div>`;
    }
    $('#editorBody').innerHTML = `${commonFields}${specific}<div class="footer-actions"><div class="inline-actions"><button class="btn" data-action="duplicate" type="button">Duplica</button><button class="btn danger" data-action="delete" type="button">Elimina</button></div><span class="help">Le modifiche restano in memoria fino all’esportazione.</span></div>`;
  }

  function renderPreview() {
    const ref = currentRef();
    if (!ref) { $('#preview').innerHTML = '<div class="empty">Nessun evento selezionato.</div>'; return; }
    const item = ref.item;
    const dynamicTitle = item.titleHandler ? `<span class="pill">Titolo dinamico: ${esc(item.titleHandler)}</span>` : '';
    const dynamicText = item.describeHandler ? `<span class="pill">Testo dinamico: ${esc(item.describeHandler)}</span>` : '';
    const title = item.title || (item.titleHandler ? 'Titolo generato durante la partita' : 'Titolo mancante');
    const text = item.text || (item.describeHandler ? 'Descrizione generata durante la partita.' : 'Descrizione mancante.');
    const body = ref.kind === 'autoEvents'
      ? `<div class="preview-kicker">Evento automatico · ${esc(catalogLabel(ref.catalog))}</div><h3>${esc(title)}</h3><p>${esc(text)}</p><button class="preview-choice" type="button" disabled><b>Effetto automatico</b><small>${esc(item.applyHandler || 'Handler non selezionato')}</small></button>`
      : `<div class="preview-kicker">${item.questEvent?'Evento quest':'Decisione casuale'} · ${esc(catalogLabel(ref.catalog))}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${(item.choices || []).map((choice,index) => `<button class="preview-choice" type="button" disabled><b>Opzione ${String.fromCharCode(65+index)} · ${esc(choice.label || 'Testo mancante')}</b><small>${esc(choice.effect || 'Effetto non descritto')}</small></button>`).join('')}`;
    $('#preview').innerHTML = `<div class="preview-phone">${body}<div class="inline-actions" style="margin-top:12px">${dynamicTitle}${dynamicText}</div>${item.disabled?'<span class="preview-off">Evento disattivato</span>':''}</div>`;
  }

  function renderIssues() {
    const report = state.report || validate();
    const badge = $('#validationBadge');
    if (report.errors.length) { badge.className='status bad'; badge.textContent=`${report.errors.length} errori`; }
    else if (report.warnings.length) { badge.className='status warn'; badge.textContent=`${report.warnings.length} avvisi`; }
    else { badge.className='status ok'; badge.textContent='Valido'; }
    const items = [
      ...report.errors.map(text => ({type:'error',text})),
      ...report.warnings.map(text => ({type:'warning',text}))
    ];
    $('#issues').innerHTML = items.length ? items.slice(0,80).map(issue => `<div class="issue ${issue.type==='error'?'error':''}">${esc(issue.text)}</div>`).join('') : '<div class="issue ok">Cataloghi validi. Puoi esportare i JSON.</div>';
  }

  function renderAll() {
    validate();
    renderMetrics();
    renderList();
    renderEditor();
    renderPreview();
    renderIssues();
  }

  function updateKnownField(item, field, target) {
    if (target.type === 'checkbox') item[field] = target.checked;
    else if (field === 'order') item[field] = Number(target.value);
    else if (field === 'id') item[field] = slug(target.value);
    else item[field] = target.value;
  }

  function onEditorInput(event) {
    const ref = currentRef();
    if (!ref) return;
    const target = event.target;
    if (target.dataset.field) {
      updateKnownField(ref.item, target.dataset.field, target);
      if (target.dataset.field === 'id' && target.value !== ref.item.id) target.value = ref.item.id;
      setDirty();
      renderList();
      validate(); renderMetrics(); renderPreview(); renderIssues();
      $('#editorTitle').textContent = ref.item.title || ref.item.id || 'Evento senza titolo';
    } else if (target.dataset.choiceField !== undefined) {
      const index = Number(target.dataset.choiceIndex);
      const choice = ref.item.choices?.[index];
      if (!choice) return;
      choice[target.dataset.choiceField] = target.value;
      setDirty();
      validate(); renderMetrics(); renderPreview(); renderIssues();
    }
  }

  function onEditorClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const ref = currentRef();
    const action = button.dataset.action;
    if (action === 'duplicate') duplicateCurrent();
    if (action === 'delete') deleteCurrent();
    if (action === 'free-order' && ref) { ref.item.order = nextFreeOrder(ref.kind); setDirty(); renderAll(); }
    if (action === 'add-choice' && ref) { ref.item.choices ||= []; ref.item.choices.push({label:`Opzione ${String.fromCharCode(65+ref.item.choices.length)}`,effect:'Descrivi l’effetto.',applyHandler:''}); setDirty(); renderAll(); }
    if (action === 'remove-choice' && ref) { const index=Number(button.dataset.index); if (ref.item.choices.length<=2) { showFatal('Una decisione deve mantenere almeno due opzioni.'); return; } ref.item.choices.splice(index,1); setDirty(); showFatal(''); renderAll(); }
    if ((action === 'choice-up' || action === 'choice-down') && ref) { const index=Number(button.dataset.index); const next=action==='choice-up'?index-1:index+1; if(next<0||next>=ref.item.choices.length)return; [ref.item.choices[index],ref.item.choices[next]]=[ref.item.choices[next],ref.item.choices[index]]; setDirty(); renderAll(); }
  }

  function fillDatalist(id, values) {
    $(`#${id}`).innerHTML = [...values].sort().map(value => `<option value="${esc(value)}"></option>`).join('');
  }

  function populateHandlers() {
    fillDatalist('autoHandlers', SEASON_EVENT_HANDLER_IDS.autoApply);
    fillDatalist('availableHandlers', SEASON_EVENT_HANDLER_IDS.available);
    fillDatalist('titleHandlers', SEASON_EVENT_HANDLER_IDS.title);
    fillDatalist('describeHandlers', SEASON_EVENT_HANDLER_IDS.describe);
    fillDatalist('contextHandlers', SEASON_EVENT_HANDLER_IDS.createContext);
    fillDatalist('choiceHandlers', SEASON_EVENT_HANDLER_IDS.choiceApply);
  }

  function downloadJson(filename, data) {
    const blob = new Blob([`${JSON.stringify(data,null,2)}\n`], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCatalog(name) {
    const report = validate(); renderAll();
    if (report.errors.length) { showFatal('Correggi gli errori bloccanti prima di esportare.'); return; }
    downloadJson(`events-${name}.json`, cleanCatalog(state.catalogs[name]));
    showFatal('');
    $('#dirtyStatus').className = state.dirty ? 'status dirty' : 'status ok';
    $('#dirtyStatus').textContent = state.dirty ? `Catalogo ${catalogLabel(name)} esportato · altre modifiche in memoria` : `Catalogo ${catalogLabel(name)} esportato`;
  }

  function exportAll() {
    const report = validate(); renderAll();
    if (report.errors.length) { showFatal('Correggi gli errori bloccanti prima di esportare.'); return; }
    const outputs = Object.fromEntries(CATALOGS.map(name => [name, cleanCatalog(state.catalogs[name])]));
    CATALOGS.forEach((name,index) => setTimeout(() => downloadJson(`events-${name}.json`, outputs[name]), index*180));
    downloadJson('fantaballa-events-backup.json', { editorVersion:1, exportedAt:new Date().toISOString(), catalogs:outputs });
    setDirty(false); showFatal('');
  }

  function saveDraft() {
    try {
      const payload = { editorVersion:1, savedAt:new Date().toISOString(), catalogs:Object.fromEntries(CATALOGS.map(name => [name,cleanCatalog(state.catalogs[name])])) };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
      setDirty(false); showFatal('');
      $('#dirtyStatus').className='status ok'; $('#dirtyStatus').textContent='Bozza salvata nel browser';
    } catch (error) { showFatal(`Impossibile salvare la bozza nel browser: ${error.message || error}`); }
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) { showFatal('Non è presente alcuna bozza salvata nel browser.'); return; }
      const payload = JSON.parse(raw);
      confirm('Ripristina bozza', `<p>La bozza è stata salvata il <b>${esc(new Date(payload.savedAt).toLocaleString('it-IT'))}</b>.</p><p>Sostituirà i dati attualmente aperti nell’editor.</p>`, () => {
        state.catalogs = clone(payload.catalogs);
        attachKeys(); state.selected=null; setDirty(); showFatal(''); renderAll();
      }, 'Ripristina');
    } catch (error) { showFatal(`Bozza non leggibile: ${error.message || error}`); }
  }

  async function importFile(file) {
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.catalogs) {
        for (const name of CATALOGS) if (!parsed.catalogs[name]) throw new Error(`Catalogo ${name} mancante nel backup.`);
        confirm('Importa backup completo', '<p>Il backup sostituirà tutti e tre i cataloghi attualmente aperti.</p>', () => {
          state.catalogs = clone(parsed.catalogs); attachKeys(); state.selected=null; setDirty(); showFatal(''); renderAll();
        }, 'Importa');
        return;
      }
      const name = String(parsed?.catalog || '');
      if (!CATALOGS.includes(name) || !Array.isArray(parsed.autoEvents) || !Array.isArray(parsed.decisions)) throw new Error('Il file non è un catalogo eventi Fantaballa valido.');
      confirm('Importa catalogo', `<p>Il file sostituirà il catalogo <b>${esc(catalogLabel(name))}</b>.</p><p>Decisioni: ${parsed.decisions.length}. Eventi automatici: ${parsed.autoEvents.length}.</p>`, () => {
        state.catalogs[name] = clone(parsed); attachKeys(); state.activeCatalog=name; state.selected=null; setDirty(); showFatal(''); renderAll();
      }, 'Importa');
    } catch (error) { showFatal(`Importazione non riuscita: ${error.message || error}`); }
  }

  function bind() {
    $$('[data-catalog]').forEach(button => button.addEventListener('click', () => { state.activeCatalog=button.dataset.catalog; state.selected=null; renderAll(); }));
    $$('[data-kind]').forEach(button => button.addEventListener('click', () => { state.activeKind=button.dataset.kind; state.selected=null; renderAll(); }));
    $('#searchInput').addEventListener('input', renderList);
    $('#eventList').addEventListener('click', event => { const button=event.target.closest('[data-select-key]'); if(button) selectItem(state.activeCatalog,state.activeKind,button.dataset.selectKey); });
    $('#editorBody').addEventListener('input', onEditorInput);
    $('#editorBody').addEventListener('change', event => { if (event.target.dataset.action === 'move-catalog') moveCurrentCatalog(event.target.value); else onEditorInput(event); });
    $('#editorBody').addEventListener('click', onEditorClick);
    $('#newDecisionBtn').addEventListener('click', () => createItem('decisions'));
    $('#newAutoBtn').addEventListener('click', () => createItem('autoEvents'));
    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', event => { const file=event.target.files?.[0]; if(file) importFile(file); event.target.value=''; });
    $('#saveDraftBtn').addEventListener('click', saveDraft);
    $('#restoreDraftBtn').addEventListener('click', restoreDraft);
    $('#exportSelectedBtn').addEventListener('click', () => exportCatalog(state.activeCatalog));
    $('#exportAllBtn').addEventListener('click', exportAll);
    $('#dialogClose').addEventListener('click', () => $('#confirmDialog').close());
    $('#dialogCancel').addEventListener('click', () => $('#confirmDialog').close());
    $('#dialogConfirm').addEventListener('click', () => { const action=state.confirmAction; state.confirmAction=null; $('#confirmDialog').close(); action?.(); });
    window.addEventListener('beforeunload', event => { if (!state.dirty) return; event.preventDefault(); event.returnValue=''; });
  }

  async function init() {
    populateHandlers(); bind();
    try {
      const catalogs = await Promise.all(CATALOGS.map(name => readJson(catalogPath(name))));
      state.catalogs = Object.fromEntries(catalogs.map(catalog => [catalog.catalog, catalog]));
      attachKeys();
      const first = sortedItems('common','decisions')[0];
      if (first) state.selected = { catalog:'common', kind:'decisions', key:first.__editorKey };
      setDirty(false); renderAll();
    } catch (error) {
      showFatal(`Impossibile caricare i cataloghi: ${error.message || error}. Apri l’editor tramite un server web.`);
      $('#dirtyStatus').className='status bad'; $('#dirtyStatus').textContent='Caricamento fallito';
    }
  }
  init();
})();
