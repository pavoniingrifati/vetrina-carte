#!/usr/bin/env python3
"""Audit statico degli asset di Fantaballa 0.

Controlla riferimenti locali, file mancanti, immagini pesanti, duplicati esatti e file non usati.
Non modifica il progetto.
"""
from __future__ import annotations
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlsplit, unquote
import hashlib, json, re, sys

ROOT = Path(__file__).resolve().parents[1]
TEXT_EXTS = {'.html','.css','.js','.json','.xml','.webmanifest'}
ASSET_EXTS = {'.png','.jpg','.jpeg','.webp','.gif','.svg','.ico','.woff','.woff2','.otf','.ttf'}
IMAGE_EXTS = {'.png','.jpg','.jpeg','.webp','.gif','.svg','.ico'}
SIZE_WARNING = 500 * 1024

ATTR_RE = re.compile(r'''(?:src|href)\s*=\s*["']([^"']+)["']''', re.I)
CSS_RE = re.compile(r'''url\(\s*["']?([^"')]+)["']?\s*\)''', re.I)
CONFIG_IMAGE_RE = re.compile(r'''(?:image|icon)\s*:\s*["']([^"']+\.(?:png|jpe?g|webp|gif|svg|ico))["']''', re.I)


def normalized_local_ref(raw: str) -> str | None:
    raw = raw.strip()
    if not raw or raw.startswith(('#','data:','javascript:','mailto:','tel:')) or '${' in raw:
        return None
    parsed = urlsplit(raw)
    if parsed.scheme in {'http','https'}:
        # Treat links to the same public site as local files.
        if parsed.netloc.lower() not in {'fantaballa.it','www.fantaballa.it'}:
            return None
        path = unquote(parsed.path).lstrip('/')
        prefix='Fantaballa - 0/'
        if path.startswith(prefix): path=path[len(prefix):]
        return path or None
    if parsed.scheme:
        return None
    path=unquote(parsed.path).replace('\\','/').lstrip('./').lstrip('/')
    return path or None


def scan_references() -> dict[str,list[str]]:
    refs: dict[str,list[str]] = defaultdict(list)
    for source in ROOT.rglob('*'):
        if not source.is_file() or source.suffix.lower() not in TEXT_EXTS:
            continue
        text=source.read_text('utf-8',errors='ignore')
        values=[]
        values += ATTR_RE.findall(text)
        values += CSS_RE.findall(text)
        if source.suffix.lower()=='.js': values += CONFIG_IMAGE_RE.findall(text)
        for raw in values:
            ref=normalized_local_ref(raw)
            if not ref: continue
            suffix=Path(ref).suffix.lower()
            # Keep files/pages/data only if they look like a concrete resource.
            if suffix not in ASSET_EXTS and suffix not in {'.json','.js','.html','.webmanifest'}:
                continue
            refs[ref].append(source.relative_to(ROOT).as_posix())
    return refs


def sha256(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk)
    return h.hexdigest()


def main() -> int:
    refs=scan_references()
    missing=[]
    for ref,sources in sorted(refs.items()):
        if not (ROOT/ref).is_file(): missing.append({'path':ref,'sources':sorted(set(sources))})

    assets=[]
    hashes=defaultdict(list)
    for p in ROOT.rglob('*'):
        if not p.is_file() or p.suffix.lower() not in ASSET_EXTS: continue
        rel=p.relative_to(ROOT).as_posix(); size=p.stat().st_size
        digest=sha256(p); hashes[digest].append(rel)
        assets.append({'path':rel,'bytes':size,'referenced':rel in refs,'sources':sorted(set(refs.get(rel,[])))})

    duplicates=[]
    for digest,paths in hashes.items():
        if len(paths)>1:
            duplicates.append({'sha256':digest,'paths':sorted(paths),'duplicate_bytes':sum((ROOT/p).stat().st_size for p in paths[1:])})

    heavy=sorted([a for a in assets if a['bytes']>SIZE_WARNING],key=lambda x:x['bytes'],reverse=True)
    unused=sorted([a['path'] for a in assets if not a['referenced'] and not a['path'].startswith(('site-icon-','apple-touch-icon','favicon'))])
    total=sum(a['bytes'] for a in assets)
    report={
      'root':str(ROOT),'asset_count':len(assets),'asset_bytes':total,
      'reference_count':len(refs),'missing':missing,'heavy':heavy,'duplicates':duplicates,'unused':unused,
      'status':'ok' if not missing and not duplicates and not heavy else 'warning'
    }
    (ROOT/'ASSET-AUDIT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')

    lines=['# Audit asset Fantaballa 0','',f'- Asset trovati: **{len(assets)}**',f'- Peso totale asset: **{total/1024/1024:.2f} MB**',f'- Riferimenti locali controllati: **{len(refs)}**',f'- File mancanti: **{len(missing)}**',f'- Immagini oltre 500 KB: **{len(heavy)}**',f'- Gruppi duplicati esatti: **{len(duplicates)}**',f'- Asset potenzialmente inutilizzati: **{len(unused)}**','']
    if missing:
        lines += ['## File mancanti','']+[f"- `{x['path']}` — riferito da {', '.join(x['sources'])}" for x in missing]+['']
    if heavy:
        lines += ['## Asset pesanti','']+[f"- `{x['path']}` — {x['bytes']/1024:.1f} KB" for x in heavy]+['']
    if duplicates:
        lines += ['## Duplicati esatti','']+[f"- {', '.join('`'+p+'`' for p in x['paths'])}" for x in duplicates]+['']
    if unused:
        lines += ['## Potenzialmente inutilizzati','']+[f'- `{p}`' for p in unused]+['']
    if not missing and not heavy and not duplicates:
        lines += ['## Esito','', 'Nessun riferimento rotto, duplicato esatto o asset oltre la soglia di 500 KB.','']
    (ROOT/'ASSET-AUDIT.md').write_text('\n'.join(lines),'utf-8')
    print(json.dumps({k:report[k] for k in ['asset_count','asset_bytes','reference_count','status']},ensure_ascii=False))
    if missing:
        for x in missing: print('MISSING',x['path'],file=sys.stderr)
    return 1 if missing else 0

if __name__=='__main__': raise SystemExit(main())
