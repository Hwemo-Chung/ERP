# GCP Free Tier Deployment Guide

## Overview

This guide explains how to deploy the ERP Logistics system using Google Cloud Platform (GCP) Free Tier services.

> **⚠️ Important**: GCP **requires a credit card** for account creation. New accounts receive **$300 in credits** for 90 days. After that, "Always Free" resources remain free indefinitely.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     GCP Free Tier Architecture                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   [Firebase Hosting]      [Firebase Hosting]       [Cloud Run]         │
│   or [Cloud Storage]      or [Cloud Storage]       or [GCE e2-micro]   │
│   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐      │
│   │  Web Admin  │         │ Mobile PWA  │  ─────▶ │  NestJS API │      │
│   │  (Static)   │         │  (Static)   │         │   :3000     │      │
│   └─────────────┘         └─────────────┘         └──────┬──────┘      │
│                                                          │             │
│                                  ┌───────────────────────┼─────────────┤
│                                  ▼                       ▼             │
│                            [Neon/Cloud SQL]       [Upstash/Memorystore]│
│                            PostgreSQL                   Redis          │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## GCP Free Tier Summary (2025-2026)

| Category       | Service                 | Free Tier Limits                              | Duration    |
| -------------- | ----------------------- | --------------------------------------------- | ----------- |
| **Compute**    | Compute Engine e2-micro | 1 instance/month (specific regions)           | Always Free |
| **Serverless** | Cloud Run               | 2M requests, 360K GB-sec, 180K vCPU-sec/month | Always Free |
| **Functions**  | Cloud Functions         | 2M invocations/month                          | Always Free |
| **Hosting**    | Firebase Hosting        | 10GB storage, 360MB/day bandwidth             | Always Free |
| **Storage**    | Cloud Storage           | 5GB (us-west1, us-central1, us-east1)         | Always Free |
| **App Engine** | Standard Environment    | 28 frontend hours/day                         | Always Free |

## Option 1: Firebase Hosting (Recommended for Frontend)

**Best for**: Static web apps with global CDN
**Free tier**: 10GB storage, 360MB/day bandwidth, SSL included (Always Free)

### Step 1: Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

### Step 2: Initialize Firebase Project

```bash
# Initialize in project root
firebase init hosting

# Select options:
# - Create a new project or use existing
# - Public directory: apps/web/dist/web/browser (for web)
# - Single-page app: Yes
# - Automatic builds: No
```

### Step 3: Build and Deploy Web App

```bash
# Build for production
pnpm web:build:cloudflare

# Deploy
firebase deploy --only hosting
```

### Step 4: Deploy Mobile App (Separate Site)

```bash
# Add another hosting site
firebase hosting:sites:create erp-mobile

# Configure firebase.json for multiple sites
cat > firebase.json << 'EOF'
{
  "hosting": [
    {
      "site": "erp-web",
      "public": "apps/web/dist/web/browser",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ]
    },
    {
      "site": "erp-mobile",
      "public": "apps/mobile/www/browser",
      "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
      "rewrites": [
        {
          "source": "**",
          "destination": "/index.html"
        }
      ]
    }
  ]
}
EOF

# Build mobile
pnpm mobile:build:cloudflare

# Deploy both sites
firebase deploy --only hosting
```

**Firebase URLs**:

- `https://erp-web.web.app` or `https://erp-web.firebaseapp.com`
- `https://erp-mobile.web.app` or `https://erp-mobile.firebaseapp.com`

## Option 2: Cloud Run (Recommended for Backend)

**Best for**: Containerized NestJS API
**Free tier**: 2M requests/month, 360K GB-seconds, 180K vCPU-seconds (Always Free)

### Step 1: Install Google Cloud CLI

```bash
# macOS
brew install google-cloud-sdk

# Linux
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Initialize
gcloud init
gcloud auth login
```

### Step 2: Enable APIs

```bash
# Set project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### Step 3: Build and Push Docker Image

```bash
# Configure Docker for GCP
gcloud auth configure-docker

# Build image using Cloud Build
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/erp-api .

# Or build locally and push
docker build -f Dockerfile.api -t gcr.io/YOUR_PROJECT_ID/erp-api .
docker push gcr.io/YOUR_PROJECT_ID/erp-api
```

### Step 4: Deploy to Cloud Run

```bash
gcloud run deploy erp-api \
  --image gcr.io/YOUR_PROJECT_ID/erp-api \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 2 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "DATABASE_URL=postgresql://neondb_owner:npg_nbSqaC3r9PIR@ep-autumn-fog-a14vc6oi-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" \
  --set-env-vars "REDIS_URL=rediss://default:AUtLAAIncDFjY2MxYjg2MDk2NGE0OTVmOTA4MDM4MWFhMmRlM2ViYXAxMTkyNzU@loyal-pug-19275.upstash.io:6379" \
  --set-env-vars "JWT_ACCESS_SECRET=your-secret-key" \
  --set-env-vars "JWT_REFRESH_SECRET=your-refresh-key" \
  --set-env-vars "CORS_ORIGINS=https://erp-web.web.app,https://erp-mobile.web.app"
