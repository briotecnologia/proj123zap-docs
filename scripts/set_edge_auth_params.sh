#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Uso: $0 <github_client_id> <github_client_secret> <cookie_secret> [org_name]"
  exit 1
fi

CLIENT_ID="$1"
CLIENT_SECRET="$2"
COOKIE_SECRET="$3"
ORG_NAME="${4:-briotecnologia}"
PREFIX="/proj123zap/docs/auth"

aws ssm put-parameter --name "$PREFIX/github_client_id" --type String --value "$CLIENT_ID" --overwrite >/dev/null
aws ssm put-parameter --name "$PREFIX/github_client_secret" --type SecureString --value "$CLIENT_SECRET" --overwrite >/dev/null
aws ssm put-parameter --name "$PREFIX/cookie_secret" --type SecureString --value "$COOKIE_SECRET" --overwrite >/dev/null
aws ssm put-parameter --name "$PREFIX/org_name" --type String --value "$ORG_NAME" --overwrite >/dev/null

echo "SSM parameters updated under $PREFIX"
