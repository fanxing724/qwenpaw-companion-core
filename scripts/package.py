"""Build an installable ZIP with one companion-core/ root directory."""
import json
from pathlib import Path
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'plugin.json').read_text(encoding='utf-8'))
version = manifest['version']
required = ['plugin.py', 'organizer.py', 'file_backfill.py', 'companion_features.py', 'care.py', 'plugin.json', 'README.md',
            'RELEASE.md', 'ROADMAP.md', 'FEATURES.md', 'HOST_VALIDATION.md', '待办清单.md', 'SKILL.md', 'CHANGELOG.md', 'LICENSE']
for name in required + list(manifest['entry'].values()):
    file = root / name
    if not file.is_file() or not file.stat().st_size:
        raise SystemExit(f'Missing or empty required file: {name}')
output = Path(sys.argv[1] if len(sys.argv) > 1 else root / 'dist')
output.mkdir(parents=True, exist_ok=True)
archive = output / f'companion-core-{version}.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for name in required + ['data', 'ui']:
        source = root / name
        files = sorted(source.rglob('*')) if source.is_dir() else [source]
        for file in files:
            if file.is_file() and '__pycache__' not in file.parts:
                bundle.write(file, 'companion-core/' + file.relative_to(root).as_posix())
print(archive)
