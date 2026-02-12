# AWS Free Tier Deployment Guide

## Overview

This guide explains how to deploy the ERP Logistics system using AWS Free Tier services.

> **⚠️ Important**: AWS **requires a credit card** for account creation, but you won't be charged if you stay within free tier limits. As of July 2025, new accounts receive **$100-$200 in credits** for a 6-month free plan.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     AWS Free Tier Architecture                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   [S3 + CloudFront]       [S3 + CloudFront]       [Lambda + API GW]    │
│   or [Amplify]            or [Amplify]            or [EC2 t2.micro]    │
│   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐      │
│   │  Web Admin  │         │ Mobile PWA  │  ─────▶ │  NestJS API │      │
│   │  (Static)   │         │  (Static)   │         │   :3000     │      │
│   └─────────────┘         └─────────────┘         └──────┬──────┘      │
│                                                          │             │
│                                  ┌───────────────────────┼─────────────┤
│                                  ▼                       ▼             │
│                            [Neon/RDS]             [Upstash/ElastiCache]│
│                           PostgreSQL                   Redis           │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## AWS Free Tier Summary (2025-2026)

| Category        | Services              | Free Tier Limits                  | Duration    |
| --------------- | --------------------- | --------------------------------- | ----------- |
| **Compute**     | EC2 t2.micro/t3.micro | 750 hours/month                   | 12 months   |
| **Serverless**  | Lambda                | 1M requests + 400K GB-sec/month   | Always Free |
| **API Gateway** | REST/HTTP APIs        | 1M API calls/month                | 12 months   |
| **Storage**     | S3                    | 5GB storage, 20K GET, 2K PUT      | 12 months   |
| **CDN**         | CloudFront            | 1TB data out, 10M requests/month  | Always Free |
| **Hosting**     | Amplify Hosting       | 5GB storage, 15GB/month bandwidth | Always Free |
| **Container**   | App Runner            | None (not free tier)              | N/A         |

## Option 1: AWS Amplify Hosting (Recommended for Frontend)

**Best for**: Static web apps (Angular, React, Vue)
**Free tier**: 5GB storage, 15GB bandwidth/month (Always Free)

### Step 1: Install Amplify CLI

```bash
npm install -g @aws-amplify/cli
amplify configure
```

### Step 2: Build Frontend Apps

```bash
# Build for production
pnpm web:build:cloudflare
pnpm mobile:build:cloudflare
```

### Step 3: Deploy via Amplify Console

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click "New App" → "Host web app"
3. Choose "Deploy without Git provider" (for manual upload)
4. Upload `apps/web/dist/web/browser/` as a ZIP
5. Configure:
   - App name: `erp-web`
   - Environment: `production`
6. Click "Save and deploy"

Repeat for mobile app with `apps/mobile/www/browser/`

### Step 4: Configure Rewrites for SPA

In Amplify Console → App settings → Rewrites and redirects:

| Source                                                                                             | Target        | Type          |
| -------------------------------------------------------------------------------------------------- | ------------- | ------------- |
| `</^[^.]+$\|\.(?!(css\|gif\|ico\|jpg\|js\|png\|txt\|svg\|woff\|woff2\|ttf\|map\|json)$)([^.]+$)/>` | `/index.html` | 200 (Rewrite) |

## Option 2: S3 + CloudFront (Static Website)

**Best for**: High-traffic static sites with global CDN
**Free tier**: S3 (5GB, 12mo) + CloudFront (1TB/month, Always Free)

### Step 1: Create S3 Bucket

```bash
# Install AWS CLI if not installed
brew install awscli  # macOS
# or
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# Configure credentials
aws configure
# Enter: Access Key ID, Secret Access Key, Region (ap-northeast-2), Output (json)

# Create bucket for web app
aws s3 mb s3://erp-web-app --region ap-northeast-2

# Enable static website hosting
aws s3 website s3://erp-web-app --index-document index.html --error-document index.html
```

### Step 2: Upload Files

```bash
# Build apps
pnpm web:build:cloudflare
pnpm mobile:build:cloudflare

# Upload web app
aws s3 sync apps/web/dist/web/browser/ s3://erp-web-app --delete

# Upload mobile app (separate bucket)
aws s3 mb s3://erp-mobile-app --region ap-northeast-2
aws s3 website s3://erp-mobile-app --index-document index.html --error-document index.html
aws s3 sync apps/mobile/www/browser/ s3://erp-mobile-app --delete
```

