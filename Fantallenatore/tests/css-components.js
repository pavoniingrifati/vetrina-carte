'use strict';
const {spawnSync}=require('node:child_process'),path=require('node:path');
const result=spawnSync('python3',[path.join(__dirname,'css-components.py')],{encoding:'utf8'});
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
if(result.error)throw result.error;
process.exitCode=result.status??1;
