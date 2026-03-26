#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNCTION_NAME="${1:-${COHORT_ANALYSIS_WORKER_FUNCTION_NAME:-}}"
AWS_REGION_VALUE="${ENGAGE_AWS_REGION:-${AWS_REGION:-us-east-2}}"

if [[ -z "$FUNCTION_NAME" ]]; then
  echo "Set COHORT_ANALYSIS_WORKER_FUNCTION_NAME or pass the Lambda function name as the first argument." >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required to update the cohort analysis worker." >&2
  exit 1
fi

ZIP_PATH="$("$ROOT_DIR/scripts/deploy-cohort-analysis-worker.sh")"

aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file "fileb://$ZIP_PATH" \
  --publish \
  --region "$AWS_REGION_VALUE"

aws lambda wait function-updated \
  --function-name "$FUNCTION_NAME" \
  --region "$AWS_REGION_VALUE"

echo "Updated $FUNCTION_NAME in $AWS_REGION_VALUE using $ZIP_PATH"
