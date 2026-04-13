#!/usr/bin/env bash
set -euo pipefail

GRAPHIFY_BIN="${GRAPHIFY_BIN:-$(command -v graphify || true)}"

if [ -z "$GRAPHIFY_BIN" ]; then
  echo "graphify 未安装。请先执行: pipx install graphifyy"
  exit 1
fi

GRAPHIFY_PY="$(head -1 "$GRAPHIFY_BIN" | tr -d '#!')"

if [ ! -x "$GRAPHIFY_PY" ]; then
  echo "找不到 Graphify Python 解释器: $GRAPHIFY_PY"
  exit 1
fi

if [ ! -f "graphify-out/graph.json" ]; then
  echo "尚未生成初始知识图谱。请先在仓库根目录运行一次 \$graphify ."
  exit 0
fi

"$GRAPHIFY_PY" -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))"
