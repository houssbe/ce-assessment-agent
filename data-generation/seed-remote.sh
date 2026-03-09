#!/bin/bash

# Load environment variables from .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "Deploying and executing Cloud Run Job to seed the database remotely..."
echo "This securely builds the image in GCP, attaches to the VPC, and runs the job."

gcloud builds submit --tag gcr.io/$GCP_PROJECT_ID/seed-db-job -f data-generation/Dockerfile.seed .

gcloud run jobs deploy seed-db-job \
  --image gcr.io/$GCP_PROJECT_ID/seed-db-job \
  --region us-central1 \
  --command "npm" \
  --args "run,seed" \
  --network gcp-check-vpc \
  --subnet gcp-check-subnet \
  --vpc-egress private-ranges-only \
  --set-env-vars "INSTANCE_HOST=$INSTANCE_HOST,DB_PORT=$DB_PORT,DB_USER=$DB_USER,DB_PASS=$DB_PASS,DB_NAME=$DB_NAME,GCP_PROJECT_ID=$GCP_PROJECT_ID,GCP_REGION_AI=${GCP_REGION_AI:-global},GEMINI_MODEL=$GEMINI_MODEL" \
  --execute-now
