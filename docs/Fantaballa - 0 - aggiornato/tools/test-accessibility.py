#!/usr/bin/env python3
import json
import mimetypes
from urllib.parse import urlparse, unquote
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://fantaballa.local'
OUT = ROOT / 'TEST-ACCESSIBILITA.json'
SHOT = ROOT.parent / 'accessibilita-mobile-390.png'

STORAGE_SHIM = r"""
<script>
(() => {
  class MemoryStorage {
    constructor(){ this.map = new Map(); }
    get length(){ return this.map.size; }
    key(index){ return [...this.map.keys()][index] ?? null; }
    getItem(key){ key=String(key); return this.map.has(key) ? this.map.get(key) : null; }
    setItem(key,value){ this.map.set(String(key),String(value)); }
    removeItem(key){ this.map.delete(String(key)); }
    clear(){ this.map.clear(); }
  }
  try { window.localStorage.setItem('__probe__','1'); window.localStorage.removeItem('__probe__'); }
  catch { Object.defineProperty(window,'localStorage',{configurable:true,value:new MemoryStorage()}); }
})();
</script>
"""


def install_local_routes(page):
    def handler(route):
        parsed = urlparse(route.request.url)
        relative = unquote(parsed.path.lstrip('/')) or 'index.html'
        target = (ROOT / relative).resolve()
        try:
            target.relative_to(ROOT.resolve())
        except ValueError:
            route.abort()
            return
        if not target.is_file():
            route.fulfill(status=404, body=b'Not found', content_type='text/plain', headers={'Access-Control-Allow-Origin':'*'})
            return
        content_type = mimetypes.guess_type(target.name)[0] or 'application/octet-stream'
        route.fulfill(status=200, body=target.read_bytes(), content_type=content_type, headers={'Access-Control-Allow-Origin':'*'})
    page.route(f'{BASE}/**', handler)


def load_local_page(page, filename, mode=None):
    install_local_routes(page)
    html = (ROOT / filename).read_text(encoding='utf-8')
    html = html.replace('<head>', f'<head><base href="{BASE}/">{STORAGE_SHIM}', 1)
    if mode:
        html = html.replace("const params = new URLSearchParams(location.search);", f"const params = new URLSearchParams('?mode={mode}');", 1)
    page.set_content(html, wait_until='load', timeout=30000)


def assert_true(condition, message):
    if not condition:
        raise AssertionError(message)


def build_season(page):
    page.evaluate("""
    () => {
      state = normalizeCampionatoState(freshState());
      state.teamName = 'Test accessibilità';
      state.coachName = 'Tester';
      state.coachType = 'anonymous';
      state.formation = '4-3-3';
      state.gameMode = 'normal';
      state.phase = 'setup';
      const built = buildFullyRandomDraftRoster();
      if (!built) throw new Error('Draft automatico non generato');
      const originalRandom = Math.random;
      Math.random = () => 0;
      try { finalizeDraft(); } finally { Math.random = originalRandom; }
      state.pendingEvent = {kind:'none', resolved:true, title:'Test', text:''};
      showSeason();
    }
    """)
    page.wait_for_selector('#playRoundInstant')


