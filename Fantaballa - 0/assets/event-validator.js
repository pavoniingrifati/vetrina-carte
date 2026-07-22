/* Fantaballa — validatore dei cataloghi eventi data-driven. */
(() => {
  function asSet(values) {
    return new Set(Array.isArray(values) ? values.map(String) : []);
  }

  function validateCatalogs(catalogs, handlerIds = {}, policy = {}) {
    const errors = [];
    const warnings = [];
    const details = [];
    const handlerSets = {
      autoApply: asSet(handlerIds.autoApply),
      available: asSet(handlerIds.available),
      title: asSet(handlerIds.title),
      describe: asSet(handlerIds.describe),
      createContext: asSet(handlerIds.createContext),
      choiceApply: asSet(handlerIds.choiceApply)
    };
    const allAuto = [];
    const allDecisions = [];
    const strictCounts = policy.strictCounts === true;
    const enforceMinimumCounts = policy.enforceMinimumCounts !== false;
    const strictModeSeparation = policy.strictModeSeparation !== false;

    for (const catalog of catalogs || []) {
      const name = String(catalog?.catalog || 'sconosciuto');
      if (!catalog || Number(catalog.schemaVersion) !== 1) {
        errors.push(`${name}: schemaVersion non supportata.`);
        continue;
      }
      if (!Array.isArray(catalog.autoEvents)) errors.push(`${name}: autoEvents non è un array.`);
      else allAuto.push(...catalog.autoEvents.map(item => ({ ...item, __catalog: name })));
      if (!Array.isArray(catalog.decisions)) errors.push(`${name}: decisions non è un array.`);
      else allDecisions.push(...catalog.decisions.map(item => ({ ...item, __catalog: name })));
    }

    const autoIds = new Set();
    const autoOrders = new Set();
    for (const item of allAuto) {
      const id = String(item?.id || '').trim();
      if (!id) errors.push(`${item.__catalog}: evento automatico senza id.`);
      else if (autoIds.has(id)) errors.push(`ID evento automatico duplicato: ${id}.`);
      else autoIds.add(id);
      if (!String(item?.title || '').trim()) errors.push(`${id || '?'}: titolo mancante.`);
      if (!String(item?.text || '').trim()) errors.push(`${id || '?'}: testo mancante.`);
      const autoOrder = Number(item?.order);
      if (!Number.isFinite(autoOrder)) errors.push(`${id || '?'}: order non numerico.`);
      else if (autoOrders.has(autoOrder)) errors.push(`Ordine evento automatico duplicato: ${autoOrder}.`);
      else autoOrders.add(autoOrder);
      if (!handlerSets.autoApply.has(String(item?.applyHandler || ''))) errors.push(`${id || '?'}: handler automatico mancante (${item?.applyHandler || '?'}).`);
    }

    const ids = new Set();
    const orders = new Set();
    for (const item of allDecisions) {
      const id = String(item?.id || '').trim();
      if (!id) errors.push(`${item.__catalog}: decisione senza id.`);
      else if (ids.has(id)) errors.push(`ID decisione duplicato: ${id}.`);
      else ids.add(id);
      const order = Number(item?.order);
      if (!Number.isFinite(order)) errors.push(`${id || '?'}: order non numerico.`);
      else if (orders.has(order)) errors.push(`Ordine decisione duplicato: ${order}.`);
      else orders.add(order);
      if (!String(item?.title || '').trim() && !item?.titleHandler) errors.push(`${id || '?'}: titolo o titleHandler mancante.`);
      if (item?.titleHandler && !handlerSets.title.has(String(item.titleHandler))) errors.push(`${id}: titleHandler inesistente (${item.titleHandler}).`);
      if (item?.availableHandler && !handlerSets.available.has(String(item.availableHandler))) errors.push(`${id}: availableHandler inesistente (${item.availableHandler}).`);
      if (item?.describeHandler && !handlerSets.describe.has(String(item.describeHandler))) errors.push(`${id}: describeHandler inesistente (${item.describeHandler}).`);
      if (item?.createContextHandler && !handlerSets.createContext.has(String(item.createContextHandler))) errors.push(`${id}: createContextHandler inesistente (${item.createContextHandler}).`);
      if (!Array.isArray(item?.choices) || item.choices.length < 2) errors.push(`${id || '?'}: servono almeno due opzioni.`);
      for (const [index, choice] of (item?.choices || []).entries()) {
        if (!String(choice?.label || '').trim()) errors.push(`${id || '?'}: opzione ${index + 1} senza label.`);
        if (!String(choice?.effect || '').trim()) warnings.push(`${id || '?'}: opzione ${index + 1} senza descrizione dell’effetto.`);
        if (!handlerSets.choiceApply.has(String(choice?.applyHandler || ''))) errors.push(`${id || '?'}: handler scelta mancante (${choice?.applyHandler || '?'}).`);
      }
      details.push({
        id,
        catalog: item.__catalog,
        order,
        choices: Array.isArray(item?.choices) ? item.choices.length : 0,
        dynamic: Boolean(item?.titleHandler || item?.availableHandler || item?.describeHandler || item?.createContextHandler),
        flags: ['questEvent', 'chainOnly', 'userOnly'].filter(flag => item?.[flag])
      });
    }

    const common = (catalogs || []).find(item => item?.catalog === 'common') || { autoEvents: [], decisions: [] };
    const community = (catalogs || []).find(item => item?.catalog === 'community') || { autoEvents: [], decisions: [] };
    const real = (catalogs || []).find(item => item?.catalog === 'real') || { autoEvents: [], decisions: [] };
    const communityDecisionIds = new Set((community.decisions || []).map(item => String(item.id)));
    const expectedCommunityOnly = Array.isArray(policy.expectedCommunityOnly)
      ? policy.expectedCommunityOnly.map(String)
      : ['whatsapp-pubblicato', 'cuggino-influencer', 'tiktok-boomer', 'ma-che-mollo'];
    if (strictModeSeparation) {
      for (const id of expectedCommunityOnly) {
        if (!communityDecisionIds.has(id)) errors.push(`Evento esclusivo Community mancante: ${id}.`);
      }
      if ((real.decisions || []).some(item => expectedCommunityOnly.includes(String(item.id)))) errors.push('Il catalogo REAL contiene eventi esclusivi Community.');
      if (!(community.autoEvents || []).some(item => item.title === 'Sostegno degli abbonati')) errors.push('Evento automatico abbonati mancante dal catalogo Community.');
      if ((real.autoEvents || []).some(item => item.title === 'Sostegno degli abbonati')) errors.push('Evento automatico abbonati presente nel catalogo REAL.');
    }

    const stats = {
      catalogs: (catalogs || []).length,
      commonAuto: (common.autoEvents || []).length,
      commonDecisions: (common.decisions || []).length,
      communityAuto: (common.autoEvents || []).length + (community.autoEvents || []).length,
      communityDecisions: (common.decisions || []).length + (community.decisions || []).length,
      realAuto: (common.autoEvents || []).length + (real.autoEvents || []).length,
      realDecisions: (common.decisions || []).length + (real.decisions || []).length,
      choices: allDecisions.reduce((sum, item) => sum + (item.choices?.length || 0), 0),
      dynamicDecisions: details.filter(item => item.dynamic).length,
      disabledAuto: allAuto.filter(item => item.disabled === true).length,
      disabledDecisions: allDecisions.filter(item => item.disabled === true).length
    };
    const baseline = { communityAuto: 5, communityDecisions: 77, realAuto: 4, realDecisions: 71, ...(policy.expectedCounts || {}) };
    if (enforceMinimumCounts) {
      if (stats.communityAuto < baseline.communityAuto) errors.push(`Community: attesi almeno ${baseline.communityAuto} eventi automatici, trovati ${stats.communityAuto}.`);
      if (stats.communityDecisions < baseline.communityDecisions) errors.push(`Community: attese almeno ${baseline.communityDecisions} decisioni, trovate ${stats.communityDecisions}.`);
      if (stats.realAuto < baseline.realAuto) errors.push(`REAL: attesi almeno ${baseline.realAuto} eventi automatici, trovati ${stats.realAuto}.`);
      if (stats.realDecisions < baseline.realDecisions) errors.push(`REAL: attese almeno ${baseline.realDecisions} decisioni, trovate ${stats.realDecisions}.`);
    }
    if (strictCounts) {
      if (stats.communityAuto !== baseline.communityAuto) errors.push(`Community: attesi esattamente ${baseline.communityAuto} eventi automatici, trovati ${stats.communityAuto}.`);
      if (stats.communityDecisions !== baseline.communityDecisions) errors.push(`Community: attese esattamente ${baseline.communityDecisions} decisioni, trovate ${stats.communityDecisions}.`);
      if (stats.realAuto !== baseline.realAuto) errors.push(`REAL: attesi esattamente ${baseline.realAuto} eventi automatici, trovati ${stats.realAuto}.`);
      if (stats.realDecisions !== baseline.realDecisions) errors.push(`REAL: attese esattamente ${baseline.realDecisions} decisioni, trovate ${stats.realDecisions}.`);
    }

    return { ok: errors.length === 0, errors, warnings, stats, details };
  }

  window.FantaballaEventValidator = Object.freeze({ version: 1, validateCatalogs });
})();
