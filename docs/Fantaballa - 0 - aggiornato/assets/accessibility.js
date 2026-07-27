(() => {
  'use strict';

  const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'summary',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  const DIALOG_SELECTOR = [
    '[role="dialog"]',
    '.robust-modal',
    '.modal',
    '.wc-match-modal',
    '.placement-modal',
    '.intro-modal',
    '.season-event-dialog'
  ].join(',');

  let currentDialog = null;
  let focusBeforeDialog = null;
  let uid = 0;
  let refreshQueued = false;

  const visible = element => {
    if (!element || !element.isConnected || element.hidden) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  };

  const ensureId = (element, prefix = 'a11y') => {
    if (!element.id) element.id = `${prefix}-${++uid}`;
    return element.id;
  };

  const ensureLiveRegion = () => {
    let region = document.getElementById('a11yAnnouncements');
    if (!region) {
      region = document.createElement('div');
      region.id = 'a11yAnnouncements';
      region.className = 'a11y-visually-hidden';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      region.setAttribute('aria-atomic', 'true');
      document.body.appendChild(region);
    }
    return region;
  };

  const announce = (message, {assertive = false} = {}) => {
    const region = ensureLiveRegion();
    region.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
    region.textContent = '';
    window.setTimeout(() => { region.textContent = String(message || ''); }, 15);
  };

  const ensureSkipLink = () => {
    if (document.querySelector('.a11y-skip-link')) return;
    const main = document.querySelector('main, #screen, .app, [role="main"]');
    if (!main) return;
    ensureId(main, 'contenuto-principale');
    if (!main.hasAttribute('tabindex')) main.tabIndex = -1;
    const link = document.createElement('a');
    link.className = 'a11y-skip-link';
    link.href = `#${main.id}`;
    link.textContent = 'Vai al contenuto principale';
    document.body.insertBefore(link, document.body.firstChild);
  };

  const prepareButtons = root => {
    root.querySelectorAll?.('button').forEach(button => {
      if (!button.hasAttribute('type')) button.type = 'button';
      const name = (button.getAttribute('aria-label') || button.textContent || '').trim();
      if (!name && button.title) button.setAttribute('aria-label', button.title);
      if (button.disabled) button.setAttribute('aria-disabled', 'true');
      else button.removeAttribute('aria-disabled');
      const reason = button.dataset.disabledReason;
      if (reason && button.disabled) button.title = reason;
    });
  };

  const syncTabs = container => {
    const tabs = [...container.querySelectorAll(':scope > [data-tab], :scope [data-tab]')]
      .filter(tab => tab.closest('.tabs') === container);
    if (!tabs.length) return;
    container.setAttribute('role', 'tablist');
    if (!container.hasAttribute('aria-label')) container.setAttribute('aria-label', 'Sezioni della stagione');
    tabs.forEach((tab, index) => {
      const panel = document.getElementById(`tab-${tab.dataset.tab}`);
      const selected = tab.classList.contains('active') || panel?.classList.contains('active');
      tab.setAttribute('role', 'tab');
      const selectedValue = String(Boolean(selected));
      if (tab.getAttribute('aria-selected') !== selectedValue) tab.setAttribute('aria-selected', selectedValue);
      tab.tabIndex = selected ? 0 : -1;
      ensureId(tab, 'season-tab');
      if (panel) {
        ensureId(panel, 'season-panel');
        tab.setAttribute('aria-controls', panel.id);
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
        panel.tabIndex = 0;
      }
      if (!selected && index === 0 && !tabs.some(item => item.getAttribute('aria-selected') === 'true')) {
        if (tab.getAttribute('aria-selected') !== 'true') tab.setAttribute('aria-selected', 'true');
        tab.tabIndex = 0;
      }
    });
  };

  const prepareTabs = root => {
    root.querySelectorAll?.('.tabs').forEach(container => {
      syncTabs(container);
      if (container.dataset.a11yTabsReady === 'true') return;
      container.dataset.a11yTabsReady = 'true';
      container.addEventListener('keydown', event => {
        const tabs = [...container.querySelectorAll('[role="tab"]')];
        const index = tabs.indexOf(document.activeElement);
        if (index < 0) return;
        let next = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = tabs[(index + 1) % tabs.length];
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = tabs[(index - 1 + tabs.length) % tabs.length];
        if (event.key === 'Home') next = tabs[0];
        if (event.key === 'End') next = tabs[tabs.length - 1];
        if (!next) return;
        event.preventDefault();
        next.focus();
        next.click();
      });
      container.addEventListener('click', () => window.setTimeout(() => syncTabs(container), 0));
    });
  };

  const prepareStatusRegions = root => {
    const toast = root.querySelector?.('#toast, .toast');
    if (toast) {
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.setAttribute('aria-atomic', 'true');
    }
    root.querySelectorAll?.('.live-scoreboard').forEach(node => {
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      node.setAttribute('aria-atomic', 'true');
    });
    root.querySelectorAll?.('#liveCommentary, .live-commentary').forEach(node => {
      node.setAttribute('aria-live', 'polite');
      node.setAttribute('aria-relevant', 'additions text');
    });
  };

  const prepareDialog = dialog => {
    if (!dialog) return;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    if (!dialog.hasAttribute('aria-labelledby') && !dialog.hasAttribute('aria-label')) {
      const heading = dialog.querySelector('h1, h2, h3, .live-match-head b, .label + b');
      if (heading) dialog.setAttribute('aria-labelledby', ensureId(heading, 'dialog-title'));
      else dialog.setAttribute('aria-label', 'Finestra di gioco');
    }
    if (!dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;
  };

  const findTopDialog = () => [...document.querySelectorAll(DIALOG_SELECTOR)].filter(visible).pop() || null;

  const syncDialog = () => {
    const nextDialog = findTopDialog();
    if (nextDialog === currentDialog) return;
    if (!nextDialog) {
      const restore = focusBeforeDialog;
      currentDialog = null;
      focusBeforeDialog = null;
      if (restore?.isConnected) window.setTimeout(() => restore.focus({preventScroll: true}), 0);
      return;
    }
    focusBeforeDialog = currentDialog ? focusBeforeDialog : document.activeElement;
    currentDialog = nextDialog;
    prepareDialog(currentDialog);
    window.setTimeout(() => {
      if (currentDialog !== nextDialog || !visible(nextDialog)) return;
      const target = nextDialog.querySelector('[autofocus], button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])') || nextDialog;
      target.focus({preventScroll: true});
    }, 25);
  };

  const refresh = root => {
    prepareButtons(root || document);
    prepareTabs(root || document);
    prepareStatusRegions(root || document);
    ensureSkipLink();
    syncDialog();
  };

  const queueRefresh = root => {
    if (refreshQueued) return;
    refreshQueued = true;
    window.requestAnimationFrame(() => {
      refreshQueued = false;
      refresh(root || document);
    });
  };

  const markBusy = (button, label) => {
    if (!button || button.disabled || button.getAttribute('aria-busy') === 'true') return false;
    button.dataset.a11yOriginalText = button.textContent;
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    button.setAttribute('aria-disabled', 'true');
    if (label) announce(label);
    window.setTimeout(() => {
      if (!button.isConnected || button.getAttribute('aria-busy') !== 'true') return;
      button.removeAttribute('aria-busy');
      button.disabled = false;
      button.removeAttribute('aria-disabled');
    }, 60000);
    return true;
  };

  document.addEventListener('keydown', event => {
    document.documentElement.classList.add('using-keyboard');
    if (!currentDialog || !visible(currentDialog)) return;
    if (event.key === 'Escape') {
      const safeClose = currentDialog.querySelector('[data-event-minimize], #robustConfirmCancel, #robustConfirmClose, .robust-close, .intro-close, [data-intro-close]');
      if (safeClose) {
        event.preventDefault();
        safeClose.click();
      }
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...currentDialog.querySelectorAll(FOCUSABLE)].filter(visible);
    if (!focusable.length) {
      event.preventDefault();
      currentDialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, true);

  document.addEventListener('pointerdown', () => document.documentElement.classList.remove('using-keyboard'), true);

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-single-action]');
    if (!button || button.disabled || button.getAttribute('aria-busy') === 'true') return;
    window.setTimeout(() => {
      if (!button.isConnected) return;
      markBusy(button, button.dataset.busyAnnouncement || 'Operazione avviata.');
    }, 0);
  });

  const observer = new MutationObserver(records => {
    let root = document;
    for (const record of records) {
      if (record.target?.nodeType === Node.ELEMENT_NODE) root = record.target;
    }
    queueRefresh(document);
  });

  const init = () => {
    if (!document.documentElement.lang) document.documentElement.lang = 'it';
    ensureLiveRegion();
    refresh(document);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'style', 'disabled', 'aria-selected']
    });
  };

  window.FantaballaA11y = {announce, markBusy, refresh: () => refresh(document)};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
