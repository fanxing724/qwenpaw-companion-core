#!/bin/sh
# 本地测试用：打包 → 校验 → 直接覆盖安装（不走发布流程）。
# 用法: sh scripts/reinstall-local.sh
set -e
cd "$(dirname "$0")/.."
python3 scripts/package.py --dir >/dev/null
VERSION=$(python3 -c "import json;print(json.load(open('plugin.json'))['version'])")
qwenpaw plugin validate "dist/companion-core" | grep -v '^INFO' | tail -2
qwenpaw plugin install --force "dist/companion-core-$VERSION.zip" | grep -v '^INFO' | tail -1
curl -s http://127.0.0.1:8088/api/companion-core/health | python3 -c "import json,sys; d=json.load(sys.stdin); print('health:',d['status'],'v'+d['version'],'| tools',d['tool_count'],'| life',d['life']['enabled'])"
