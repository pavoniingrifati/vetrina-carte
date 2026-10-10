"""Conservative CSS consolidation. Removes declarations superseded by identical
selectors, conditions and priority. Later values must be identical or belong to
an explicit whitelist of supported literals; keeps dynamic/novel fallbacks and order.
Run --check to verify the single runtime stylesheet matches its sources.
"""
from pathlib import Path
import re, json, sys
ROOT=Path(__file__).resolve().parent.parent

def segments(text, start, end, delimiters):
    quote=None; comment=False; depth=0; i=start; begin=start
    while i<end:
        c=text[i]
        if comment:
            if text[i:i+2]=='*/': comment=False; i+=2; continue
        elif quote:
            if c=='\\': i+=2; continue
            if c==quote: quote=None
        elif text[i:i+2]=='/*': comment=True; i+=2; continue
        elif c in '\"\'': quote=c
        elif c in '([': depth+=1
        elif c in ')]': depth-=1
        elif depth==0 and c in delimiters:
            yield begin,i,c; begin=i+1
        i+=1
    yield begin,end,''

def normalized(s):
    return re.sub(r'/\*.*?\*/','',s,flags=re.S).strip()

def definitive(prop, value):
    value=re.sub(r'!\s*important\s*$', '',value,flags=re.I).strip().lower()
    number=r'(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|vh|vw|%))'
    if prop in ('padding','padding-top','padding-right','padding-bottom','padding-left','gap','row-gap','column-gap','border-radius'):
        count=4 if prop in ('padding','border-radius') else 2 if prop=='gap' else 1
        return bool(re.fullmatch(number+r'(?:\s+'+number+r'){0,'+str(count-1)+'}',value))
    if prop in ('margin','margin-top','margin-right','margin-bottom','margin-left'):
        count=4 if prop=='margin' else 1
        return bool(re.fullmatch(r'(?:auto|-?'+number+r')(?:\s+(?:auto|-?'+number+r')){0,'+str(count-1)+'}',value))
    if prop in ('width','height','min-width','min-height','max-width','max-height','font-size'):
        return bool(re.fullmatch(number,value)) or (prop!='font-size' and value=='auto' and not prop.startswith('max-')) or (prop.startswith('max-') and value=='none')
    if prop in ('color','background-color','border-color'):
        return bool(re.fullmatch(r'#[0-9a-f]{3}(?:[0-9a-f]{3})?',value)) or value in ('transparent','white','black','inherit','currentcolor')
    choices={'display':('none','block','inline','inline-block','flex','inline-flex','grid','inline-grid'), 'position':('static','relative','absolute','fixed','sticky'), 'overflow':('hidden','auto','scroll','visible'), 'text-align':('left','right','center','justify'), 'font-weight':('normal','bold','100','200','300','400','500','600','700','800','900')}
    if prop in choices:return value in choices[prop]
    if prop=='z-index':return bool(re.fullmatch(r'-?\d+|auto',value))
    if prop=='opacity':return bool(re.fullmatch(r'0(?:\.\d+)?|1(?:\.0+)?|\.\d+',value))
    return False

def rules(text, start=0, end=None, context=()):
    end=len(text) if end is None else end
    parts=list(segments(text,start,end,'{};')); index=0; header=start
    while index<len(parts):
        a,b,delimiter=parts[index]
        if delimiter==';': header=b+1; index+=1; continue
        if delimiter!='{': index+=1; continue
        selector=normalized(text[header:b]); level=1; j=index+1
        while j<len(parts) and level:
            if parts[j][2]=='{':level+=1
            elif parts[j][2]=='}':level-=1
            j+=1
        if level: raise ValueError('Unbalanced CSS block')
        close=parts[j-1][1]
        if selector.startswith(('@media','@supports','@container','@layer','@document')):
            yield from rules(text,b+1,close,context+(selector,))
        elif not selector.startswith('@') and not any('@keyframes' in c for c in context):
            for da,db,delim in segments(text,b+1,close,';'):
                raw=text[da:db]; clean=normalized(raw)
                if not clean:continue
                pair=list(segments(clean,0,len(clean),':'))
                if len(pair)<2:continue
                prop=clean[:pair[0][1]].strip()
                val=clean[pair[0][1]+1:].strip()
                important=bool(re.search(r'!\s*important\s*$',val,re.I))
                # Keep comments, remove only the declaration, including its semicolon.
                lead=0
                while lead<len(raw):
                    if raw[lead].isspace():lead+=1;continue
                    if raw[lead:lead+2]=='/*':
                        stop=raw.find('*/',lead+2)
                        if stop<0:break
                        lead=stop+2;continue
                    break
                yield (context,selector,prop,important,val),da+lead,db+(delim==';')
        header=close+1; index=j

