# Development Credentials & Sample Data

> Quick reference for local development environment

---

## Database (Adminer)

**URL**: http://localhost:8080

| Field | Value |
|-------|-------|
| System | PostgreSQL |
| Server | `postgres` |
| Username | `erp_user` |
| Password | `erp_password` |
| Database | `erp_logistics` |

---

## Application URLs

| Service | URL | Description |
|---------|-----|-------------|
| Mobile App | http://localhost:4200 | Angular + Ionic PWA |
| API Server | http://localhost:3000 | NestJS Backend |
| Swagger Docs | http://localhost:3000/docs | API Documentation |
| Adminer | http://localhost:8080 | Database GUI |

---

## Sample User Accounts

| Role | Username | Password | Branch |
|------|----------|----------|--------|
| **HQ Admin** | `admin` | `admin123!` | HQ |
| **Branch Manager** | `manager01` | `manager123!` | SEL01 |
| **Partner Coordinator** | `coord01` | `coord123!` | SEL01 |
| **Installer** | `installer01` | `inst123!` | SEL01 |
| **Test User** | `0001` | `test` | SEL01 |

### Additional Installers (password: `test123!`)
- `installer02` ~ `installer10`

---

## API Authentication

### Login Request
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -H 'X-App-Version: 1.0.0' \
  -H 'X-Device-Id: dev-test' \
  -H 'X-Platform: web' \
  -d '{"username":"0001","password":"test"}'
```

### Required Headers
```
Authorization: Bearer <accessToken>
X-App-Version: 1.0.0
X-Device-Id: <uuid>
X-Platform: web|android|ios
```

---

## Database Tables (24)

### Core Tables
| Table | Description |
|-------|-------------|
| `users` | User accounts |
| `orders` | Order records |
| `order_lines` | Order line items |
| `branches` | Branch locations |
| `installers` | Field installers |
| `partners` | Partner companies |

### Transaction Tables
| Table | Description |
|-------|-------------|
| `cancellation_records` | Cancelled orders + return tracking |
| `serial_numbers` | Product serial numbers |
| `waste_pickups` | Waste appliance pickups |
| `attachments` | File attachments |
| `order_status_history` | Status change audit |
| `audit_logs` | System audit trail |

### Reference Tables
| Table | Description |
|-------|-------------|
| `waste_codes` | P01-P21 waste codes |
| `reason_codes` | Cancellation/postpone reasons |
| `settlement_periods` | Weekly settlement locks |

---

## Docker Commands

```bash
# Start containers
docker compose up -d

# Stop containers
docker compose down

# View logs
docker compose logs -f

# Reset database
docker compose down -v
docker compose up -d
pnpm db:migrate
pnpm db:seed
```

---

## Development Commands

```bash
# Start API server
pnpm api:dev

# Start Mobile app
pnpm mobile:dev

# Run database migration
pnpm db:migrate

# Seed sample data
npx tsx prisma/seed.ts

# Generate Prisma client
pnpm db:generate
```

---

## Order Status Flow

```
UNASSIGNED → ASSIGNED → CONFIRMED → RELEASED → DISPATCHED
                                                    ↓
                                              COMPLETED
                                                    ↓
                                              COLLECTED

Any state → REQUEST_CANCEL → CANCELLED
DISPATCHED → POSTPONED (max +15 days)
DISPATCHED → ABSENT (max 3 retries)
```

---

## Troubleshooting

### 401 Unauthorized Loop
```javascript
// Run in browser console (F12)
localStorage.clear();
sessionStorage.clear();
indexedDB.deleteDatabase('erp-logistics-db');
location.reload();
```

### Database Connection Error
```bash
# Check if containers are running
docker ps

# Start Colima (macOS)
colima start

# Restart containers
docker compose restart
```

### Port Already in Use
```bash
# Find process on port
lsof -i :3000
lsof -i :4200

# Kill process
kill -9 <PID>
```

---

*Last updated: 2025-12-26*