```

**Cloud Run URL**: `https://erp-api-xxxxx-an.a.run.app`

### Cloud Run Cold Start Optimization

```bash
# Keep minimum 1 instance warm (charges apply after free tier)
gcloud run services update erp-api --min-instances 1

# Or use CPU always-on (better for WebSocket/long-running)
gcloud run services update erp-api --cpu-boost --cpu-throttling=false
```

## Option 3: Compute Engine e2-micro (Always Free VM)

**Best for**: 24/7 API server with full control
**Free tier**: 1 e2-micro instance/month in specific regions (Always Free)

### Always Free Eligible Regions

| Region        | Location       |
| ------------- | -------------- |
| `us-west1`    | Oregon         |
| `us-central1` | Iowa           |
| `us-east1`    | South Carolina |

> **Note**: Regions outside this list (like `asia-northeast3` Seoul) are NOT Always Free.

### Step 1: Create e2-micro Instance

```bash
# Create instance in Always Free eligible region
gcloud compute instances create erp-api-server \
  --zone=us-west1-b \
  --machine-type=e2-micro \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-standard \
  --tags=http-server,https-server

# Create firewall rules
gcloud compute firewall-rules create allow-http \
  --allow tcp:80,tcp:443,tcp:3000 \
  --target-tags=http-server,https-server
```

### Step 2: Connect and Setup

```bash
# Connect via SSH
gcloud compute ssh erp-api-server --zone=us-west1-b

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Install Git and Docker
sudo apt-get install -y git docker.io
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Clone and setup
git clone https://github.com/ChungHwemo/ERP.git
cd ERP
pnpm install
pnpm db:generate
```

### Step 3: Configure and Run

```bash
# Create .env file
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://neondb_owner:npg_nbSqaC3r9PIR@ep-autumn-fog-a14vc6oi-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
REDIS_URL=rediss://default:AUtLAAIncDFjY2MxYjg2MDk2NGE0OTVmOTA4MDM4MWFhMmRlM2ViYXAxMTkyNzU@loyal-pug-19275.upstash.io:6379
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-key
CORS_ORIGINS=https://erp-web.web.app,https://erp-mobile.web.app
EOF

# Build and run with PM2
npm install -g pm2
pnpm api:build
pm2 start apps/api/dist/main.js --name erp-api
pm2 save
pm2 startup
```

### Step 4: Setup Nginx + SSL (Free with Let's Encrypt)

```bash
# Install Nginx and Certbot
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Point your domain to VM's external IP first, then:
sudo certbot --nginx -d api.yourdomain.com

# Configure Nginx
sudo cat > /etc/nginx/sites-available/erp-api << 'EOF'
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/erp-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Option 4: App Engine (Standard Environment)

**Best for**: Auto-scaling Node.js applications
**Free tier**: 28 frontend instance hours/day (Always Free)

### Step 1: Create app.yaml

```yaml
# apps/api/app.yaml
runtime: nodejs20
service: default

instance_class: F1

automatic_scaling:
  min_instances: 0
  max_instances: 2
  target_cpu_utilization: 0.65

env_variables:
  NODE_ENV: 'production'
  PORT: '8080'

# Secrets should be set via gcloud or Secret Manager
# DATABASE_URL, REDIS_URL, JWT_*, etc.
```

### Step 2: Create package.json Scripts

```json
// Ensure start script exists in apps/api/package.json
{
  "scripts": {
    "start": "node dist/main.js",
    "gcp-build": "pnpm run prisma:generate && pnpm run build"
  }
}
```

### Step 3: Deploy

```bash
cd apps/api
gcloud app deploy app.yaml --project YOUR_PROJECT_ID
```

**App Engine URL**: `https://YOUR_PROJECT_ID.appspot.com`

## Option 5: Cloud Storage + Cloud CDN (Static Hosting)

**Best for**: High-traffic static sites
**Free tier**: 5GB storage in US regions (Always Free)

### Step 1: Create Storage Bucket

```bash
# Create bucket (use regional for lower latency or multi-regional for global)
gsutil mb -l us-central1 gs://erp-web-static

# Enable website configuration
gsutil web set -m index.html -e index.html gs://erp-web-static

# Make bucket public
gsutil iam ch allUsers:objectViewer gs://erp-web-static
```

### Step 2: Upload Files

```bash
# Build apps
pnpm web:build:cloudflare
pnpm mobile:build:cloudflare

# Upload web
gsutil -m rsync -r -d apps/web/dist/web/browser/ gs://erp-web-static/

# Upload mobile (separate bucket)
gsutil mb -l us-central1 gs://erp-mobile-static
gsutil web set -m index.html -e index.html gs://erp-mobile-static
gsutil iam ch allUsers:objectViewer gs://erp-mobile-static
gsutil -m rsync -r -d apps/mobile/www/browser/ gs://erp-mobile-static/
```

