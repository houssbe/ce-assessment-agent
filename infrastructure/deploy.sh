#!/bin/bash
set -e

# ==========================================
# CONFIGURATION VARIABLES
# ==========================================
PROJECT_ID="your-project-id" # Replace with your GCP project ID
REGION="us-central1"
NETWORK="gcp-check-vpc"
SUBNET="gcp-check-subnet"

DB_INSTANCE="gcp-check-db"
DB_NAME="questions"
DB_USER="app_user"
DB_PASS="${DB_PASS:-SecurePassword123\!}"
DB_TIER="db-f1-micro"

VPC_CONNECTOR="gcp-check-connector"
SERVICE_NAME="gcp-check-service"

# ==========================================
# 0. ENABLE APIS
# ==========================================
echo "0. Enabling required GCP APIs..."
gcloud services enable \
    compute.googleapis.com \
    servicenetworking.googleapis.com \
    vpcaccess.googleapis.com \
    sqladmin.googleapis.com \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    --project=$PROJECT_ID

echo "Enabling Developer Knowledge MCP API (Beta)..."
gcloud beta services mcp enable developerknowledge.googleapis.com --project=$PROJECT_ID || echo "Failed to enable MCP (make sure gcloud beta components are installed)"

# ==========================================
# 1. SETUP NETWORKING
# ==========================================
echo "1. Creating VPC and Subnet..."
gcloud compute networks create $NETWORK --subnet-mode=custom --project=$PROJECT_ID || echo "Network exists"
gcloud compute networks subnets create $SUBNET --network=$NETWORK --region=$REGION --range=10.0.0.0/24 --project=$PROJECT_ID || echo "Subnet exists"

echo "2. Configuring Private Services Access (VPC Peering for Cloud SQL)..."
gcloud compute addresses create google-managed-services-$NETWORK \
    --global \
    --purpose=VPC_PEERING \
    --prefix-length=16 \
    --description="Peering range for Google services" \
    --network=$NETWORK \
    --project=$PROJECT_ID || echo "IP range exists"

gcloud services vpc-peerings connect \
    --service=servicenetworking.googleapis.com \
    --ranges=google-managed-services-$NETWORK \
    --network=$NETWORK \
    --project=$PROJECT_ID || echo "VPC peering exists"

echo "3. Creating Serverless VPC Access Connector..."
gcloud compute networks vpc-access connectors create $VPC_CONNECTOR \
    --network=$NETWORK \
    --region=$REGION \
    --range=10.8.0.0/28 \
    --project=$PROJECT_ID || echo "VPC connector exists"

# ==========================================
# 2. PROVISION CLOUD SQL
# ==========================================
echo "4. Creating Cloud SQL Instance (Private IP)..."
gcloud sql instances create $DB_INSTANCE \
    --database-version=POSTGRES_16 \
    --cpu=1 --memory=4GB \
    --region=$REGION \
    --network=projects/$PROJECT_ID/global/networks/$NETWORK \
    --no-assign-ip \
    --project=$PROJECT_ID || echo "Database instance exists"

echo "5. Creating Database and User..."
gcloud sql databases create $DB_NAME --instance=$DB_INSTANCE --project=$PROJECT_ID || echo "Database exists"
gcloud sql users create $DB_USER --instance=$DB_INSTANCE --password=$DB_PASS --project=$PROJECT_ID || echo "User exists"

DB_PRIVATE_IP=$(gcloud sql instances describe $DB_INSTANCE --project=$PROJECT_ID --format="value(ipAddresses[0].ipAddress)")
echo "Database created at Private IP: $DB_PRIVATE_IP"

# ==========================================
# 3. DEPLOY CLOUD RUN
# ==========================================
echo "6. Building and Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --source . \
    --region=$REGION \
    --allow-unauthenticated \
    --vpc-connector=$VPC_CONNECTOR \
    --vpc-egress=private-ranges-only \
    --set-env-vars="INSTANCE_HOST=$DB_PRIVATE_IP,DB_PORT=5432,DB_USER=$DB_USER,DB_PASS=$DB_PASS,DB_NAME=$DB_NAME,GCP_PROJECT_ID=$PROJECT_ID" \
    --project=$PROJECT_ID

echo "Deployment complete!"
