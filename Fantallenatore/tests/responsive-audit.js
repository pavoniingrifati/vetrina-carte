'use strict';

const fs = require('fs');
const path = require('path');

const VIEWPORTS = Object.freeze([
  { width: 1920, height: 1080, profile: 'desktop-wide' },
  { width: 1440, height: 900, profile: 'desktop' },
  { width: 1366, height: 768, profile: 'desktop-compact' },
  { width: 1024, height: 768, profile: 'compact' },
  { width: 768, height: 1024, profile: 'tablet' },
  { width: 390, height: 844, profile: 'phone' }
]);

function auditResponsive(root) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'css/manifest.json'), 'utf8'));
  const css = fs.readFileSync(path.join(root, 'css/modules/12-responsive-qa.css'), 'utf8');
  const requirements = [
    ['modulo responsive caricato per ultimo', manifest.sections.at(-1).file === 'css/modules/12-responsive-qa.css'],
    ['dashboard a colonna singola entro 1100 px', /@media\(max-width:1100px\)[\s\S]*?#seasonScreen \.season-dashboard-shell[\s\S]*?grid-template-columns:minmax\(0,1fr\)!important/.test(css)],
    ['dashboard laterale a colonna singola su telefono', /@media\(max-width:620px\)[\s\S]*?#seasonScreen \.season-dashboard-left[\s\S]*?grid-template-columns:minmax\(0,1fr\)!important/.test(css)],
    ['navigazione compatta sotto 420 px', /@media\(max-width:420px\)[\s\S]*?\.league-nav button[\s\S]*?min-height:68px!important/.test(css)],
    ['modali limitate alla viewport', /max-width:calc\(100vw - 20px\)/.test(css)],
    ['media fluidi', /img,\s*svg,\s*video\s*\{\s*max-width:100%/.test(css)]
  ];
  const failures = requirements.filter(([, ok]) => !ok).map(([name]) => name);
  return {
    ok: failures.length === 0 && VIEWPORTS.length === 6,
    failures,
    viewports: VIEWPORTS.map(viewport => ({ ...viewport, cssContractsPresent: failures.length === 0, browserVerified: false }))
  };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const report = auditResponsive(root);
  for (const viewport of report.viewports) {
    console.log(`[NON VERIFICATO NEL BROWSER] ${viewport.width}x${viewport.height} · ${viewport.profile}`);
  }
  if (!report.ok) {
    console.error(`Contratti mancanti: ${report.failures.join(', ')}`);
    process.exitCode = 1;
  }
}

module.exports = { VIEWPORTS, auditResponsive };
