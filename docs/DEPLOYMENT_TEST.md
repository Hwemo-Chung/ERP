# Test Deployment Guide

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Test Deployment                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   [Vercel]              [Vercel]              [Render.com]  │
│   erp-web-test          erp-mobile-test       erp-api       │
│   ┌─────────┐          ┌─────────┐          ┌─────────────┐│
│   │   Web   │          │ Mobile  │    ───▶  │  NestJS API ││
│   │ (Admin) │          │  (PWA)  │          │    :3000    ││
│   └─────────┘          └─────────┘          └──────┬──────┘│
│                                                    │        │
│                              ┌─────────────────────┼────────┤
│                              ▼                     ▼        │
│                        [Neon]               [Upstash]       │
│                     PostgreSQL 15            Redis 7        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Services

| Service    | Platform   | URL                                    |
| ---------- | ---------- | -------------------------------------- |
| API        | Render.com | https://erp-logistics-api.onrender.com |
| Web Admin  | Vercel     | https://erp-web-test.vercel.app        |
| Mobile PWA | Vercel     | https://erp-mobile-test.vercel.app     |
| Database   | Neon       | PostgreSQL 15 (Singapore)              |
| Cache      | Upstash    | Redis 7 (Tokyo)                        |

## Environment Variables

### Render.com (API)

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://neondb_owner:xxx@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
REDIS_URL=rediss://default:xxx@apn1-xxx.upstash.io:6379
JWT_ACCESS_SECRET=<generated>
JWT_REFRESH_SECRET=<generated>
VAPID_PUBLIC_KEY=BKhZimf9ZSYATJp0BStlIFRUCtpgL3J2SOPd7dnUFQ5YGpeiQ23BfcihlPGkcHVgN1TS76netQ9ak4NJE1EaI7Y
VAPID_PRIVATE_KEY=gaOJrxcCS8CDr9HNbOsdK6Q88Yv8MuKjil7843IbOwc
CORS_ORIGINS=https://erp-web-test.vercel.app,https://erp-mobile-test.vercel.app
```

### Vercel (Frontend)

No environment variables needed - API URL is baked into the build.

## Deployment Steps

### 1. Deploy API to Render.com

1. Go to https://dashboard.render.com
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `erp-logistics-api`
   - **Region**: Singapore
   - **Branch**: main
   - **Build Command**:
     ```
     corepack enable && corepack prepare pnpm@9.14.4 --activate && pnpm install --frozen-lockfile && pnpm --filter erp-logistics-api run prisma:generate && pnpm --filter erp-logistics-api run build
     ```
   - **Start Command**: `pnpm --filter erp-logistics-api run start:prod`
   - **Plan**: Free
5. Add Environment Variables (from above)
6. Deploy

### 2. Run Database Migration

After API deploys, run migration via Render Shell:

```bash
pnpm --filter erp-logistics-api run prisma:migrate:prod
pnpm --filter erp-logistics-api run prisma:seed
```

### 3. Deploy Web to Vercel

1. Go to https://vercel.com/new
2. Import repository
3. Configure:
   - **Framework Preset**: Other
   - **Root Directory**: `apps/web`
   - **Build Command**: (uses vercel.json)
   - **Output Directory**: (uses vercel.json)
4. Deploy

### 4. Deploy Mobile to Vercel

1. Go to https://vercel.com/new
2. Import same repository
3. Configure:
   - **Project Name**: `erp-mobile-test`
   - **Root Directory**: `apps/mobile`
4. Deploy

### 5. Update CORS

After Vercel deployments, update `CORS_ORIGINS` in Render with actual URLs.

## Health Check

- API Health: https://erp-logistics-api.onrender.com/api/v1/health
- API Docs: https://erp-logistics-api.onrender.com/docs

## Notes

- Render free tier sleeps after 15 min inactivity (first request takes ~30s)
- Neon free tier: 0.5GB storage, auto-suspend after 5 min
- Upstash free tier: 10,000 commands/day
