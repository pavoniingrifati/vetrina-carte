const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'classifica.html'), 'utf8');
const mirror = fs.readFileSync(path.join(root, 'assets', 'classifica.html'), 'utf8');

let passed = 0;
let failed = 0;
function check(name, condition) {
  if (condition) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

check(
  'La classifica bomber include anche la Sfida della settimana',
  /const standardRows = rows\.filter\(row => modeKindOf\(row\) !== 'weekly'\);\s*renderScorers\(rows\);/s.test(main)
);
check(
  'Il totale risultati usa tutte le righe',
  /heroTotalRuns\.textContent = allNamedRows\.length/.test(main)
);
check(
  'I gol dei bomber usano tutte le righe',
  /const scorerGoals = buildScorers\(allRows\)/.test(main)
);
check(
  'Record e metriche di Fantacampionato restano sulle modalità standard',
  /const recordPoints = standardRows\.reduce/.test(main)
);
check(
  'Le classifiche Fantacampionato filtrano ancora solo campionatoReal',
  /const campionatoRealRows = rows\.filter\(row => modeKindOf\(row\) === 'campionatoReal' && finalPositionOf\(row\) === 1\)/.test(main)
);
check(
  'La copia legacy include la Sfida nei bomber',
  /renderScorers\(rows\);/.test(mirror) && !/renderScorers\(rows\.filter\(row => modeKindOf\(row\) !== 'weekly'\)\)/.test(mirror)
);

console.log(`\n${passed} pass, ${failed} fail`);
process.exitCode = failed ? 1 : 0;
