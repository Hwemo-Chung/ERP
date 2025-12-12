# Project Overview

## Executive Summary
The Logistics Branch & Partner App will digitize every workflow described in the 2017 "영업물류 사용 매뉴얼" so that branch staff and partner FDC installers can manage delivery assignments, execution, and reporting from **any platform** (Web PWA, Android native app, iOS native app). Built with **Angular 19 + Ionic 8 + Capacitor 6**, the application must behave like a native app with excellent performance on low-end devices, surface alarm-style push notifications (FCM), and expose bilingual (Korean/English) UX from day one. There is no legacy integration; all logistics functionality must be rebuilt as a standalone, secure cross-platform stack.

## Technology Decisions
| Category | Choice | Rationale |
| --- | --- | --- |
| Framework | Angular 19 (Standalone, Signals) | Strong typing, enterprise-ready, zoneless for performance |
| UI Library | Ionic 8 | Platform-adaptive components, native look & feel |
| Cross-Platform | Capacitor 6 | Single codebase → Web/Android/iOS, native plugin access |
| State Management | NgRx SignalStore | Fine-grained reactivity, minimal boilerplate |
| i18n | @ngx-translate/core | Runtime language switching |
| Offline | Angular Service Worker + Dexie.js | PWA support, IndexedDB abstraction |
| Backend | NestJS + Prisma + PostgreSQL | Type-safe API, proven stack |

## Objectives & KPIs
- **Operational accuracy**: reduce scheduling and status errors by ≥95% through guided flows and validation.
- **Fulfillment speed**: cut daily assignment throughput time by ≥30% by automating batch actions (bulk status updates, exports, mass scheduling).
- **Data transparency**: deliver real-time status dashboards for HQ/branch views with <5 minute lag.
- **Adoption**: achieve 100% usage by logistics-branch users and partner coordinators within the first release month.

Key KPIs to monitor:
1. SLA compliance for appointment commitments (약속일자 준수율).
2. Installation completion lead time (수주~인수 평균 소요시간).
3. Error rework volume (미완료 → 완료 재처리 건수).
4. System uptime & offline sync success ratio.

## Target Users & Platforms
| Persona | Primary Platform | Primary Needs |
| --- | --- | --- |
| Branch Staff (지사 담당) | Desktop Chrome (PWA) | Fast filters, bulk updates, printable artifacts, alarm notifications, VPN-authenticated access. |
| Partner Coordinators (협력사/FDC) | Android App (Capacitor) | Mobile-first UX, offline capture with camera, push alerts for reassignment and issues. |
| HQ Supervisors | Desktop Chrome (PWA) | Aggregated dashboards, audit trails, export automation. |
| Field Installers | Android/iOS App | Quick status updates, serial/waste capture with camera, offline-first. |

### Platform Requirements
| Platform | Minimum Spec | Bundle Target |
| --- | --- | --- |
| Web PWA | Chrome 90+, Safari 14+ | < 150KB gzip initial |
| Android | API 26 (8.0), 2GB RAM | < 15MB APK |
| iOS | iOS 13+, iPhone 6s+ | < 20MB IPA |

**In-scope modules (per manual):**
1. Assignment & scheduling (slides 4-7).
2. Completion processing, serial & waste capture (slides 5, 15-18).
3. Order cancellation/amendment workflows (slide 6).
4. Volume lists, installer reports, confirmation printing (slides 7-15).
5. KPI dashboards & raw-data exports (slides 9-20).
6. Split order handling (slide 21).

No legacy ERP connection exists, so every data entity (orders, installers, KPIs) must be modeled and persisted within the new stack.

## Constraints & Assumptions
- 1-month schedule with a single full-stack developer; release must emphasize high-impact flows first.
- Corporate VPN gate is mandatory before login; assume SSO is not yet available, so local credentials + VPN IP safelists are required.
- Design system: Ionic default with custom CSS variables for branding.
- Hardware targets: Low-end Android devices (2GB RAM), modern iPhone, desktop Chrome.
- App Store: Android via internal APK/Play Store, iOS via TestFlight initially.

## Milestones (Indicative)
| Week | Focus |
| --- | --- |
| Week 1 | Finalize PRD/SDD/TDD, set up Ionic project, Capacitor config, seed data model, auth scaffold. |
| Week 2 | Build assignment, scheduling, cancellation flows with validation + i18n scaffold. |
| Week 3 | Implement completion processing (camera integration), waste capture, KPI dashboards, exports. |
| Week 4 | Harden offline sync, push notifications (FCM), finish QA (unit/E2E), native builds, deployment. |

## Success Criteria
- Feature coverage matches every slide in the manual through equivalent UX flows.
- PWA criteria validated (installability, service worker, offline fallback, push alerts).
- Native apps pass Android/iOS review guidelines.
- Performance: <3s Time to Interactive on low-end Android.
- PRD, SDD, and TDD baselines signed off, with traceability from requirements to tests.
- Documentation set (.doc folder) kept current for future scaling.
