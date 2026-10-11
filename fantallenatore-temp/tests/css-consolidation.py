"""Cascade regression fixtures for the CSS source consolidation tool."""
from pathlib import Path
import importlib.util
spec=importlib.util.spec_from_file_location('css_build',Path(__file__).resolve().parents[1]/'tools/consolidate-css.py')
css=importlib.util.module_from_spec(spec);spec.loader.exec_module(css)
def optimized(source):return css.consolidate({'fixture.css':source})[0]['fixture.css']
def check(source,expected):
 actual=optimized(source)
 assert actual==expected,(source,actual,expected)
# Supported literals override only after every member has a replacement.
check('.a,.b{color:#111}.a{color:#222}', '.a,.b{color:#111}.a{color:#222}')
check('.a,.b{color:#111}.a{color:#222}.b{color:#333}', '.a,.b{}.a{color:#222}.b{color:#333}')
check('.b,.a{display:block}.a,.b{display:flex}', '.b,.a{}.a,.b{display:flex}')
# A shorthand must retain uncovered sides; expand 1/2/3/4 tokens correctly.
check('.a{padding:4px 8px}.a{padding-top:0}', '.a{padding:4px 8px}.a{padding-top:0}')
check('.a{padding:4px 8px}.a{padding-top:0;padding-right:0;padding-bottom:0;padding-left:0}', '.a{}.a{padding-top:0;padding-right:0;padding-bottom:0;padding-left:0}')
assert dict(css.property_slots('margin','1px 2px 3px'))=={'margin-top':'1px','margin-right':'2px','margin-bottom':'3px','margin-left':'2px'}
assert dict(css.property_slots('gap','4px 8px !important'))=={'row-gap':'4px','column-gap':'8px'}
# Priorities and responsive conditions cannot be mixed.
source='.a{display:block!important}.a{display:flex}@media(max-width:600px){.a{display:grid!important}}'
check(source,source)
source='@media(max-width:600px){.a{display:block}}@media(max-width:601px){.a{display:flex}}'
check(source,source)
# Unknown values may be fallbacks; commas in functions/attributes stay opaque.
check('.a{display:block}.a{display:future-layout}', '.a{display:block}.a{display:future-layout}')
check('.a{padding:var(--space)}.a{padding-top:0}', '.a{padding:var(--space)}.a{padding-top:0}')
assert css.selector_members(':is(.a,.b),[data-label="a,b"]')==(':is(.a,.b)','[data-label="a,b"]')
source='@keyframes slide{from{opacity:0}to{opacity:1}}'
check(source,source)
source='/* A */.a,.b{display:block;/* B */color:#111}.a{display:flex}.b{display:grid}'
assert '/* A */' in optimized(source) and '/* B */' in optimized(source)
result=optimized('.a,.b{margin:0!important}.a{margin:1px!important}.b{margin:2px!important}')
assert optimized(result)==result,'second pass must not alter optimized CSS'
print('OK: grouped selectors, shorthand coverage, priorities, media conditions, fallbacks, keyframes and idempotence.')
