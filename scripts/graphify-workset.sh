#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSET_DIR="$ROOT_DIR/graphify/worksets"
BUILD_ROOT="$ROOT_DIR/.graphify-worksets"
GRAPHIFY_BIN="${GRAPHIFY_BIN:-$(command -v graphify || true)}"
GRAPHIFY_PY=""

usage() {
  cat <<'EOF'
用法:
  ./scripts/graphify-workset.sh list
  ./scripts/graphify-workset.sh show <workset>
  ./scripts/graphify-workset.sh files <workset>
  ./scripts/graphify-workset.sh suggest <问题或关键词>
  ./scripts/graphify-workset.sh auto <问题或关键词>
  ./scripts/graphify-workset.sh auto-build <问题或关键词>
  ./scripts/graphify-workset.sh build <workset>

示例:
  ./scripts/graphify-workset.sh list
  ./scripts/graphify-workset.sh show health-medication
  ./scripts/graphify-workset.sh suggest "首页红点为什么不对"
  ./scripts/graphify-workset.sh auto "销售详情没显示退款日期"
  ./scripts/graphify-workset.sh build home-attention
EOF
}

require_graphify() {
  if [ -z "$GRAPHIFY_BIN" ]; then
    echo "graphify 未安装。请先执行: pipx install graphifyy" >&2
    exit 1
  fi
  GRAPHIFY_PY="$(head -1 "$GRAPHIFY_BIN" | tr -d '#!')"
  if [ ! -x "$GRAPHIFY_PY" ]; then
    echo "找不到 Graphify Python 解释器: $GRAPHIFY_PY" >&2
    exit 1
  fi
}

manifest_path() {
  local name="$1"
  echo "$WORKSET_DIR/$name.json"
}

require_manifest() {
  local name="$1"
  local manifest
  manifest="$(manifest_path "$name")"
  if [ ! -f "$manifest" ]; then
    echo "未找到 workset: $name" >&2
    exit 1
  fi
}

list_worksets() {
  python3 - "$WORKSET_DIR" <<'PY'
import json
import sys
from pathlib import Path

root = Path(sys.argv[1])
for path in sorted(root.glob("*.json")):
    data = json.loads(path.read_text())
    print(f"{data['name']}\t{data.get('title', '')}\t{len(data.get('files', []))} files")
PY
}

show_workset() {
  local manifest="$1"
  python3 - "$manifest" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
data = json.loads(path.read_text())
print(f"name: {data['name']}")
print(f"title: {data.get('title', '')}")
print(f"description: {data.get('description', '')}")
print(f"files: {len(data.get('files', []))}")
PY
}

print_files() {
  local manifest="$1"
  python3 - "$manifest" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
data = json.loads(path.read_text())
for file in data.get("files", []):
    print(file)
PY
}

rank_worksets() {
  local query="$1"
  python3 - "$WORKSET_DIR" "$query" <<'PY'
import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1])
query = sys.argv[2].strip().lower()
tokens = [t for t in re.split(r"[^0-9a-z\u4e00-\u9fff]+", query) if t]

rows = []
for path in sorted(root.glob("*.json")):
    data = json.loads(path.read_text())
    score = 0
    reasons = []

    fields = {
        "name": data.get("name", "").lower(),
        "title": data.get("title", "").lower(),
        "description": data.get("description", "").lower(),
    }
    keywords = [k.lower() for k in data.get("keywords", [])]
    files = [f.lower() for f in data.get("files", [])]

    if query:
        for kw in keywords:
            if kw and kw in query:
                score += 14
                reasons.append(f"keyword:{kw}")
        for token in tokens or [query]:
            if token in fields["name"]:
                score += 10
                reasons.append(f"name:{token}")
            if token in fields["title"]:
                score += 8
                reasons.append(f"title:{token}")
            if token in fields["description"]:
                score += 5
                reasons.append(f"description:{token}")
            for kw in keywords:
                if token and token in kw:
                    score += 12
                    reasons.append(f"keyword:{kw}")
                    break
            file_hits = [f for f in files if token and token in f]
            if file_hits:
                score += min(9, 3 * len(file_hits))
                reasons.append(f"file:{token}")

    if score > 0:
        rows.append({
            "name": data["name"],
            "title": data.get("title", ""),
            "score": score,
            "reasons": reasons[:4],
        })

