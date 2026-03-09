# Test Your GCP Knowledge

Evaluate your Google Cloud skills against realistic scenarios. This tool uses Gemini and the Developer Knowledge API via the Model Context Protocol (MCP) to generate challenges and provide grounded, real-time evaluation of your technical proposals.

## 🚀 Overview

The **Test Your GCP Knowledge** application validates your technical mastery of Google Cloud topics such as AI, Data, and Modern Infrastructure. It uses an Agentic AI pattern to browse official documentation in real-time.

### Tech Stack
- **AI Engine**: `gemini-3.1-flash-lite-preview` via the `@google/genai` SDK
- **Backend Framework**: Node.js & TypeScript (Hono, Express)
- **Database**: PostgreSQL (Google Cloud SQL)
- **Deployment**: Google Cloud Run
- **Frontend**: Vanilla HTML/CSS/TS (bundled with Rollup)
- **CI/CD & Testing**: Google Cloud Build

## 📦 Getting Started

### Prerequisites
- Node.js (v20+)
- **Google Cloud SDK (`gcloud`)**
- A Google Cloud Project

### MCP Server Authentication
This agent connects to the **Google Developer Knowledge MCP Server** at `developerknowledge.googleapis.com`.
```bash
gcloud components update beta
gcloud beta services mcp enable developerknowledge.googleapis.com --project=YOUR_PROJECT_ID
gcloud auth application-default login
```

### Configuration
Copy `.env.example` to `.env` and fill in your Cloud SQL credentials, Firebase Auth keys, and Gemini details.

## 🚀 Build & Deploy

This project is built to run on **Google Cloud Run** and utilizes an airlocked local environment. **All testing and database migrations should occur in the cloud.**

### 1. Infrastructure Setup
Use the provided deployment script to provision your VPC, Private Service Connect, Cloud SQL instance, and Cloud Run service:
```bash
sh infrastructure/deploy.sh
```

### 2. Database Seeding
To generate assessment scenarios, trigger the remote seeding job which builds a dedicated container and connects to your private Cloud SQL instance:
```bash
npm run seed:remote
```

### 3. CI/CD & Testing
Testing is performed exclusively in the cloud via Google Cloud Build to simulate the production environment:
```bash
gcloud builds submit --config infrastructure/cloudbuild-test.yaml .
```

## 📜 Global Rules
- **No Local Testing**: Do not attempt to run `npm install` or `npm test` locally as the environment is airlocked. Always use the provided `cloudbuild-test.yaml`.
- **Typing**: Strict TypeScript (`noImplicitAny`).
- **Configuration**: Environment variables are parsed explicitly in `src/config.ts`.
