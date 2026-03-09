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

### Firebase Authentication Setup
This project uses Firebase Authentication via Google's Identity Platform for Single Sign-On (SSO).
To configure authentication properly in your GCP Project:

1. Enable **Identity Platform** in the Google Cloud Console:
   - Go to **Security > Identity Platform** and click **Enable**.
   - Under **Providers**, click **Add A Provider** and select **Google**.
   - Copy the Web Client ID and Web Client Secret from your existing Google OAuth 2.0 Client credentials (or create a new set under APIs & Services > Credentials).
2. Go to the **Firebase Console** and add your existing GCP project.
3. In **Project Settings > General**, add a **Web app** to your project to generate the `FIREBASE_API_KEY`.
4. Copy the API Key and set it in your `.env` file.
5. In your Google Cloud Console, go to **APIs & Services > Credentials**, find the auto-generated **Browser key (auto created by Firebase)**, and restrict its usage to:
   - Your Cloud Run Domain: `https://YOUR-SERVICE-URL.run.app/*`
   - Your Firebase Domain: `https://YOUR-PROJECT.firebaseapp.com/*`
6. Add your Cloud Run domain to the **Authorized domains** list in the Firebase Authentication settings.

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


