'use strict';
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const result=spawnSync('python3',[path.join(__dirname,'css-consolidation.py')],{encoding:'utf8'});
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
if(result.error)throw result.error;
if(result.status!==0){process.exitCode=result.status??1;}else{
 const check=spawnSync('python3',[path.join(__dirname,'../tools/consolidate-css.py'),'--check'],{encoding:'utf8'});
 process.stdout.write(check.stdout||'');process.stderr.write(check.stderr||'');
 if(check.error)throw check.error;process.exitCode=check.status??1;
}
