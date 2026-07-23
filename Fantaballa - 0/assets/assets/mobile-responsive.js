(() => {
  'use strict';

  const mobileQuery = window.matchMedia('(max-width: 760px)');
  const modalSelectors = [
    '.modal-backdrop', '.robust-modal-backdrop', '.wc-match-overlay',
    '.placement-overlay', '.pack-reveal', '.intro-overlay', '.season-event-overlay'
  ];

  const isVisible = element => {
    if (!element || element.hidden) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };

  const updateModalState = () => {
    const open = mobileQuery.matches && modalSelectors.some(selector =>
      [...document.querySelectorAll(selector)].some(isVisible)
    );
    document.body.classList.toggle('has-mobile-modal', open);
  };

  const prepareScrollRegions = root => {
    root.querySelectorAll?.('.season-table-scroll,.table-wrap,.mobile-table-scroll,.tabs,.wc-flow-head,.dataset-tabs')
      .forEach(region => {
        if (!region.hasAttribute('tabindex')) region.tabIndex = 0;
        if (!region.hasAttribute('role')) region.setAttribute('role', 'region');
        if (!region.hasAttribute('aria-label')) region.setAttribute('aria-label', 'Contenuto scorrevole');
      });
  };

  const observer = new MutationObserver(records => {
    for (const record of records) {
      record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) prepareScrollRegions(node);
      });
    }
    updateModalState();
  });

  const init = () => {
    document.documentElement.classList.add('mobile-ui-ready');
    prepareScrollRegions(document);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'style']
    });
    mobileQuery.addEventListener?.('change', updateModalState);
    updateModalState();

    if (window.visualViewport) {
      let previousHeight = window.visualViewport.height;
      window.visualViewport.addEventListener('resize', () => {
        const active = document.activeElement;
        const keyboardOpened = window.visualViewport.height < previousHeight - 80;
        previousHeight = window.visualViewport.height;
        if (keyboardOpened && active && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName)) {
          window.setTimeout(() => active.scrollIntoView({block: 'center', behavior: 'smooth'}), 80);
        }
      });
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
