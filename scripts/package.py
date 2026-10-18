"""Build an installable ZIP with one companion-core/ root directory."""
import argparse
import json
from pathlib import Path
import shutil
import zipfile

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'plugin.json').read_text(encoding='utf-8'))
version = manifest['version']
# Ship only files useful to end users; dev-process docs (ROADMAP.md and
# friends) stay in the repo but out of the installable package.
required = ['plugin.py', 'organizer.py', 'file_backfill.py', 'companion_features.py', 'care.py', 'life.py', 'checkup.py', 'diary.py', 'plan.py', 'weekly.py', 'backup.py', 'plugin.json', 'README.md',
            'RELEASE.md', 'FEATURES.md', 'SKILL.md', 'CHANGELOG.md', 'LICENSE']
for name in required + list(manifest['entry'].values()):
    file = root / name
    if not file.is_file() or not file.stat().st_size:
        raise SystemExit(f'Missing or empty required file: {name}')

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', nargs='?', default=root / 'dist', type=Path,
                    help='output directory (default: dist/)')
parser.add_argument('--dir', action='store_true',
                    help='also materialize the unpacked plugin tree at OUTPUT/companion-core/; '
                         'CI uploads it as a single-wrap artifact that installs directly after download')
args = parser.parse_args()

output = args.output
output.mkdir(parents=True, exist_ok=True)


def bundled_files():
    for name in required + ['data', 'ui']:
        source = root / name
        files = sorted(source.rglob('*')) if source.is_dir() else [source]
        for file in files:
            if file.is_file() and '__pycache__' not in file.parts:
                yield file


archive = output / f'companion-core-{version}.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for file in bundled_files():
        bundle.write(file, 'companion-core/' + file.relative_to(root).as_posix())
print(archive)

if args.dir:
    target = output / 'companion-core'
    if target.exists():
        shutil.rmtree(target)
    for file in bundled_files():
        destination = target / file.relative_to(root)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file, destination)
    print(target)