def selector_members(selector):
    # Split only top-level lists, never commas inside :is(), attributes or strings.
    return tuple(dict.fromkeys(normalized(selector[a:b])
        for a,b,_ in segments(selector,0,len(selector),',')))

def property_slots(prop,value):
    # Only expand literals already accepted by the conservative whitelist.
    # Dynamic values and unsupported fallbacks remain opaque and are retained.
    clean=re.sub(r'!\s*important\s*$', '',value,flags=re.I).strip()
    if prop in ('margin','padding') and definitive(prop,value):
        tokens=clean.split()
        sides=([tokens[0]]*4 if len(tokens)==1 else
               [tokens[0],tokens[1],tokens[0],tokens[1]] if len(tokens)==2 else
               [tokens[0],tokens[1],tokens[2],tokens[1]] if len(tokens)==3 else tokens)
        return tuple((prop+'-'+side,v) for side,v in zip(('top','right','bottom','left'),sides))
    if prop=='gap' and definitive(prop,value):
        tokens=clean.split()
        return (('row-gap',tokens[0]),('column-gap',tokens[-1]))
    return ((prop,clean),)

def consolidate(sources):
    records=[];history={};removals={file:[] for file in sources}
    for file,source in sources.items():
        for key,a,b in rules(source):
            context,selector,prop,important,value=key
            members=selector_members(selector)
            slots=property_slots(prop,value)
            keys={(context,member,p,important) for member in members for p,_ in slots}
            record={'file':file,'a':a,'b':b,'keys':keys,'shadowed':set()}
            records.append(record)
            for member in members:
                for p,v in slots:
                    base=(context,member,p,important)
                    previous=history.get(base,[])
                    if definitive(p,v):
                        victims=previous;history[base]=[]
                    else:
                        victims=[entry for entry in previous if entry[1]==v]
                        history[base]=[entry for entry in previous if entry[1]!=v]
                    for old,_ in victims:old['shadowed'].add(base)
                    history[base].append((record,v))
    # A grouped/shorthand declaration is removable only when ALL its effects
    # are superseded within the same condition and priority. Order stays intact.
    for record in records:
        if record['keys']==record['shadowed']:
            removals[record['file']].append((record['a'],record['b']))
    optimized={}
    for file,source in sources.items():
        for a,b in sorted(removals[file],reverse=True):source=source[:a]+source[b:]
        optimized[file]=source
    return optimized,removals

def main():
    files=re.findall(r"@import url\('([^']+)'\)", (ROOT/'styles_v302.css').read_text())
    sources={file:(ROOT/file).read_text() for file in files}
    optimized,removals=consolidate(sources)
    compiled='/* Generated by tools/consolidate-css.py. Edit css/modules, then rebuild. */\n'
    for file,source in optimized.items():
        source=re.sub(r'(url\(\s*[\"\']?)\.\./\.\./',r'\1../',source)
        compiled+='\n/* '+file+' */\n'+source+'\n'
    output=ROOT/'css/game.css'
    if '--check' in sys.argv:
        assert not any(removals.values()), 'CSS sources contain superseded declarations: rebuild first'
        assert output.read_text()==compiled, 'CSS build is stale'
    elif '--dry-run' not in sys.argv:
        for file,source in optimized.items():(ROOT/file).write_text(source)
        output.write_text(compiled)
        (ROOT/'css/manifest.json').write_text(json.dumps({'files':files,'runtime':'css/game.css'},indent=2)+'\n')
    print(json.dumps({'removedDeclarations':sum(map(len,removals.values())),
        'removedImportant':sum(len(re.findall(r'!\s*important',sources[f][a:b],re.I)) for f,ranges in removals.items() for a,b in ranges),
        'runtimeImportant':len(re.findall(r'!\s*important',compiled,re.I))}))

if __name__=='__main__':main()
