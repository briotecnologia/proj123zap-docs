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

if [ ! -f docs/data/repo-governance.json ]; then
  echo '[]' > docs/data/repo-governance.json
fi

jq -s '
  def gov_defaults($name): {
    name: $name,
    team: "Não definido",
    members: [],
    owners: [],
    status: "ativo",
    note: ""
  };

  (.[0] // []) as $repos |
  (.[1] // []) as $gov |

  [
    $repos[] as $r |
    (
      ($gov[] | select(.name == $r.name)) // gov_defaults($r.name)
    )
    | {
        name: .name,
        team: (.team // "Não definido"),
        members: (if (.members | type) == "array" then .members else [] end),
        owners: (if (.owners | type) == "array" then .owners else [] end),
        status: (.status // "ativo"),
        note: (.note // "")
      }
  ]
' docs/data/repos.json docs/data/repo-governance.json > docs/data/repo-governance.tmp.json

mv docs/data/repo-governance.tmp.json docs/data/repo-governance.json

echo "Dados atualizados em docs/data/repos.json"
echo "Governança reconciliada em docs/data/repo-governance.json"
