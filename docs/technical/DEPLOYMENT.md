# Deployment & Release Plan

## 1. Environments
| Env | Purpose | Access |
| --- | --- | --- |
| DEV | Daily development; feature validation. | VPN + developer credentials. |
| STG | Pre-production, mirrors prod data subset. | VPN + QA accounts. |
| PROD | Live branch/partner access. | VPN + SSO-ready (future). |

Each environment runs isolated PostgreSQL + Redis instances with seeded data.

## 2. Pipeline
1. Developer merges feature branch → `develop`.
2. CI (GitHub Actions): lint → unit tests → build → Lighthouse PWA audit.
3. Artifact bundling (Docker images for API, static assets for CDN) pushed to registry.
4. Argo CD deploys API to DEV automatically; STG requires manual promote.
5. PROD deploy triggered after UAT sign-off; uses blue/green strategy.

### Zero-Downtime Deployment (Blue/Green)
```
1. [Prepare] Build new image (Green), push to registry.
2. [Deploy]  Spin up Green pods alongside Blue (current).
3. [Test]    Run smoke tests against Green (internal endpoint).
4. [Switch]  Update ingress to route traffic to Green.
5. [Monitor] Watch error rate for 15 min.
6. [Cleanup] If healthy, terminate Blue pods. If errors spike, rollback.
```

### Canary Deployment (Optional for Major Releases)
```
1. Route 5% traffic to new version.
2. Monitor KPIs (error rate, latency) for 30 min.
3. If healthy, increase to 25% → 50% → 100%.
4. If degraded at any step, rollback to 0%.
```

### Service Worker Deployment (PWA)
- Precache manifest hash triggers SW update.
- On new SW detected: Show "Update available" toast via `SwUpdate`.
- User clicks "Update" → `activateUpdate()` → page reloads with new version.
- Force update: Deploy with `FORCE_REFRESH` WebSocket event for critical patches.

## 2.1 Native App Deployment

### Android Deployment
```
┌─────────────────────────────────────────────────────────────────┐
│                    Android Build Pipeline                       │
├─────────────────────────────────────────────────────────────────┤
│  1. ionic build --configuration=production                      │
│  2. npx cap sync android                                        │
│  3. cd android && ./gradlew assembleRelease (or bundleRelease) │
│  4. Sign APK/AAB with release keystore                         │
│  5. Upload to:                                                  │
│     - Internal: Direct APK distribution via company portal     │
│     - External: Google Play Console (AAB)                      │
└─────────────────────────────────────────────────────────────────┘

Version Management:
- versionCode: Auto-increment on each build (CI build number)
- versionName: Semantic versioning (1.0.0, 1.1.0, etc.)
- Update via capacitor.config.ts and android/app/build.gradle
```

### iOS Deployment
```
┌─────────────────────────────────────────────────────────────────┐
│                    iOS Build Pipeline                           │
├─────────────────────────────────────────────────────────────────┤
│  1. ionic build --configuration=production                      │
│  2. npx cap sync ios                                            │
│  3. Open in Xcode: npx cap open ios                            │
│  4. Archive (Product → Archive)                                │
│  5. Distribute:                                                 │
│     - TestFlight: Internal testing (up to 10,000 testers)      │
│     - App Store: Public release (requires Apple review)        │
└─────────────────────────────────────────────────────────────────┘

Certificates & Provisioning:
- Distribution Certificate (requires Apple Developer account)
- App Store Provisioning Profile
- Push Notification Certificate (for FCM via APNs)
```

### In-App Updates (Native)
```typescript
// Using @capawesome/capacitor-app-update
import { AppUpdate, AppUpdateAvailability } from '@capawesome/capacitor-app-update';

async function checkForUpdates() {
  const result = await AppUpdate.getAppUpdateInfo();
  
  if (result.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE) {
    // Show update prompt
    if (result.immediateUpdateAllowed) {
      await AppUpdate.performImmediateUpdate();  // Force update
    } else if (result.flexibleUpdateAllowed) {
      await AppUpdate.startFlexibleUpdate();     // Background download
    }
  }
}
```

