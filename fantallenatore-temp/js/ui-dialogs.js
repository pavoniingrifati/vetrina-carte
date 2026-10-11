(() => {
  'use strict';

  const get = id => document.getElementById(id);
  let resolver = null;

  function close(result) {
    const modal = get('pixelDialog');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('pixel-dialog-open');
    const done = resolver;
    resolver = null;
    if (done) done(result);
  }

  function open(options = {}, alertOnly = false) {
    const modal = get('pixelDialog');
    if (!modal) return Promise.resolve(alertOnly);
    get('pixelDialogEyebrow').textContent = options.eyebrow || 'CONFERMA';
    get('pixelDialogTitle').textContent = options.title || 'Sei sicuro?';
    get('pixelDialogMessage').textContent = options.message || '';
    const consequence = get('pixelDialogConsequence');
    consequence.textContent = options.consequence || '';
    consequence.classList.toggle('hidden', !options.consequence);
    const confirmButton = get('pixelDialogConfirm');
    const cancelButton = get('pixelDialogCancel');
    confirmButton.textContent = options.confirmLabel || 'CONFERMA';
    cancelButton.textContent = options.cancelLabel || 'ANNULLA';
    cancelButton.classList.toggle('hidden', alertOnly);
    modal.dataset.tone = options.tone || 'default';
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('pixel-dialog-open');
    window.setTimeout(() => confirmButton.focus(), 0);
    return new Promise(resolve => { resolver = resolve; });
  }

  document.addEventListener('click', event => {
    if (get('pixelDialog')?.classList.contains('hidden')) return;
    const target=event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('#pixelDialogConfirm')) { event.preventDefault(); close(true); }
    else if (target.closest('#pixelDialogCancel, #pixelDialogBackdrop')) { event.preventDefault(); close(false); }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !get('pixelDialog')?.classList.contains('hidden')) {
      event.preventDefault();
      close(false);
    }
  });

  window.PixelDialog = {
    confirm: options => open(options, false),
    alert: options => open(options, true)
  };
})();
