#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = { window: {} };
context.window = context;
vm.createContext(context);

let handlers = fs.readFileSync(path.join(root, 'assets/season/event-handlers.js'), 'utf8');
handlers += '\nwindow.SEASON_EVENT_HANDLER_IDS = SEASON_EVENT_HANDLER_IDS;';
vm.runInContext(handlers, context, { filename: 'event-handlers.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'assets/event-validator.js'), 'utf8'), context, { filename: 'event-validator.js' });

const catalogs = ['common', 'community', 'real'].map(name =>
  JSON.parse(fs.readFileSync(path.join(root, `data/events/events-${name}.json`), 'utf8'))
);
const strictBaseline = process.argv.includes('--strict-baseline');
const report = context.FantaballaEventValidator.validateCatalogs(catalogs, context.SEASON_EVENT_HANDLER_IDS, { strictCounts: strictBaseline });
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.ok ? 0 : 1;