def test_game_page(browser, page_name):
    page = browser.new_page(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
    console_errors = []
    runtime_errors = []
    page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)
    page.on('pageerror', lambda err: runtime_errors.append(str(err)))
    load_local_page(page, page_name)
    page.wait_for_function("typeof state !== 'undefined' && Array.isArray(PLAYERS) && PLAYERS.length > 0")
    build_season(page)

    results = {}
    results['skip_link'] = page.locator('.a11y-skip-link').count() == 1
    results['button_types'] = page.locator('button:not([type])').count() == 0
    results['tabs_count'] = page.locator('.tabs [role="tab"]').count()
    results['tabpanels_count'] = page.locator('[role="tabpanel"]').count()
    results['selected_tabs'] = page.locator('.tabs [role="tab"][aria-selected="true"]').count()

    first_tab = page.locator('.tabs [role="tab"]').first
    first_tab.focus()
    page.keyboard.press('ArrowRight')
    page.wait_for_timeout(50)
    results['keyboard_tab_selected'] = page.locator('.tabs [role="tab"][aria-selected="true"]').inner_text()

    page.evaluate("""
      state.pendingEvent = {kind:'decision', resolved:false, title:'Scelta richiesta', text:'Scegli una opzione'};
      showSeason();
    """)
    page.wait_for_selector('#playRoundInstant:disabled')
    results['disabled_reason'] = page.locator('#matchActionStatus').inner_text()
    results['disabled_describedby'] = page.locator('#playRoundInstant').get_attribute('aria-describedby')

    page.evaluate("""
      state.pendingEvent = {kind:'none', resolved:true, title:'Test', text:''};
      showSeason();
    """)
    page.wait_for_selector('#playRoundInstant:not([disabled])')

    page.evaluate("""
    () => {
      window.__a11yConfirmResult = null;
      openConfirm({title:'Conferma di test', message:'Verifica del focus', confirmText:'Conferma', cancelText:'Annulla'})
        .then(value => { window.__a11yConfirmResult = value; });
    }
    """)
    page.wait_for_selector('.robust-modal')
    active_inside = page.evaluate("document.querySelector('.robust-modal').contains(document.activeElement)")
    page.keyboard.press('Tab')
    page.keyboard.press('Tab')
    trapped_inside = page.evaluate("document.querySelector('.robust-modal').contains(document.activeElement)")
    dialog_labelled = page.locator('.robust-modal').get_attribute('aria-labelledby') or page.locator('.robust-modal').get_attribute('aria-label')
    page.keyboard.press('Escape')
    page.wait_for_function("window.__a11yConfirmResult === false")
    results['dialog_focus'] = active_inside and trapped_inside
    results['dialog_labelled'] = bool(dialog_labelled)
    results['escape_cancel'] = True

    page.evaluate("""
      const button = document.createElement('button');
      button.id = 'a11yBusyTest';
      button.type = 'button';
      button.dataset.singleAction = '';
      button.dataset.busyAnnouncement = 'Test avviato.';
      button.textContent = 'Avvia test';
      document.body.appendChild(button);
      button.click();
    """)
    page.wait_for_timeout(80)
    results['single_action_guard'] = page.locator('#a11yBusyTest').is_disabled() and page.locator('#a11yBusyTest').get_attribute('aria-busy') == 'true'

    results['reduced_motion'] = page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches")
    results['horizontal_overflow'] = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")
    results['unnamed_visible_buttons'] = page.evaluate("""
      [...document.querySelectorAll('button')].filter(button => {
        const style = getComputedStyle(button);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        return !(button.getAttribute('aria-label') || button.textContent.trim() || button.title);
      }).length
    """)
    results['console_errors'] = console_errors
    results['runtime_errors'] = runtime_errors

    if page_name == 'campionato.html':
        page.screenshot(path=str(SHOT), full_page=False)

    assert_true(results['skip_link'], 'Skip link mancante')
    assert_true(results['button_types'], 'Sono presenti button senza type')
    assert_true(results['tabs_count'] == 5 and results['tabpanels_count'] == 5, 'Tab non accessibili')
    assert_true(results['selected_tabs'] == 1, 'Numero tab selezionate errato')
    assert_true(results['keyboard_tab_selected'] == 'Calendario', 'Navigazione frecce tab non funzionante')
    assert_true('scegliere' in results['disabled_reason'].lower(), 'Motivo pulsante disabilitato non chiaro')
    assert_true(results['disabled_describedby'] == 'matchActionStatus', 'Pulsante non collegato alla spiegazione')
    assert_true(results['dialog_focus'] and results['dialog_labelled'], 'Focus o nome modale non validi')
    assert_true(results['single_action_guard'], 'Blocco doppio comando non attivo')
    assert_true(not results['horizontal_overflow'], 'Overflow orizzontale mobile')
    assert_true(results['unnamed_visible_buttons'] == 0, 'Pulsanti visibili senza nome accessibile')
    assert_true(not runtime_errors, f'Errori runtime: {runtime_errors}')
    page.close()
    return results


def run_engine_suite(browser, mode):
    page = browser.new_page()
    load_local_page(page, 'test-season-runner.html', mode=mode)
    page.wait_for_function("window.FantaballaSeasonTestAPI && typeof window.FantaballaSeasonTestAPI.runSuite === 'function'", timeout=30000)
    report = page.evaluate("async () => await window.FantaballaSeasonTestAPI.runSuite({includeSlow:true, stressSeasons:0})")
    page.close()
    assert_true(report['summary']['failed'] == 0, f"Suite {mode} fallita")
    return report


def main():
    report = {'pages': {}, 'engine': {}}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files', '--disable-web-security'])
        report['pages']['community'] = test_game_page(browser, 'campionato.html')
        report['pages']['real'] = test_game_page(browser, 'campionato-real.html')
        report['engine']['community'] = run_engine_suite(browser, 'community')
        report['engine']['real'] = run_engine_suite(browser, 'real')
        browser.close()
    report['summary'] = {
        'accessibility_pages': 2,
        'engine_total': sum(item['summary']['total'] for item in report['engine'].values()),
        'engine_passed': sum(item['summary']['passed'] for item in report['engine'].values()),
        'engine_failed': sum(item['summary']['failed'] for item in report['engine'].values())
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report['summary'], ensure_ascii=False))


if __name__ == '__main__':
    main()
