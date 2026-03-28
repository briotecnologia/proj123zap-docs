#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p docs/data

gh repo list briotecnologia --limit 300 \
  --json name,url,pushedAt,updatedAt,description,isArchived,isPrivate \
  > docs/data/repos.raw.json

jq '[.[] | {name,url,pushedAt,updatedAt,description:(.description // ""),isArchived,isPrivate}]' \
  docs/data/repos.raw.json > docs/data/repos.json

echo "Dados atualizados em docs/data/repos.json"
