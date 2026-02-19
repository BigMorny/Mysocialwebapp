# NMysocial Deployment Guide

## Staging

### 1) Configure environment
Create `apps/api/.env` with production-safe values:

```env
NODE_ENV=production
API_PORT=4000
WEB_ORIGIN=https://staging.yourdomain.com
SESSION_COOKIE_NAME=mysocial_session
SESSION_COOKIE_SECRET=<64+ random chars>
DATABASE_URL=<staging postgres url>
COOKIE_SECRET=<64+ random chars>

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<smtp user>
SMTP_PASS=<smtp pass>
SMTP_FROM=MySocial <noreply@yourdomain.com>
APP_BASE_URL=https://staging.yourdomain.com

ADMIN_PHONE=0543115560
ADMIN_EMAIL=mysocialhelp00@gmail.com
ADMIN_PASSWORD=<strong 12+ password>
```

### 2) Install + verify

```bash
pnpm install --frozen-lockfile
pnpm --filter api exec tsc -p tsconfig.json --noEmit
pnpm --filter web exec tsc -p tsconfig.json --noEmit
pnpm --filter web build
```

### 3) Run DB migrations

```bash
pnpm --filter api prisma migrate deploy
pnpm --filter api prisma generate
```

### 4) Start services

```bash
pnpm dev
```

### 5) Staging smoke test
- `/login`, `/signup`, `/dashboard`
- inventory/dealers/consignments CRUD and status transitions
- `/admin/approvals`, `/admin/shops`, `/admin/audit`, `/admin/support`
- admin password verification flow

---

## Production

### 1) Take DB backup first

```bash
pg_dump "<PROD_DATABASE_URL>" -Fc -f "backup_$(date +%Y%m%d_%H%M).dump"
```

### 2) Deploy code + validate

```bash
pnpm install --frozen-lockfile
pnpm --filter api exec tsc -p tsconfig.json --noEmit
pnpm --filter web exec tsc -p tsconfig.json --noEmit
pnpm --filter web build
```

### 3) Apply DB changes

```bash
pnpm --filter api prisma migrate deploy
pnpm --filter api prisma generate
```

### 4) Restart services

```bash
pm2 restart mysocial-api
pm2 restart mysocial-web
```

### 5) Post-deploy checks

```bash
curl -i https://api.yourdomain.com/api/health
```

- shop user login + dashboard access
- admin login + admin verification + admin pages
- subscription-gated shop still blocked correctly when expired