### Native Store Submission Checklist
| Item | Android (Play) | iOS (App Store) |
| --- | --- | --- |
| Bundle identifiers | `com.company.erp.logistics` | `com.company.erp.logistics` (reverse DNS) |
| Versioning | `versionName` + `versionCode` (monotonic) | `CFBundleShortVersionString` + `CFBundleVersion` |
| Release tracks | Internal → Closed Testing → Production | TestFlight → App Store Review → Production |
| Privacy declarations | Data safety form: location (No), personal info (Yes: customer data processed), camera usage | App Privacy Details + Privacy Manifest (camera, photos, push) |
| Screenshots | 7" + 10" tablet, 6.7" & 5.5" phones | 6.7" & 6.5" + iPad Pro |
| Permissions rationale | `CAMERA`, `READ_MEDIA_IMAGES`, `POST_NOTIFICATIONS`, `INTERNET` | NSCameraUsage, NSPhotoLibraryUsage, NSPhotoLibraryAddUsage, NSUserTrackingUsage (if analytics) |
| VPN requirement note | Mention in store listing + first-launch modal | Same |
| Review artifacts | Demo credentials, video walkthrough for reviewer | Demo credentials, video walkthrough |

- Maintain release notes and changelog referencing PRs.
- Automate version bump + changelog generation via `changesets` step in CI to avoid mismatches.
- Store metadata stored as JSON (Play) / App Store Connect API payloads for reproducible submissions.

## 3. Configuration Management
- Secrets stored in Vault/KMS; workloads mount via sidecar.
- Config maps per env for API base URLs, feature flags, i18n default.
- `.env` strictly local; use `env.example` template.

## 4. Data Migration
- Use Prisma migrations for schema changes.
- Back up PostgreSQL before each release (pg_dump to S3 bucket with retention).
- Provide rollback scripts + seed data for test cases (orders, installers, waste codes).

### Database Migration Coordination (Expand-Contract)
For zero-downtime with schema changes:

**Phase 1: Expand (Release N)**
1. Add new column/table (nullable, with defaults).
2. Deploy app that writes to BOTH old and new columns.
3. No downtime — reads still use old column.

**Phase 2: Migrate (Between Releases)**
1. Run backfill job during off-peak (batches of 1000, throttled).
2. Verify data consistency.

**Phase 3: Contract (Release N+1)**
1. Deploy app that reads/writes new column only.
2. Drop old column in subsequent migration.
3. Monitor for any remaining queries using old column.

### Migration Checklist
- [ ] Backup verified and tested.
- [ ] Migration script tested on staging with prod-like data volume.
- [ ] Rollback script prepared and tested.
- [ ] Off-peak window scheduled (02:00-05:00 KST).
- [ ] Monitoring alerts silenced appropriately.
- [ ] Stakeholders notified.

## 4.1 Rollback Procedures
### Application-Only Rollback
```bash
# Argo CD
argocd app rollback erp-web --revision <previous>

# Or manual
kubectl set image deployment/erp-web web=erp-web:<previous-tag>
```

### Application + Database Rollback
1. **Stop traffic**: Scale down pods or enable maintenance mode.
2. **Restore database**: 
   - PITR: `pg_restore` to specific timestamp.
   - Full backup: Restore from latest pre-release backup.
3. **Rollback app**: Deploy previous image.
4. **Verify**: Run smoke tests.
5. **Resume traffic**: Scale up / disable maintenance mode.

### Rollback Decision Matrix
| Scenario | Action |
| --- | --- |
| Error rate >5% after deploy | Immediate app rollback |
| Data corruption detected | Maintenance mode + DB restore + app rollback |
| Performance degraded >50% | Canary rollback or full rollback |
| Single feature broken | Feature flag disable or hotfix |

### Post-Rollback Actions
1. Document incident in runbook.
2. Create RCA (Root Cause Analysis) ticket.
3. Add regression test for the issue.
4. Schedule follow-up release.

## 5. Monitoring & Rollback
- Health checks for web/API containers.
- Alert on error rate >2% or latency >1s for 5 min.
- Automated rollback via Argo if deployment fails health checks.
- Manual rollback guide: redeploy previous image, restore DB backup if necessary.

