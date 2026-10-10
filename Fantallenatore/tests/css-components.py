"""Regression checks for component ownership and preserved cascade order."""
import importlib.util
import json
from pathlib import Path
import tempfile

spec = importlib.util.spec_from_file_location('builder', Path(__file__).resolve().parents[1] / 'tools/build-css.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    (root / 'css/modules').mkdir(parents=True)
    a = root / 'css/modules/auction.css'
    b = root / 'css/modules/shared.css'
    a.write_text('/* owner */\n/* @section base */\n.bid{color:red}\n/* @section final */\n.bid{color:blue;background:url(../../assets/x.svg)}\n')
    b.write_text('/* @section middle */\n.bid{color:green}\n')
    manifest = {
        'version': 2, 'runtime': 'css/game.css',
        'files': ['css/modules/auction.css', 'css/modules/shared.css'],
        'sections': [
            {'id': 'base', 'file': 'css/modules/auction.css'},
            {'id': 'middle', 'file': 'css/modules/shared.css'},
            {'id': 'final', 'file': 'css/modules/auction.css'},
        ]
    }

    def write_manifest(value):
        (root / 'css/manifest.json').write_text(json.dumps(value))

    def reject(change, message):
        invalid = json.loads(json.dumps(manifest))
        change(invalid)
        write_manifest(invalid)
        try:
            builder.compile_css(root)
        except ValueError as error:
            assert message in str(error), error
        else:
            raise AssertionError('Invalid manifest accepted')
        write_manifest(manifest)

    write_manifest(manifest)
    originals = (a.read_bytes(), b.read_bytes())
    result = builder.compile_css(root)
    assert result.index('color:red') < result.index('color:green') < result.index('color:blue')
    assert 'url(../assets/x.svg)' in result
    assert originals == (a.read_bytes(), b.read_bytes()), 'Build rewrote source files'
    assert builder.compile_css(root) == result, 'Build is not deterministic'
    reject(lambda m: m['sections'].append(m['sections'][0]), 'Duplicate or missing')
    reject(lambda m: m['sections'].pop(), 'Unordered CSS sections')
    reject(lambda m: m['sections'][0].update(file='css/modules/shared.css'), 'Wrong owner')
    reject(lambda m: m['sections'][0].update(id='missing'), 'Duplicate or missing')
    reject(lambda m: m['files'].append(m['files'][0]), 'Duplicate CSS source')
    a.write_text(a.read_text() + '\n/* @section middle */\n.x{color:red}')
    try:
        builder.compile_css(root)
    except ValueError as error:
        assert 'Duplicate CSS section' in str(error)
    else:
        raise AssertionError('Duplicate source section accepted')
    a.write_bytes(originals[0])
    a.write_text('.lost{color:red}\n' + a.read_text())
    try:
        builder.compile_css(root)
    except ValueError as error:
        assert 'Rules outside sections' in str(error)
    else:
        raise AssertionError('Unowned rules silently dropped')
    a.write_bytes(originals[0])
    (root / 'css/modules/orphan.css').write_text('/* @section orphan */\n.x{}')
    try:
        builder.compile_css(root)
    except ValueError as error:
        assert 'missing from manifest' in str(error)
    else:
        raise AssertionError('Unregistered source accepted')

print('OK: component order, source ownership, deterministic non-destructive builds, assets and invalid manifests.')
