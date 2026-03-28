#!/usr/bin/env bash
set -euo pipefail

FUNCTION_NAME="${FUNCTION_NAME:-proj123zap-docs-github-auth}"
ROLE_NAME="${ROLE_NAME:-proj123zap-docs-edge-auth-role}"
DIST_ID="${CLOUDFRONT_DISTRIBUTION_ID:-E2GNHHUIX72UFH}"
RUNTIME="nodejs18.x"
HANDLER="index.handler"
WORKDIR="$(cd "$(dirname "$0")/.." && pwd)"
ZIP_PATH="/tmp/${FUNCTION_NAME}.zip"

assume_policy() {
  cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"Service": ["lambda.amazonaws.com", "edgelambda.amazonaws.com"]},
      "Action": "sts:AssumeRole"
    }
  ]
}
JSON
}

inline_policy() {
  cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameter", "ssm:GetParameters"],
      "Resource": [
        "arn:aws:ssm:us-east-1:*:parameter/proj123zap/docs/auth/*"
      ]
    }
  ]
}
JSON
}

echo "[1/6] Ensuring IAM role..."
if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "Role exists: $ROLE_NAME"
else
  aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document "$(assume_policy)" >/dev/null
  aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  echo "Role created: $ROLE_NAME"
fi
aws iam put-role-policy --role-name "$ROLE_NAME" --policy-name "${ROLE_NAME}-ssm" --policy-document "$(inline_policy)" >/dev/null
ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)

echo "[2/6] Packaging function..."
cd "$WORKDIR/infra/lambda-edge-auth"
rm -f package-lock.json
npm install --omit=dev >/dev/null
zip -q -r "$ZIP_PATH" index.js package.json node_modules

echo "[3/6] Creating/updating lambda in us-east-1..."
if aws lambda get-function --function-name "$FUNCTION_NAME" --region us-east-1 >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$FUNCTION_NAME" --zip-file "fileb://$ZIP_PATH" --region us-east-1 >/dev/null
  aws lambda wait function-updated-v2 --function-name "$FUNCTION_NAME" --region us-east-1
  echo "Lambda updated: $FUNCTION_NAME"
else
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime "$RUNTIME" \
    --handler "$HANDLER" \
    --role "$ROLE_ARN" \
    --timeout 5 \
    --memory-size 256 \
    --zip-file "fileb://$ZIP_PATH" \
    --region us-east-1 >/dev/null
  echo "Lambda created: $FUNCTION_NAME"
fi

echo "[4/6] Publishing version..."
VERSION_ARN=$(aws lambda publish-version --function-name "$FUNCTION_NAME" --region us-east-1 --query 'FunctionArn' --output text)
echo "Version ARN: $VERSION_ARN"

echo "[5/6] Granting CloudFront invoke permission..."
SID="cf-$(date +%s)"
aws lambda add-permission \
  --function-name "$VERSION_ARN" \
  --statement-id "$SID" \
  --action lambda:GetFunction \
  --principal edgelambda.amazonaws.com \
  --region us-east-1 >/dev/null 2>&1 || true

echo "[6/6] Attaching lambda@edge to CloudFront distribution $DIST_ID..."
ETAG=$(aws cloudfront get-distribution-config --id "$DIST_ID" --query 'ETag' --output text)
aws cloudfront get-distribution-config --id "$DIST_ID" --query 'DistributionConfig' > /tmp/dist-config.json

jq --arg arn "$VERSION_ARN" '
  .DefaultCacheBehavior.LambdaFunctionAssociations = {
    Quantity: 1,
    Items: [
      {
        LambdaFunctionARN: $arn,
        EventType: "viewer-request",
        IncludeBody: false
      }
    ]
  }
' /tmp/dist-config.json > /tmp/dist-config-updated.json

aws cloudfront update-distribution \
  --id "$DIST_ID" \
  --if-match "$ETAG" \
  --distribution-config file:///tmp/dist-config-updated.json >/dev/null

echo "Done. CloudFront auth attached."
