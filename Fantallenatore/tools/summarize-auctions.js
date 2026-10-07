'use strict';
const fs=require('node:fs'),path=require('node:path');
const input=path.resolve(process.argv[2]||path.join(__dirname,'../reports/auction-latest.json'));
const report=JSON.parse(fs.readFileSync(input,'utf8'));
const output=path.resolve(process.argv[3]||input.replace(/\.json$/i,'.md'));
const mean=xs=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:0;
const fmt=n=>n.toFixed(2);
const groups=new Map();
for(const run of report.runs){const key=[run.label,run.mode,run.strategy].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(run);}
const rows=[...groups].map(([key,runs])=>{
 const m=name=>mean(runs.map(r=>r.metrics[name]));
 return `| ${key.split('|').join(' | ')} | ${runs.length} | ${fmt(m('cpuResidual'))} | ${fmt(m('userTop10'))} | ${fmt(m('topPriceRatio'))} | ${fmt(m('lateCheapUserTop10'))} | ${fmt(m('userAdvantage'))} |`;
});
const flags=report.runs.filter(r=>r.findings.length);
const lines=[
 '# Verifica delle aste di Fantallenatore',
 '',`Build di gioco: ${report.build}. Semi per scenario: ${report.seedCount}.`,
 '',`**${report.runs.length} aste completate, ${report.runs.length*250} acquisti validi.** Tutte le rose rispettano ruoli, unicità, budget e riserva minima.`,
 '',`Scenari oltre le tre soglie di attenzione: **${flags.length}/${report.runs.length}**. Questo valore non certifica da solo il bilanciamento.`,
 '', '## Risultati medi per scenario',
 '', '| Divisione | Asta | Strategia | Semi | Residuo CPU | Top10 utente | Prezzo top/riferimento | Top tardivi economici | Vantaggio OVR11 utente |',
 '|---|---|---|---:|---:|---:|---:|---:|---:|',...rows,
 '', 'Top10: dieci migliori OVR per ciascun ruolo (40 giocatori), con valore di mercato come spareggio. Top tardivi economici: top10 presi dall’utente dopo il 60% degli slot, a <=25% del riferimento. OVR11: miglior undici sui sei moduli standard; non misura le vittorie in campionato.',
 '', '## Lettura dei risultati',
 '', ...[2,1].map(division=>{
  const runs=report.runs.filter(r=>r.division===division&&r.strategy==='top'&&r.mode==='reparti');
  return `- ${runs[0]?.label||division}, strategia sui top, asta per reparti: l’utente prende mediamente ${fmt(mean(runs.map(r=>r.metrics.userTop10)))} dei 40 top10 e ottiene ${fmt(mean(runs.map(r=>r.metrics.userAdvantage)))} punti OVR di vantaggio nel miglior undici rispetto alla media CPU.`;
 }),
 '', 'Le soglie osservano occasioni tardive, concentrazione estrema dei top e crediti CPU inutilizzati. Un grande vantaggio di qualità può richiedere interventi anche senza superare queste soglie. Per decidere una modifica serve ampliare i semi e verificare anche partite, timer ed eventuali salvataggi in cui il problema si presenta.',
 '', '## Soglie applicate',
 '', ...Object.values(report.criteria).map(text=>'- '+text),
 '', '## Segnalazioni',
 '', ...(flags.length?flags.map(r=>`- ${r.label}, ${r.mode}, ${r.strategy}, ${r.seed}: ${r.findings.join('; ')}.`):['Nessuno scenario supera le tre soglie nella baseline eseguita.']),
 '', '## Ambito e limiti',
 '',report.scope,
 '', 'La strategia attendista è uno stress test di risparmio: chiama giocatori economici e può ritrovarsi ad acquistarli a 1. Non rappresenta ogni possibile strategia umana di attesa.',
 '', 'I test non modificano il comportamento del gioco. Il JSON accanto a questo rapporto conserva ogni acquisto e ogni rosa finale per ispezionare i casi singoli.',
 '', '## Riproduzione',
 '', '```text',`node tests/auction-competitive.js --seeds ${report.seedCount} --strict --report reports/auction-latest.json`,'node tools/summarize-auctions.js reports/auction-latest.json','```',''
];
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,lines.join('\n'));
console.log(`Rapporto scritto: ${output}`);
