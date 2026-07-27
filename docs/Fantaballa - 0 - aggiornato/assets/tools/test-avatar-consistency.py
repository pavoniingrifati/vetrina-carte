#!/usr/bin/env python3
from pathlib import Path
import json, re, subprocess, tempfile
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name, condition, detail=''):
    checks.append({'name':name,'ok':bool(condition),'detail':detail})

shared=(ROOT/'assets/creator-avatars.js').read_text()
check('Modulo condiviso presente', 'window.FantaballaCreatorAvatars' in shared)
for rel in ['index.html','giocatori.html','campionato.html','campionato-real.html']:
    text=(ROOT/rel).read_text()
    check(f'{rel} carica modulo condiviso', 'assets/creator-avatars.js' in text)
for rel in ['index.html','giocatori.html','assets/season/04-setup-and-draft.js']:
    text=(ROOT/rel).read_text()
    check(f'{rel} usa renderer condiviso', 'FantaballaCreatorAvatars?.renderSvg' in text)

players=json.loads((ROOT/'data/giocatori.json').read_text())
by_id={str(p.get('id')):p for p in players}
check('Fantaballa dati creator corretti', by_id.get('384',{}).get('creatorStyle')=='fantaballa' and by_id.get('384',{}).get('subscriber')=='no')
check('MisterFM dati creator corretti', by_id.get('852',{}).get('creatorStyle')=='misterfm' and by_id.get('852',{}).get('creator')=='si')

index=(ROOT/'index.html').read_text()
sub_match=re.search(r'const fallbackSubscribers = (\[.*?\]);',index)
creator_match=re.search(r'const fallbackCreators = (\[.*?\]);',index)
subs=json.loads(sub_match.group(1)) if sub_match else []
creators=json.loads(creator_match.group(1)) if creator_match else []
check('Fallback Home: Fantaballa non è abbonato', all(str(p.get('id'))!='384' for p in subs))
check('Fallback Home: Fantaballa è creator', any(str(p.get('id'))=='384' for p in creators))
check('Fallback Home: MisterFM è creator', any(str(p.get('id'))=='852' for p in creators))

node_script=f"""
global.window={{}};
require({json.dumps(str(ROOT/'assets/creator-avatars.js'))});
const api=window.FantaballaCreatorAvatars;
const fant=api.renderSvg({json.dumps(by_id['384'])},{{subscriber:false}});
const mister=api.renderSvg({json.dumps(by_id['852'])},{{subscriber:false}});
console.log(JSON.stringify({{
 fantOk:fant.includes('#79b8dc')&&fant.includes('#30231d'),
 misterOk:mister.includes('#f3bf45')&&mister.includes('stroke=\\\"#524036\\\"'),
 fantLength:fant.length,misterLength:mister.length
}}));
"""
result=subprocess.run(['node','-e',node_script],capture_output=True,text=True,check=True)
render=json.loads(result.stdout.strip())
check('Fantaballa renderer: capelli laterali, occhi azzurri, barba',render['fantOk'],str(render))
check('MisterFM renderer: berretto, occhiali, barba',render['misterOk'],str(render))

report={'summary':{'passed':sum(c['ok'] for c in checks),'total':len(checks),'failed':sum(not c['ok'] for c in checks)},'checks':checks}
(ROOT/'TEST-COERENZA-FACCINE.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
raise SystemExit(0 if report['summary']['failed']==0 else 1)
