"""Find selector owners in runtime cascade order: python3 tools/find-css.py .lineup-slot"""
import argparse
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('selector', help='Selector text to search for')
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('css_parser', ROOT / 'tools/consolidate-css.py')
    css = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(css)
    builder_spec = importlib.util.spec_from_file_location('css_builder', ROOT / 'tools/build-css.py')
    builder = importlib.util.module_from_spec(builder_spec)
    builder_spec.loader.exec_module(builder)
    manifest = json.loads((ROOT / 'css/manifest.json').read_text())
    sources = {file: (ROOT / file).read_text() for file in manifest['files']}
    matches = 0
    for order, entry in enumerate(manifest['sections'], 1):
        file, section = entry['file'], entry['id']
        source = sources[file]
        markers = list(builder.MARKER.finditer(source))
        for i, marker in enumerate(markers):
            if marker.group(1) != section:
                continue
            end = markers[i + 1].start() if i + 1 < len(markers) else len(source)
            body = source[marker.end():end]
            seen = set()
            for (context, selector, *_), start, _ in css.rules(body):
                if args.selector not in selector or (context, selector) in seen:
                    continue
                seen.add((context, selector))
                line = source.count('\n', 0, marker.end() + start) + 1
                conditions = ' > '.join(context) or 'all viewports'
                print(f'{order:04d} {file}:{line} [{section}] {conditions}\n     {selector}')
                matches += 1
    if not matches:
        parser.exit(1, 'No matching selector found.\n')


if __name__ == '__main__':
    main()
