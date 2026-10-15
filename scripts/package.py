"""Build an installable ZIP with one companion-core/ root directory."""
import json
from pathlib import Path
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'plugin.json').read_text(encoding='utf-8'))['version']
output = Path(sys.argv[1] if len(sys.argv) > 1 else root / 'dist')
output.mkdir(parents=True, exist_ok=True)
archive = output / f'companion-core-{version}.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for name in ['plugin.py', 'plugin.json', 'requirements.txt', 'README.md',
                 'SKILL.md', 'CHANGELOG.md', 'LICENSE', 'data', 'ui']:
        source = root / name
        files = sorted(source.rglob('*')) if source.is_dir() else [source]
        for file in files:
            if file.is_file() and '__pycache__' not in file.parts:
                bundle.write(file, 'companion-core/' + file.relative_to(root).as_posix())
print(archive)
