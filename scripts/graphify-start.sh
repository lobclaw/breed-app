#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSET_SCRIPT="$ROOT_DIR/scripts/graphify-workset.sh"

usage() {
  cat <<'EOF'
用法:
  ./scripts/graphify-start.sh "<问题或关键词>"

示例:
  ./scripts/graphify-start.sh "首页红点为什么不更新"
  ./scripts/graphify-start.sh "销售详情没显示退款日期"
EOF
}

if [ $# -lt 1 ]; then
  usage
  exit 1
fi

QUERY="$*"

if [ ! -x "$WORKSET_SCRIPT" ]; then
  echo "找不到可执行脚本: $WORKSET_SCRIPT" >&2
  exit 1
fi

WORKSET="$("$WORKSET_SCRIPT" auto "$QUERY")"

if [ -z "$WORKSET" ]; then
  echo "未能自动匹配到 workset" >&2
  exit 1
fi

echo "query:   $QUERY"
echo "workset: $WORKSET"
echo

"$WORKSET_SCRIPT" build "$WORKSET"

REPORT_PATH="$ROOT_DIR/.graphify-worksets/$WORKSET/corpus/graphify-out/GRAPH_REPORT.md"
MANIFEST_PATH="$ROOT_DIR/graphify/worksets/$WORKSET.json"

echo
echo "next:"
echo "  report:   $REPORT_PATH"
echo "  manifest: $MANIFEST_PATH"
echo "  files:    $WORKSET_SCRIPT files $WORKSET"