### Step 3: Create CloudFront Distribution

```bash
# Create distribution (via AWS Console is easier)
# Go to CloudFront → Create Distribution
# - Origin domain: erp-web-app.s3.ap-northeast-2.amazonaws.com
# - Viewer protocol policy: Redirect HTTP to HTTPS
# - Default root object: index.html
# - Error pages: 403/404 → /index.html (for SPA routing)
```

**CloudFront URLs**:

- `https://d1234567890.cloudfront.net` (Web)
- `https://d0987654321.cloudfront.net` (Mobile)

## Option 3: EC2 t2.micro (Backend API)

**Best for**: Running NestJS API server 24/7
**Free tier**: 750 hours/month for 12 months (enough for 1 instance)

### Step 1: Launch EC2 Instance

1. Go to [EC2 Console](https://console.aws.amazon.com/ec2/)
2. Click "Launch Instance"
3. Configure:
   - **Name**: `erp-api-server`
   - **AMI**: Amazon Linux 2023 (free tier eligible)
   - **Instance type**: `t2.micro` (1 vCPU, 1GB RAM)
   - **Key pair**: Create new or use existing
   - **Security group**: Allow ports 22 (SSH), 80 (HTTP), 443 (HTTPS), 3000 (API)
   - **Storage**: 8GB gp3 (free tier: up to 30GB)
4. Click "Launch instance"

### Step 2: Connect and Setup

```bash
# Connect via SSH
ssh -i "your-key.pem" ec2-user@<public-ip>

# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install pnpm
npm install -g pnpm

# Install Git
sudo yum install -y git

# Clone repository
git clone https://github.com/ChungHwemo/ERP.git
cd ERP

# Install dependencies
pnpm install

# Generate Prisma client
pnpm db:generate
```

### Step 3: Configure Environment

```bash
# Create .env file
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://neondb_owner:npg_nbSqaC3r9PIR@ep-autumn-fog-a14vc6oi-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
REDIS_URL=rediss://default:AUtLAAIncDFjY2MxYjg2MDk2NGE0OTVmOTA4MDM4MWFhMmRlM2ViYXAxMTkyNzU@loyal-pug-19275.upstash.io:6379
JWT_ACCESS_SECRET=your-secret-key-change-this
JWT_REFRESH_SECRET=your-refresh-key-change-this
VAPID_PUBLIC_KEY=BKhZimf9ZSYATJp0BStlIFRUCtpgL3J2SOPd7dnUFQ5YGpeiQ23BfcihlPGkcHVgN1TS76netQ9ak4NJE1EaI7Y
VAPID_PRIVATE_KEY=gaOJrxcCS8CDr9HNbOsdK6Q88Yv8MuKjil7843IbOwc
CORS_ORIGINS=https://d1234567890.cloudfront.net,https://d0987654321.cloudfront.net
EOF
```

### Step 4: Run API with PM2

```bash
# Install PM2 for process management
npm install -g pm2

# Build API
pnpm api:build

# Start API
pm2 start apps/api/dist/main.js --name erp-api

# Save PM2 process list
pm2 save

# Setup auto-start on reboot
pm2 startup
# Run the command it outputs
```

### Step 5: Setup Nginx Reverse Proxy (Optional)

```bash
# Install Nginx
sudo yum install -y nginx

# Configure Nginx
sudo cat > /etc/nginx/conf.d/erp-api.conf << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Option 4: Lambda + API Gateway (Serverless)

**Best for**: Low-traffic APIs, pay-per-request
**Free tier**: 1M requests/month (Always Free)

> **Note**: NestJS requires adaptation for Lambda. Consider using `@vendia/serverless-express`.

### Step 1: Install Serverless Framework

```bash
npm install -g serverless
```

### Step 2: Create serverless.yml

```yaml
# serverless.yml (create in apps/api/)
service: erp-api

provider:
  name: aws
  runtime: nodejs20.x
  region: ap-northeast-2
  memorySize: 512
  timeout: 30
  environment:
    NODE_ENV: production
    DATABASE_URL: ${env:DATABASE_URL}
    REDIS_URL: ${env:REDIS_URL}
    JWT_ACCESS_SECRET: ${env:JWT_ACCESS_SECRET}
    JWT_REFRESH_SECRET: ${env:JWT_REFRESH_SECRET}

functions:
  api:
    handler: dist/lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true

plugins:
  - serverless-offline
```

### Step 3: Create Lambda Handler

```typescript
// apps/api/src/lambda.ts
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import serverlessExpress from '@vendia/serverless-express';
import express from 'express';

let cachedServer: any;

async function bootstrap() {
  if (!cachedServer) {
    const expressApp = express();
    const adapter = new ExpressAdapter(expressApp);
    const app = await NestFactory.create(AppModule, adapter);
    app.enableCors();
    await app.init();
    cachedServer = serverlessExpress({ app: expressApp });
  }
  return cachedServer;
}

export const handler = async (event: any, context: any) => {
  const server = await bootstrap();
  return server(event, context);
};
```

### Step 4: Deploy

```bash
cd apps/api
serverless deploy
```

## Cost Comparison

| Service             | Free Tier                   | After Free Tier   |
| ------------------- | --------------------------- | ----------------- |
| **Amplify Hosting** | 5GB + 15GB/mo (Always Free) | $0.023/GB served  |
| **S3**              | 5GB (12mo)                  | $0.023/GB/month   |
| **CloudFront**      | 1TB/mo (Always Free)        | $0.085/GB         |
| **EC2 t2.micro**    | 750 hrs/mo (12mo)           | ~$8.50/month      |
| **Lambda**          | 1M req/mo (Always Free)     | $0.20/1M requests |
| **API Gateway**     | 1M req/mo (12mo)            | $3.50/1M requests |

## Recommended Architecture for Free Tier

### Minimal Cost (Uses external DB/Redis already configured):

```
Frontend: AWS Amplify Hosting (Always Free)
Backend:  EC2 t2.micro (12-month free) or Lambda (Always Free)
Database: Neon PostgreSQL (Already configured - external)
Cache:    Upstash Redis (Already configured - external)
```

### After 12 Months:

Consider migrating to:

- **Frontend**: Cloudflare Pages (Always Free, unlimited)
- **Backend**: Render.com, Railway, or Fly.io free tiers

## Monitoring Free Tier Usage

```bash
# Check free tier usage via AWS CLI
aws ce get-cost-and-usage \
  --time-period Start=2026-01-01,End=2026-01-31 \
  --granularity MONTHLY \
  --metrics "UsageQuantity" "BlendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE
```

Or visit: [AWS Billing Dashboard](https://console.aws.amazon.com/billing/) → Free Tier

## Security Best Practices

1. **Never commit credentials** - Use environment variables or AWS Secrets Manager
2. **Enable MFA** on your AWS root account
3. **Use IAM users** instead of root account for deployments
4. **Set billing alerts** at $0.01 to catch unexpected charges
5. **Review Security Groups** - Only open necessary ports

## Troubleshooting

### "You have exceeded your free tier limit"

- Check CloudWatch for usage spikes
- Verify instance type is t2.micro (not t2.small or larger)
- Ensure you're in the correct region

### EC2 instance not accessible

- Check Security Group allows inbound traffic on required ports
- Verify instance is in "running" state
- Check if Elastic IP is associated (public IP changes on restart without EIP)

### Lambda cold start issues

- Increase memory allocation (also increases CPU)
- Use Provisioned Concurrency (not free)
- Keep functions warm with scheduled events

## Quick Start Commands

```bash
# Prerequisites
npm install -g @aws-amplify/cli aws-cdk serverless

# Build all apps
pnpm web:build:cloudflare
pnpm mobile:build:cloudflare
pnpm api:build

# Deploy to Amplify (after amplify configure)
amplify init
amplify add hosting
amplify publish

# Deploy to S3
aws s3 sync apps/web/dist/web/browser/ s3://your-bucket-name --delete
```

## Related Documentation

- [AWS Free Tier FAQ](https://aws.amazon.com/free/free-tier-faqs/)
- [AWS Amplify Hosting](https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html)
- [EC2 Getting Started](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/EC2_GetStarted.html)
- [Serverless Framework](https://www.serverless.com/framework/docs)
