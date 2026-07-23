#!/usr/bin/env python3
import json, mimetypes
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
BASE='https://fantaballa.local'
SHIM='''<script>(()=>{class MemoryStorage{constructor(){this.map=new Map()}get length(){return this.map.size}key(i){return [...this.map.keys()][i]??null}getItem(k){k=String(k);return this.map.has(k)?this.map.get(k):null}setItem(k,v){this.map.set(String(k),String(v))}removeItem(k){this.map.delete(String(k))}clear(){this.map.clear()}}try{localStorage.setItem('__probe__','1');localStorage.removeItem('__probe__')}catch{Object.defineProperty(window,'localStorage',{configurable:true,value:new MemoryStorage()})}})();</script>'''

def route(page):
 def handler(r):
  parsed=urlparse(r.request.url); rel=unquote(parsed.path.lstrip('/')) or 'index.html'; target=(ROOT/rel).resolve()
  try: target.relative_to(ROOT.resolve())
  except ValueError: r.abort(); return
  if not target.is_file(): r.fulfill(status=404,body='Not found'); return
  r.fulfill(status=200,body=target.read_bytes(),content_type=mimetypes.guess_type(target.name)[0] or 'application/octet-stream',headers={'Access-Control-Allow-Origin':'*'})
 page.route(f'{BASE}/**',handler)

def load(page):
 route(page); html=(ROOT/'campionato-real.html').read_text(); html=html.replace('<head>',f'<head><base href="{BASE}/">{SHIM}',1); page.set_content(html,wait_until='load',timeout=30000)

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--allow-file-access-from-files','--disable-web-security'])
 page=browser.new_page()
 load(page)
 page.wait_for_function("typeof state !== 'undefined' && PLAYERS.length>0 && CLUBS.length>0")
 page.evaluate('''() => {state=normalizeCampionatoState(freshState());state.teamName='Quota test';state.coachName='Tester';state.phase='setup';if(!buildFullyRandomDraftRoster())throw new Error('draft');const old=Math.random;Math.random=()=>0;try{finalizeDraft()}finally{Math.random=old}}''')
 result=page.evaluate('''() => {
   const before=localStorage.getItem(AUTO_SAVE_KEY);
   localStorage.setItem(SAVE_BACKUP_KEY,before||'{}');
   const original=localStorage.setItem.bind(localStorage);let thrown=false;
   localStorage.setItem=(key,value)=>{if(String(key)===String(AUTO_SAVE_KEY)&&localStorage.getItem(SAVE_BACKUP_KEY)&&!thrown){thrown=true;throw new DOMException('quota test','QuotaExceededError')}return original(key,value)};
   const ok=save();
   localStorage.setItem=original;
   const primary=localStorage.getItem(AUTO_SAVE_KEY);
   return {ok,thrown,primaryValid:Boolean(primary&&decodeStoredSave(primary)?.state),tempExists:Boolean(localStorage.getItem(SAVE_TEMP_KEY)),backupExists:Boolean(localStorage.getItem(SAVE_BACKUP_KEY)),rawChars:primary?.length||0};
 }''')
 print(json.dumps(result,ensure_ascii=False))
 assert result['ok'] and result['thrown'] and result['primaryValid'] and not result['tempExists']
 browser.close()
