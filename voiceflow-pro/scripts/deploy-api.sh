#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VoiceFlow Pro — Deploy API to AWS App Runner
#
# Prerequisites:
#   - AWS CLI installed and configured (`aws configure`)
#   - Docker installed and running
#   - Your .env values ready (see .env.example)
#
# Usage (first time):
#   ./scripts/deploy-api.sh --setup
#
# Usage (re-deploy):
#   ./scripts/deploy-api.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

# ── Config — edit these ──────────────────────────────────────────────────────
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="voiceflow-pro-api"
APP_RUNNER_SERVICE="voiceflow-pro-api"
IMAGE_TAG="latest"
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"

# ── Colors ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}→${NC} $1"; }
warning() { echo -e "${YELLOW}⚠${NC}  $1"; }

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     VoiceFlow Pro API — AWS App Runner Deploy        ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Region  : $AWS_REGION"
echo "║  Account : $AWS_ACCOUNT_ID"
echo "║  Image   : $ECR_URI:$IMAGE_TAG"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

# ── Step 1: Ensure ECR repository exists ─────────────────────────────────────
info "Ensuring ECR repository exists..."
aws ecr describe-repositories --repository-names "$ECR_REPO" --region "$AWS_REGION" > /dev/null 2>&1 || \
  aws ecr create-repository \
    --repository-name "$ECR_REPO" \
    --region "$AWS_REGION" \
    --image-scanning-configuration scanOnPush=true \
    --output json > /dev/null

info "ECR repository ready: $ECR_URI"

# ── Step 2: Authenticate Docker to ECR ───────────────────────────────────────
info "Logging Docker into ECR..."
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# ── Step 3: Build Docker image from monorepo root ────────────────────────────
info "Building Docker image (this may take a few minutes on first run)..."
cd "$REPO_ROOT"
docker build \
  -f apps/api/Dockerfile \
  -t "${ECR_REPO}:${IMAGE_TAG}" \
  -t "${ECR_URI}:${IMAGE_TAG}" \
  .

# ── Step 4: Push to ECR ───────────────────────────────────────────────────────
info "Pushing image to ECR..."
docker push "${ECR_URI}:${IMAGE_TAG}"
info "Image pushed: ${ECR_URI}:${IMAGE_TAG}"

# ── Step 5: Check if App Runner service exists or create it ──────────────────
SERVICE_ARN=$(aws apprunner list-services --region "$AWS_REGION" \
  --query "ServiceSummaryList[?ServiceName=='${APP_RUNNER_SERVICE}'].ServiceArn" \
  --output text 2>/dev/null || echo "")

if [ -z "$SERVICE_ARN" ]; then
  info "Creating App Runner service (first deploy)..."

  warning "You need the following environment variables set in AWS:"
  warning "  DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,"
  warning "  JWT_SECRET, NODE_ENV=production, PORT=3002"
  warning ""
  warning "Creating service now — add env vars in the AWS App Runner console after creation."

  # Create the App Runner IAM role for ECR access (if it doesn't exist)
  ROLE_NAME="AppRunnerECRAccessRole"
  ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" \
    --query "Role.Arn" --output text 2>/dev/null || echo "")

  if [ -z "$ROLE_ARN" ]; then
    info "Creating IAM role for App Runner ECR access..."
    ROLE_ARN=$(aws iam create-role \
      --role-name "$ROLE_NAME" \
      --assume-role-policy-document '{
        "Version":"2012-10-17",
        "Statement":[{
          "Effect":"Allow",
          "Principal":{"Service":"build.apprunner.amazonaws.com"},
          "Action":"sts:AssumeRole"
        }]
      }' --query "Role.Arn" --output text)

    aws iam attach-role-policy \
      --role-name "$ROLE_NAME" \
      --policy-arn "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
    sleep 5  # Allow IAM to propagate
  fi

  # Create the App Runner service
  SERVICE_ARN=$(aws apprunner create-service \
    --service-name "$APP_RUNNER_SERVICE" \
    --region "$AWS_REGION" \
    --source-configuration "{
      \"AuthenticationConfiguration\": {
        \"AccessRoleArn\": \"${ROLE_ARN}\"
      },
      \"ImageRepository\": {
        \"ImageIdentifier\": \"${ECR_URI}:${IMAGE_TAG}\",
        \"ImageRepositoryType\": \"ECR\",
        \"ImageConfiguration\": {
          \"Port\": \"3002\",
          \"RuntimeEnvironmentVariables\": {
            \"NODE_ENV\": \"production\",
            \"PORT\": \"3002\"
          }
        }
      }
    }" \
    --instance-configuration '{"Cpu":"0.25 vCPU","Memory":"0.5 GB"}' \
    --query "Service.ServiceArn" --output text)

  info "App Runner service created!"
  warning "⚠  IMPORTANT: Add your environment variables in the AWS Console:"
  warning "   https://console.aws.amazon.com/apprunner/home?region=${AWS_REGION}#/services"
  warning "   Service: ${APP_RUNNER_SERVICE} → Configuration → Environment variables"
  warning "   Required: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET"

else
  info "Updating existing App Runner service..."
  aws apprunner update-service \
    --service-arn "$SERVICE_ARN" \
    --region "$AWS_REGION" \
    --source-configuration "{
      \"ImageRepository\": {
        \"ImageIdentifier\": \"${ECR_URI}:${IMAGE_TAG}\",
        \"ImageRepositoryType\": \"ECR\",
        \"ImageConfiguration\": { \"Port\": \"3002\" }
      }
    }" > /dev/null
  info "Deployment triggered."
fi

# ── Step 6: Get service URL ───────────────────────────────────────────────────
info "Waiting for service URL..."
sleep 5
SERVICE_URL=$(aws apprunner describe-service \
  --service-arn "$SERVICE_ARN" \
  --region "$AWS_REGION" \
  --query "Service.ServiceUrl" \
  --output text 2>/dev/null || echo "pending...")

echo ""
echo "✅ Deployment complete!"
echo ""
echo "   API URL: https://${SERVICE_URL}"
echo ""
echo "📋 Next steps:"
echo "   1. Add env vars in AWS Console (if first deploy)"
echo "   2. Build the desktop app with this URL:"
echo "      API_URL=https://${SERVICE_URL} npm run dist"
echo "   3. (Optional) Set up a custom domain in App Runner console"
echo ""
