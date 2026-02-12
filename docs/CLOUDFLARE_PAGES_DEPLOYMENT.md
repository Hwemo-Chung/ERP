# Cloudflare Pages Deployment Guide

## Overview

This guide explains how to deploy ERP Logistics frontend apps (Web Admin & Mobile PWA) to Cloudflare Pages for free testing.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Test Deployment (Free)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   [Cloudflare Pages]      [Cloudflare Pages]      [Local]       │
│   erp-web.pages.dev       erp-mobile.pages.dev    API Server    │
│   ┌─────────────┐         ┌─────────────┐        ┌──────────┐  │
│   │  Web Admin  │         │ Mobile PWA  │  ───▶  │ NestJS   │  │
│   │  Dashboard  │         │   App       │        │  :3000   │  │
│   └─────────────┘         └─────────────┘        └────┬─────┘  │
│                                                       │        │
│                                   ┌───────────────────┼────────┤
│                                   ▼                   ▼        │
│                             [Neon]              [Upstash]       │
│                          PostgreSQL 15          Redis 7        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. Cloudflare account (free, no credit card required)
2. Node.js 20.x and pnpm 9.x
3. Local API server with database connection

## Build Commands

```bash
# Build for Cloudflare Pages
pnpm web:build:cloudflare
pnpm mobile:build:cloudflare
```

**Build output locations:**

- Web: `apps/web/dist/web/browser/`
- Mobile: `apps/mobile/www/browser/`

## Deployment Methods

### Method 1: Cloudflare Dashboard (Recommended for Private Repos)

1. **Create Cloudflare Account**: Go to https://dash.cloudflare.com/sign-up

2. **Deploy Web Admin**:
   - Go to "Workers & Pages" → "Create Application" → "Pages"
   - Select "Upload assets"
   - Project name: `erp-web`
   - Upload contents of `apps/web/dist/web/browser/`
   - Click "Deploy"

3. **Deploy Mobile PWA**:
   - Repeat above steps
   - Project name: `erp-mobile`
   - Upload contents of `apps/mobile/www/browser/`

### Method 2: Wrangler CLI

```bash
# Install wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy Web
wrangler pages deploy apps/web/dist/web/browser --project-name erp-web

# Deploy Mobile
wrangler pages deploy apps/mobile/www/browser --project-name erp-mobile
```

### Method 3: Git Integration (Requires Public Repo)

1. Connect your GitHub repository
2. Configure:
   - **Web App**:
     - Build command: `pnpm web:build:cloudflare`
     - Build output: `apps/web/dist/web/browser`
   - **Mobile App**:
     - Build command: `pnpm mobile:build:cloudflare`
     - Build output: `apps/mobile/www/browser`

## Running Local API Server

The frontend apps connect to `http://localhost:3000/api/v1` by default.

```bash
# Set environment variables
export DATABASE_URL="postgresql://neondb_owner:npg_nbSqaC3r9PIR@ep-autumn-fog-a14vc6oi-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
export REDIS_URL="rediss://default:AUtLAAIncDFjY2MxYjg2MDk2NGE0OTVmOTA4MDM4MWFhMmRlM2ViYXAxMTkyNzU@loyal-pug-19275.upstash.io:6379"
export JWT_ACCESS_SECRET="your-secret-key"
export JWT_REFRESH_SECRET="your-refresh-secret-key"
export CORS_ORIGINS="https://erp-web.pages.dev,https://erp-mobile.pages.dev"

# Start API server
pnpm api:dev
```

## Test Credentials

| Role      | Login ID | Password |
| --------- | -------- | -------- |
| Test User | 0001     | test     |

## Expected URLs

After deployment:

- **Web Admin**: `https://erp-web.pages.dev`
- **Mobile PWA**: `https://erp-mobile.pages.dev`

## SPA Routing

Both apps include `_redirects` file for proper SPA routing on Cloudflare Pages:

```
/*    /index.html   200
```

## CORS Configuration

If deploying API to cloud, update `CORS_ORIGINS` environment variable:

```
CORS_ORIGINS=https://erp-web.pages.dev,https://erp-mobile.pages.dev
```

## Troubleshooting

### "API not reachable" error

- Ensure local API server is running on port 3000
- Check browser console for CORS errors
- Verify DATABASE_URL and REDIS_URL are correct

### Blank page after deployment

- Check browser console for errors
- Verify `_redirects` file is included in build output
- Clear browser cache and try again

### PWA not installing

- PWA requires HTTPS (Cloudflare Pages provides this)
- Check manifest.webmanifest is accessible

## Free Tier Limits

| Service          | Limit                             |
| ---------------- | --------------------------------- |
| Cloudflare Pages | Unlimited sites, 500 builds/month |
| Neon PostgreSQL  | 0.5GB storage, auto-suspend       |
| Upstash Redis    | 10,000 commands/day               |

## Alternative: Local Development

For purely local testing without cloud deployment:

```bash
# Terminal 1: Start API
pnpm api:dev

# Terminal 2: Start Web
pnpm web:dev

# Terminal 3: Start Mobile
pnpm mobile:dev
```

Access at:

- API: http://localhost:3000
- Web: http://localhost:4300
- Mobile: http://localhost:4200
