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
        assert not any(Path(name).name in {'requirements.txt', 'requirements-dev.txt'} for name in archive.namelist())
        assert json.loads(archive.read('companion-core/plugin.json')).get('dependencies', []) == []
        assert all(name.startswith('companion-core/') for name in archive.namelist())
        for name in ['plugin.json', 'README.md', 'RELEASE.md', 'FEATURES.md', 'care.py', 'companion_features.py', 'file_backfill.py', 'life.py', 'checkup.py', 'diary.py', 'plan.py', 'weekly.py', 'backup.py', 'CHANGELOG.md', 'LICENSE'] + list(manifest['entry'].values()):
            assert archive.read('companion-core/' + name)
        # Dev-process docs stay in the repo and out of the package.
        assert not any(Path(name).name in {'AGENTS.md','DESIGN.md','FILE_REVIEW.md','ROADMAP.md', 'HOST_VALIDATION.md', '待办清单.md'} for name in archive.namelist())
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