### Step 3: Setup Load Balancer + CDN (Optional)

```bash
# Create backend bucket
gcloud compute backend-buckets create erp-web-backend \
  --gcs-bucket-name=erp-web-static \
  --enable-cdn

# Create URL map
gcloud compute url-maps create erp-web-lb \
  --default-backend-bucket=erp-web-backend

# Create HTTP proxy
gcloud compute target-http-proxies create erp-web-proxy \
  --url-map=erp-web-lb

# Create forwarding rule (assigns external IP)
gcloud compute forwarding-rules create erp-web-fw \
  --global \
  --target-http-proxy=erp-web-proxy \
  --ports=80
```

**URLs**:

- Direct: `https://storage.googleapis.com/erp-web-static/index.html`
- With LB: `http://EXTERNAL_IP/`

## Cost Comparison

| Service                     | Free Tier                            | After Free Tier                     |
| --------------------------- | ------------------------------------ | ----------------------------------- |
| **Firebase Hosting**        | 10GB + 360MB/day (Always Free)       | $0.026/GB stored, $0.15/GB transfer |
| **Cloud Storage**           | 5GB (US regions, Always Free)        | $0.020/GB/month                     |
| **Cloud Run**               | 2M req/mo (Always Free)              | $0.40/million requests              |
| **Compute Engine e2-micro** | 1 instance (US regions, Always Free) | ~$6.11/month                        |
| **App Engine F1**           | 28 hrs/day (Always Free)             | $0.05/instance hour                 |

## Recommended Architecture for Free Tier

### Maximum Free (Always Free Only):

```
Frontend: Firebase Hosting (Always Free, unlimited sites)
Backend:  Cloud Run (Always Free, 2M requests/month)
          or GCE e2-micro in us-west1/us-central1/us-east1
Database: Neon PostgreSQL (Already configured - external)
Cache:    Upstash Redis (Already configured - external)
```

### With $300 Credits (First 90 Days):

```
Frontend: Firebase Hosting (Always Free)
Backend:  Cloud Run in asia-northeast3 (Seoul, closer to users)
Database: Cloud SQL (use credits)
Cache:    Memorystore (use credits)
```

## Quick Deployment Script

```bash
#!/bin/bash
# deploy-gcp.sh

PROJECT_ID="your-project-id"
REGION="us-west1"

# Build apps
echo "Building apps..."
pnpm web:build:cloudflare
pnpm mobile:build:cloudflare
pnpm api:build

# Deploy Frontend to Firebase
echo "Deploying frontend to Firebase..."
firebase deploy --only hosting

# Deploy API to Cloud Run
echo "Deploying API to Cloud Run..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/erp-api .
gcloud run deploy erp-api \
  --image gcr.io/$PROJECT_ID/erp-api \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated

echo "Deployment complete!"
echo "Web: https://erp-web.web.app"
echo "Mobile: https://erp-mobile.web.app"
echo "API: $(gcloud run services describe erp-api --region $REGION --format='value(status.url)')"
```

## Monitoring Free Tier Usage

```bash
# Check billing/usage
gcloud billing accounts list
gcloud billing projects describe YOUR_PROJECT_ID

# Set budget alerts
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="Free Tier Alert" \
  --budget-amount=1USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

Or visit: [GCP Billing Dashboard](https://console.cloud.google.com/billing)

## Troubleshooting

### Cloud Run: "Container failed to start"

- Check logs: `gcloud run services logs read erp-api`
- Ensure PORT environment variable matches Dockerfile EXPOSE
- Verify health check endpoint responds within timeout

### Compute Engine: Instance not responding

- Check firewall rules: `gcloud compute firewall-rules list`
- Verify instance is running: `gcloud compute instances list`
- Check if external IP is attached

### Firebase Hosting: 404 errors on refresh

- Ensure `rewrites` are configured in `firebase.json`
- SPA requires all routes to redirect to `index.html`

### "Billing not enabled" error

- Link billing account: `gcloud billing projects link PROJECT_ID --billing-account=BILLING_ID`
- Note: Billing must be enabled even for free tier

## Security Best Practices

1. **Use Secret Manager** for sensitive environment variables

   ```bash
   gcloud secrets create DATABASE_URL --data-file=- <<< "postgresql://..."
   ```

2. **Enable VPC Service Controls** for production workloads

3. **Use Service Accounts** with minimum required permissions

4. **Enable Cloud Audit Logs** for security monitoring

5. **Set up Organization Policies** to restrict resource creation regions

## Related Documentation

- [GCP Free Tier Overview](https://cloud.google.com/free)
- [Firebase Hosting Docs](https://firebase.google.com/docs/hosting)
- [Cloud Run Docs](https://cloud.google.com/run/docs)
- [Compute Engine Always Free](https://cloud.google.com/free/docs/free-cloud-features#compute)
