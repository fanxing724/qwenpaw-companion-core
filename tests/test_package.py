"""Verify the actual distributable contains its description, license and entries."""
import json
from pathlib import Path
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def test_package_metadata_and_license(tmp_path):
    subprocess.run([sys.executable, str(ROOT / 'scripts/package.py'), str(tmp_path)], check=True)
    manifest = json.loads((ROOT / 'plugin.json').read_text(encoding='utf-8'))
    with zipfile.ZipFile(tmp_path / f"companion-core-{manifest['version']}.zip") as archive:
        assert archive.testzip() is None
        assert all(name.startswith('companion-core/') for name in archive.namelist())
        for name in ['plugin.json', 'README.md', 'RELEASE.md', 'ROADMAP.md', 'FEATURES.md', 'HOST_VALIDATION.md', '待办清单.md', 'care.py', 'companion_features.py', 'file_backfill.py', 'CHANGELOG.md', 'LICENSE'] + list(manifest['entry'].values()):
            assert archive.read('companion-core/' + name)
        assert b'MIT License' in archive.read('companion-core/LICENSE')
        assert json.loads(archive.read('companion-core/plugin.json'))['license'] == 'MIT'


def test_packaged_skill_matches_manifest(tmp_path):
    subprocess.run([sys.executable, str(ROOT / 'scripts/package.py'), str(tmp_path)], check=True)
    manifest = json.loads((ROOT / 'plugin.json').read_text(encoding='utf-8'))
    with zipfile.ZipFile(tmp_path / f"companion-core-{manifest['version']}.zip") as archive:
        skill = archive.read('companion-core/SKILL.md').decode('utf-8')
        assert f"version: {manifest['version']}\n" in skill
        assert f"（v{manifest['version']}）" in skill
        for placeholder in ['{{AGENT_NAME}}', '{{USER_NAME}}', '{{USER_NICKNAME}}']:
            assert placeholder not in skill
