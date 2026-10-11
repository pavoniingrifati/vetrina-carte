'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),head=html.match(/<head>([\s\S]*?)<\/head>/)[1];
const meta=new Map();for(const m of head.matchAll(/<meta\s+(?:name|property)="([^"]+)"\s+content="([^"]*)"/g)){assert(!meta.has(m[1]),'Duplicate meta '+m[1]);meta.set(m[1],m[2]);}
const title='Fantallenatore – Il videogioco sul fantacalcio',description='Fai l’asta, usa poteri, batti i rivali e vinci il Fantacalcio! Gioca dal browser o installa Fantallenatore sul telefono.';
assert(head.includes('<title>'+title+'</title>'));
for(const key of ['og:title','twitter:title'])assert.equal(meta.get(key),title);
for(const key of ['description','og:description','twitter:description'])assert.equal(meta.get(key),description);
assert.equal(meta.get('og:url'),'https://fantaballa.it/fantallenatore');
const url=new URL(meta.get('og:image'));assert.equal(url.protocol,'https:');assert.equal(url.hostname,'fantaballa.it');assert.equal(meta.get('twitter:image'),url.href);assert.equal(meta.get('twitter:card'),'summary_large_image');
const file=fs.readFileSync(path.join(root,'assets/social/og-fantallenatore.png'));assert.equal(file.readUInt32BE(16),Number(meta.get('og:image:width')));assert.equal(file.readUInt32BE(20),Number(meta.get('og:image:height')));assert(file.length<5*1024*1024);
const faq=html.match(/<div class="setup-home-faq">([\s\S]*?)<\/div>/)[1];assert.equal((faq.match(/<details>/g)||[]).length,5);assert(faq.includes('Aggiungi alla schermata Home')&&faq.includes('salvataggi separati da Safari'));
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');assert(!sw.includes('assets/social/'),'Social image is not part of offline game download');
console.log('OK: static SEO and social metadata, public absolute image URL, PNG dimensions and HTML FAQs.');
