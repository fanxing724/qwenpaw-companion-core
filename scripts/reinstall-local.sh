#!/usr/bin/env bash
# Explicit manual test installation only; never run during review or packaging.
# Usage: bash scripts/reinstall-local.sh /actual/companion-data-dir [backup-output-dir]
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
COMPANION_INSTALL_DATA=${1:?Provide the actual data_dir reported by the host health endpoint}
COMPANION_INSTALL_BACKUPS=${2:-"$HOME/codex-workspace/artifacts/companion-manual-install-backups"}
if [[ ! -d "$COMPANION_INSTALL_DATA" ]]; then
  echo 'The supplied companion data directory does not exist.' >&2
  exit 1
fi
python3 scripts/package.py --dir
VERSION=$(python3 -c "import json;print(json.load(open('plugin.json'))['version'])")
# Keep the validation exit status; filtering a failed command can hide failure.
qwenpaw plugin validate dist/companion-core
mkdir -p "$COMPANION_INSTALL_BACKUPS"
COMPANION_INSTALL_ARCHIVE=$(mktemp "$COMPANION_INSTALL_BACKUPS/pre-install-$VERSION-XXXXXXXX.tar.gz")
tar -czf "$COMPANION_INSTALL_ARCHIVE" -C "$COMPANION_INSTALL_DATA" .
echo "Private pre-install backup: $COMPANION_INSTALL_ARCHIVE"
qwenpaw plugin install --force "dist/companion-core-$VERSION.zip"
curl -fsS "${COMPANION_HEALTH_URL:-http://127.0.0.1:8088/api/companion-core/health}" |
  python3 -c "import json,sys; d=json.load(sys.stdin); print('health:',d['status'],'v'+d['version'],'| tools',d['tool_count'],'| life',d['life']['enabled'])"
