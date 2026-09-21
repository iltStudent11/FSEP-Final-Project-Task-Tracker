#!/usr/bin/env bash

set -euo pipefail

REGION="${1:-us-east-1}"
REGISTRY_ID="${2:-717279729058}"
CONSUMER_ACCOUNT_ID="${3:-977099015675}"
CONSUMER_PRINCIPAL="${4:-arn:aws:iam::${CONSUMER_ACCOUNT_ID}:root}"

REPOS=(
	"fsep-cap3-backend-api"
	"fsep-cap3-frontend-client"
)

echo "[info] Region: ${REGION}"
echo "[info] Owner registry account: ${REGISTRY_ID}"
echo "[info] Consumer principal: ${CONSUMER_PRINCIPAL}"

OWNER_ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
if [[ "${OWNER_ACCOUNT}" != "${REGISTRY_ID}" ]]; then
	echo "[error] Current AWS caller account is ${OWNER_ACCOUNT}, expected owner account ${REGISTRY_ID}."
	echo "[error] Assume credentials in account ${REGISTRY_ID} and run again."
	exit 1
fi

tmp_policy="$(mktemp)"
trap 'rm -f "${tmp_policy}"' EXIT

cat > "${tmp_policy}" <<JSON
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Sid": "AllowCrossAccountPull",
			"Effect": "Allow",
			"Principal": {
				"AWS": "${CONSUMER_PRINCIPAL}"
			},
			"Action": [
				"ecr:BatchCheckLayerAvailability",
				"ecr:BatchGetImage",
				"ecr:DescribeImages",
				"ecr:DescribeRepositories",
				"ecr:GetDownloadUrlForLayer",
				"ecr:ListImages"
			]
		}
	]
}
JSON

for repo in "${REPOS[@]}"; do
	echo "[info] Applying repository policy to ${repo}..."
	aws ecr set-repository-policy \
		--region "${REGION}" \
		--registry-id "${REGISTRY_ID}" \
		--repository-name "${repo}" \
		--policy-text "file://${tmp_policy}" \
		--force >/dev/null

	echo "[ok] Applied: ${repo}"
done

echo "[info] Verifying repository policies..."
for repo in "${REPOS[@]}"; do
	aws ecr get-repository-policy \
		--region "${REGION}" \
		--registry-id "${REGISTRY_ID}" \
		--repository-name "${repo}" \
		--query 'policyText' \
		--output text >/dev/null
	echo "[ok] Policy present on ${repo}"
done

cat <<'EOF'
[next] In consumer account credentials (977099015675), ensure IAM allows pull:

	Action:
		- ecr:GetAuthorizationToken
	Resource:
		- *

	Action:
		- ecr:BatchCheckLayerAvailability
		- ecr:BatchGetImage
		- ecr:DescribeImages
		- ecr:DescribeRepositories
		- ecr:GetDownloadUrlForLayer
		- ecr:ListImages
	Resource:
		- arn:aws:ecr:us-east-1:717279729058:repository/fsep-cap3-backend-api
		- arn:aws:ecr:us-east-1:717279729058:repository/fsep-cap3-frontend-client

Then refresh k8s pull secret and restart deployments:
	aws ecr get-login-password --region us-east-1 | kubectl -n task-tracker create secret docker-registry ecr-registry \
		--docker-server=717279729058.dkr.ecr.us-east-1.amazonaws.com \
		--docker-username=AWS --docker-password="$(cat)" \
		--dry-run=client -o yaml | kubectl apply -f -
	kubectl -n task-tracker rollout restart deployment/backend-api deployment/frontend-client
EOF