rows.sort(key=lambda x: (-x["score"], x["name"]))

for row in rows[:5]:
    reasons = ", ".join(row["reasons"]) if row["reasons"] else "fallback"
    print(f"{row['name']}\t{row['score']}\t{row['title']}\t{reasons}")
PY
}

suggest_workset() {
  local query="$1"
  local result
  result="$(rank_worksets "$query")"
  if [ -z "$result" ]; then
    echo "未匹配到明显 workset，建议先看根图谱：graphify-out/GRAPH_REPORT.md"
    return 1
  fi
  echo "$result"
}

auto_pick_workset() {
  local query="$1"
  local result
  result="$(rank_worksets "$query")"
  if [ -z "$result" ]; then
    echo "未匹配到明显 workset，建议先看根图谱：graphify-out/GRAPH_REPORT.md" >&2
    exit 1
  fi
  echo "$result" | head -n 1 | cut -f1
}

stage_workset() {
  local manifest="$1"
  local build_dir="$2"

  python3 - "$ROOT_DIR" "$manifest" "$build_dir" <<'PY'
import json
import shutil
import sys
from pathlib import Path

root = Path(sys.argv[1])
manifest = Path(sys.argv[2])
build_dir = Path(sys.argv[3])
data = json.loads(manifest.read_text())

missing = []
for rel in data.get("files", []):
    src = root / rel
    if not src.exists():
        missing.append(rel)
        continue
    dest = build_dir / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    if src.is_dir():
        shutil.copytree(src, dest, dirs_exist_ok=True)
    else:
        shutil.copy2(src, dest)

if missing:
    print("以下文件不存在:", file=sys.stderr)
    for rel in missing:
        print(rel, file=sys.stderr)
    sys.exit(1)
PY
}

build_workset() {
  local name="$1"

  require_graphify
  require_manifest "$name"

  local manifest
  manifest="$(manifest_path "$name")"
  local target_dir="$BUILD_ROOT/$name"
  local corpus_dir="$target_dir/corpus"

  rm -rf "$target_dir"
  mkdir -p "$corpus_dir"
  stage_workset "$manifest" "$corpus_dir"

  (
    cd "$corpus_dir"
    "$GRAPHIFY_PY" -c "from pathlib import Path; from graphify.watch import _rebuild_code; _rebuild_code(Path('.'))"
  )

  echo "workset 已生成:"
  echo "  corpus: $corpus_dir"
  echo "  graph:  $corpus_dir/graphify-out/GRAPH_REPORT.md"
  echo "  note:   如需把设计文档也纳入完整语义图谱，请在该 corpus 目录内运行 /graphify ."
}

main() {
  local command="${1:-}"
  case "$command" in
    list)
      list_worksets
      ;;
    show)
      [ $# -ge 2 ] || { usage; exit 1; }
      require_manifest "$2"
      show_workset "$(manifest_path "$2")"
      ;;
    files)
      [ $# -ge 2 ] || { usage; exit 1; }
      require_manifest "$2"
      print_files "$(manifest_path "$2")"
      ;;
    suggest)
      [ $# -ge 2 ] || { usage; exit 1; }
      shift
      suggest_workset "$*"
      ;;
    auto)
      [ $# -ge 2 ] || { usage; exit 1; }
      shift
      auto_pick_workset "$*"
      ;;
    auto-build)
      [ $# -ge 2 ] || { usage; exit 1; }
      shift
      build_workset "$(auto_pick_workset "$*")"
      ;;
    build)
      [ $# -ge 2 ] || { usage; exit 1; }
      shift
      build_workset "$1"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