### Alert Rules (Prometheus/Grafana)
| Alert | Condition | Severity | Action |
| --- | --- | --- | --- |
| HighErrorRate | HTTP 5xx rate >2% for 5min | Critical | Page on-call; consider rollback |
| HighLatency | P95 latency >1s for 5min | Warning | Investigate; scale if needed |
| DatabaseConnectionPool | Pool usage >80% for 5min | Warning | Scale DB or optimize queries |
| RedisConnectionFailed | Redis ping fails for 1min | Critical | Check Redis health; failover |
| BackgroundSyncQueueDepth | Pending items >100 for 15min | Warning | Check sync service; clear stuck items |
| PushNotificationFailure | Failure rate >5% for 10min | Warning | Check push gateway; fall back to email |
| DiskSpaceWarning | Volume usage >80% | Warning | Clean old exports; expand volume |
| CertificateExpiry | SSL cert expires in <14 days | Warning | Renew certificate |
| PodRestartLoop | Restart count >3 in 10min | Critical | Check logs; fix crash loop |

### Dashboard Panels
- Request rate & latency (P50, P95, P99).
- Error rate by endpoint.
- Active users and sessions.
- Database query latency.
- Background sync queue depth.
- Push notification delivery rate.
- Cache hit ratio.

## 6. Release Communication
- Publish release notes summarizing features & manual slide coverage.
- Provide short training videos (screen capture) for new flows.
- Capture known issues + workaround list.

## 7. Post-Release Checklist
- Verify push notifications across devices after go-live.
- Validate ECOAS export against sample template.
- Confirm offline mode works when VPN disconnects mid-session.
- Review metrics (KPI accuracy, adoption) after 1 week.

## 8. Disaster Recovery Plan
### Recovery Objectives
- **RTO (Recovery Time Objective)**: 4 hours.
- **RPO (Recovery Point Objective)**: 1 hour.

### DR Architecture
```
Primary Region (On-Prem/Cloud Region A)
├── K8s Cluster (Active)
├── PostgreSQL Primary
├── Redis Primary
└── S3 (Exports)

DR Region (Cloud Region B) - Warm Standby
├── K8s Cluster (Standby, minimal replicas)
├── PostgreSQL Replica (Streaming replication)
├── Redis Replica
└── S3 (Cross-region replication)
```

### Failover Procedure
1. **Detect**: Automated monitoring detects primary failure.
2. **Decide**: On-call confirms DR activation (avoid split-brain).
3. **Promote**: 
   - Promote PostgreSQL replica to primary.
   - Promote Redis replica.
   - Scale up DR K8s replicas.
4. **Switch DNS**: Update DNS to point to DR load balancer.
5. **Notify**: Send status update to stakeholders.
6. **Verify**: Run smoke tests on DR environment.

### Failback Procedure
1. Restore primary region infrastructure.
2. Set up replication from DR to primary.
3. Verify data consistency.
4. Switch DNS back to primary.
5. Demote DR back to standby.

### DR Testing Schedule
- **Quarterly**: Tabletop exercise (walkthrough without actual failover).
- **Annually**: Full DR drill (actual failover to DR, then failback).
- Document lessons learned after each drill.

## 9. Feature Flags
### Implementation
- Environment variable based for v1 (simple).
- Consider LaunchDarkly or Unleash for future (gradual rollout).

### Flag Naming Convention
```
FEATURE_<MODULE>_<NAME>=true|false

Examples:
FEATURE_SETTLEMENT_LOCK=true
FEATURE_OFFLINE_SYNC=true
FEATURE_PUSH_NOTIFICATIONS=true
```

### Rollout Strategy
1. Deploy with flag disabled.
2. Enable for internal users (HQ) first.
3. Enable for pilot branch.
4. Enable for all branches.
5. Remove flag after stable (1-2 weeks).

## 10. Infrastructure as Code (Future)
- Terraform modules for:
  - K8s cluster (EKS/GKE or on-prem)
  - PostgreSQL RDS/CloudSQL
  - Redis ElastiCache/MemoryStore
  - S3 bucket for exports
  - VPC and security groups
- GitOps: Argo CD syncs from infra repo.
