#!/usr/bin/env npx tsx
/**
 * Logistics ERP - Progress Tracking CLI
 *
 * Usage: pnpm progress
 *
 * Generates PROGRESS.md with current implementation status
 * by analyzing the codebase structure.
 */

import * as fs from 'fs';
import * as path from 'path';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT_DIR, 'PROGRESS.md');

// FR (Functional Requirements) mapping
interface FRMapping {
  id: string;
  name: string;
  files: string[];
  apiEndpoint?: string;
  status?: 'complete' | 'partial' | 'missing';
}

const FR_MAPPINGS: FRMapping[] = [
  {
    id: 'FR-01',
    name: 'Filtered list view',
    files: ['apps/api/src/orders/orders.controller.ts', 'apps/api/src/orders/orders.service.ts'],
    apiEndpoint: 'GET /orders',
  },
  {
    id: 'FR-02',
    name: 'Batch appointment edit',
    files: ['apps/api/src/orders/orders.service.ts'],
    apiEndpoint: 'PATCH /orders/{id}',
  },
  {
    id: 'FR-03',
    name: 'Provisional assignment flow',
    files: ['apps/api/src/orders/order-state-machine.ts'],
    apiEndpoint: 'POST /orders/{id}/transition',
  },
  {
    id: 'FR-04',
    name: 'Serial number capture',
    files: ['apps/api/src/completion/completion.service.ts'],
    apiEndpoint: 'POST /orders/{id}/complete',
  },
  {
    id: 'FR-05',
    name: 'Waste pickup (P01-P21)',
    files: ['apps/api/src/completion/completion.service.ts'],
    apiEndpoint: 'POST /orders/{id}/complete',
  },
  {
    id: 'FR-06',
    name: 'ECOAS export',
    files: ['apps/api/src/reports/reports.service.ts'],
    apiEndpoint: 'GET /reports/raw?type=ecoas',
  },
  {
    id: 'FR-07',
    name: 'Customer history search',
    files: ['apps/api/src/orders/orders.service.ts'],
    apiEndpoint: 'GET /orders?customer=...',
  },
  {
    id: 'FR-08',
    name: 'KPI dashboards',
    files: ['apps/api/src/reports/reports.service.ts'],
    apiEndpoint: 'GET /reports/summary',
  },
  {
    id: 'FR-09',
    name: 'Push notifications',
    files: [
      'apps/api/src/notifications/notifications.service.ts',
      'apps/api/src/notifications/notifications.gateway.ts',
    ],
    apiEndpoint: 'WebSocket + Push',
  },
  {
    id: 'FR-10',
    name: 'Split order workflow',
    files: ['apps/api/src/orders/orders.service.ts'],
    apiEndpoint: 'POST /orders/{id}/split',
  },
  {
    id: 'FR-11',
    name: 'Center progress dashboard',
    files: ['apps/api/src/reports/reports.service.ts'],
    apiEndpoint: 'GET /reports/summary?level=branch',
  },
  {
    id: 'FR-12',
    name: 'Settlement period management',
    files: [
      'apps/api/src/settlement/settlement.module.ts',
      'apps/api/src/settlement/settlement.service.ts',
      'apps/api/src/settlement/settlement.controller.ts',
    ],
    apiEndpoint: 'POST /settlement/{id}/lock',
  },
  {
    id: 'FR-13',
    name: 'Postpone workflow',
    files: ['apps/api/src/orders/order-state-machine.ts'],
    apiEndpoint: 'POST /orders/{id}/transition',
  },
  {
    id: 'FR-14',
    name: 'Absence workflow',
    files: ['apps/api/src/orders/order-state-machine.ts'],
    apiEndpoint: 'POST /orders/{id}/transition',
  },
  {
    id: 'FR-15',
    name: 'Confirmation certificate tracking',
    files: ['apps/api/src/orders/orders.service.ts'],
    apiEndpoint: 'GET /orders?certificate=...',
  },
  {
    id: 'FR-16',
    name: 'FDC release summary',
    files: ['apps/api/src/reports/reports.service.ts'],
    apiEndpoint: 'GET /reports/raw?type=release',
  },
  {
    id: 'FR-17',
    name: 'Optimistic locking',
    files: ['apps/api/src/completion/completion.service.ts'],
    apiEndpoint: 'All PATCH requests',
  },
  {
    id: 'FR-18',
    name: 'Batch partial failure handling',
    files: ['apps/api/src/orders/orders.service.ts'],
    apiEndpoint: 'POST /orders/bulk-*',
  },
  {
    id: 'FR-19',
    name: 'Session timeout',
    files: ['apps/api/src/auth/auth.service.ts'],
    apiEndpoint: 'JWT expiry',
  },
  {
    id: 'FR-20',
    name: 'File attachments (S3)',
    files: ['apps/api/src/orders/orders.service.ts'],
    apiEndpoint: 'POST /orders/{id}/attachments',
  },
  {
    id: 'FR-21',
    name: 'Mobile hardware back',
    files: ['apps/mobile/src/app/app.component.ts'],
    apiEndpoint: '-',
  },
  {
    id: 'FR-22',
    name: 'Biometric quick login',
    files: ['apps/mobile/src/app/core/services/auth.service.ts'],
    apiEndpoint: '-',
  },
  {
    id: 'FR-23',
    name: 'Device notification preferences',
    files: ['apps/api/src/notifications/notifications.service.ts'],
    apiEndpoint: 'POST /notifications/subscribe',
  },
];

// API module definitions
interface ModuleCheck {
  name: string;
  controller: string;
  service: string;
  module: string;
  dto?: string;
  test?: string;
  appModuleImport: string;
}

const API_MODULES: ModuleCheck[] = [
  {
    name: 'auth',
    controller: 'apps/api/src/auth/auth.controller.ts',
    service: 'apps/api/src/auth/auth.service.ts',
    module: 'apps/api/src/auth/auth.module.ts',
    dto: 'apps/api/src/auth/dto',
    test: 'apps/api/src/auth/auth.service.spec.ts',
    appModuleImport: 'AuthModule',
  },
  {
    name: 'orders',
    controller: 'apps/api/src/orders/orders.controller.ts',
    service: 'apps/api/src/orders/orders.service.ts',
    module: 'apps/api/src/orders/orders.module.ts',
    dto: 'apps/api/src/orders/dto',
    test: 'apps/api/src/orders/orders.service.spec.ts',
    appModuleImport: 'OrdersModule',
  },
  {
    name: 'completion',
    controller: 'apps/api/src/completion/completion.controller.ts',
    service: 'apps/api/src/completion/completion.service.ts',
    module: 'apps/api/src/completion/completion.module.ts',
    dto: 'apps/api/src/completion/dto',
    test: 'apps/api/src/completion/completion.service.spec.ts',
    appModuleImport: 'CompletionModule',
  },
  {
    name: 'notifications',
    controller: 'apps/api/src/notifications/notifications.controller.ts',
    service: 'apps/api/src/notifications/notifications.service.ts',
    module: 'apps/api/src/notifications/notifications.module.ts',
    dto: 'apps/api/src/notifications/dto',
    test: 'apps/api/src/notifications/notifications.service.spec.ts',
    appModuleImport: 'NotificationsModule',
  },
  {
    name: 'users',
    controller: 'apps/api/src/users/users.controller.ts',
    service: 'apps/api/src/users/users.service.ts',
    module: 'apps/api/src/users/users.module.ts',
    dto: 'apps/api/src/users/dto',
    test: 'apps/api/src/users/users.service.spec.ts',
    appModuleImport: 'UsersModule',
  },
  {
    name: 'reports',
    controller: 'apps/api/src/reports/reports.controller.ts',
    service: 'apps/api/src/reports/reports.service.ts',
    module: 'apps/api/src/reports/reports.module.ts',
    dto: 'apps/api/src/reports/dto',
    test: 'apps/api/src/reports/reports.service.spec.ts',
    appModuleImport: 'ReportsModule',
  },
  {
    name: 'metadata',
    controller: 'apps/api/src/metadata/metadata.controller.ts',
    service: 'apps/api/src/metadata/metadata.service.ts',
    module: 'apps/api/src/metadata/metadata.module.ts',
    dto: 'apps/api/src/metadata/dto',
    test: 'apps/api/src/metadata/metadata.service.spec.ts',
    appModuleImport: 'MetadataModule',
  },
  {
    name: 'settlement',
    controller: 'apps/api/src/settlement/settlement.controller.ts',
    service: 'apps/api/src/settlement/settlement.service.ts',
    module: 'apps/api/src/settlement/settlement.module.ts',
    dto: 'apps/api/src/settlement/dto',
    test: 'apps/api/src/settlement/settlement.service.spec.ts',
    appModuleImport: 'SettlementModule',
  },
];

// Mobile feature checks
interface MobileCheck {
  name: string;
  path: string;
}

const MOBILE_CHECKS: MobileCheck[] = [
  { name: 'AuthService', path: 'apps/mobile/src/app/core/services/auth.service.ts' },
  { name: 'SyncQueueService', path: 'apps/mobile/src/app/core/services/sync-queue.service.ts' },
  { name: 'BackgroundSyncService', path: 'apps/mobile/src/app/core/services/background-sync.service.ts' },
  { name: 'WebSocketService', path: 'apps/mobile/src/app/core/services/websocket.service.ts' },
  { name: 'NetworkService', path: 'apps/mobile/src/app/core/services/network.service.ts' },
  { name: 'Database (Dexie)', path: 'apps/mobile/src/app/core/db/database.ts' },
  { name: 'AuthGuard', path: 'apps/mobile/src/app/core/guards/auth.guard.ts' },
  { name: 'AuthInterceptor', path: 'apps/mobile/src/app/core/interceptors/auth.interceptor.ts' },
  { name: 'OfflineInterceptor', path: 'apps/mobile/src/app/core/interceptors/offline.interceptor.ts' },
  { name: 'OrdersStore', path: 'apps/mobile/src/app/store/orders/orders.store.ts' },
  { name: 'InstallersStore', path: 'apps/mobile/src/app/store/installers/installers.store.ts' },
  { name: 'UIStore', path: 'apps/mobile/src/app/store/ui/ui.store.ts' },
  { name: 'LoginPage', path: 'apps/mobile/src/app/features/auth/pages/login/login.page.ts' },
  { name: 'OrderListPage', path: 'apps/mobile/src/app/features/orders/pages/order-list/order-list.page.ts' },
  { name: 'OrderDetailPage', path: 'apps/mobile/src/app/features/orders/pages/order-detail/order-detail.page.ts' },
  { name: 'DashboardPage', path: 'apps/mobile/src/app/features/dashboard/dashboard.page.ts' },
  { name: 'ProfilePage', path: 'apps/mobile/src/app/features/profile/profile.page.ts' },
];

// Documentation checks
const DOC_FILES = [
  'PROJECT_OVERVIEW.md',
  'PRD.md',
  'ARCHITECTURE.md',
  'API_SPEC.md',
  'DATABASE_SCHEMA.md',
  'DEVELOPMENT_GUIDE.md',
  'SDD.md',
  'DEPLOYMENT.md',
];

// Utility functions
function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(ROOT_DIR, relativePath));
}

function dirExists(relativePath: string): boolean {
  const fullPath = path.join(ROOT_DIR, relativePath);
  return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
}

function checkAppModuleImport(moduleName: string): boolean {
  const appModulePath = path.join(ROOT_DIR, 'apps/api/src/app.module.ts');
  if (!fs.existsSync(appModulePath)) return false;

  const content = fs.readFileSync(appModulePath, 'utf-8');
  return content.includes(moduleName);
}

function progressBar(percent: number, width = 20): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function getStatusIcon(status: 'complete' | 'partial' | 'missing' | boolean): string {
  if (status === true || status === 'complete') return '✅';
  if (status === 'partial') return '⚠️';
  return '❌';
}

// Analysis functions
function analyzeFRStatus(): { complete: number; partial: number; missing: number; mappings: FRMapping[] } {
  let complete = 0;
  let partial = 0;
  let missing = 0;

  const updatedMappings = FR_MAPPINGS.map((fr) => {
    const existingFiles = fr.files.filter((f) => fileExists(f));
    const ratio = existingFiles.length / fr.files.length;

    let status: 'complete' | 'partial' | 'missing';
    if (ratio === 1) {
      status = 'complete';
      complete++;
    } else if (ratio > 0) {
      status = 'partial';
      partial++;
    } else {
      status = 'missing';
      missing++;
    }

    return { ...fr, status };
  });

  return { complete, partial, missing, mappings: updatedMappings };
}

function analyzeModules(): {
  modules: Array<ModuleCheck & { exists: Record<string, boolean>; appImported: boolean }>;
  complete: number;
  partial: number;
} {
  let complete = 0;
  let partial = 0;

  const analyzed = API_MODULES.map((mod) => {
    const exists = {
      controller: fileExists(mod.controller),
      service: fileExists(mod.service),
      module: fileExists(mod.module),
      dto: mod.dto ? dirExists(mod.dto) : false,
      test: mod.test ? fileExists(mod.test) : false,
    };

    const appImported = checkAppModuleImport(mod.appModuleImport);
    const coreComplete = exists.controller && exists.service && exists.module;

    if (coreComplete && appImported) {
      complete++;
    } else if (exists.controller || exists.service || exists.module) {
      partial++;
    }

    return { ...mod, exists, appImported };
  });

  return { modules: analyzed, complete, partial };
}

function analyzeMobile(): { items: Array<MobileCheck & { exists: boolean }>; complete: number } {
  let complete = 0;

  const analyzed = MOBILE_CHECKS.map((item) => {
    const exists = fileExists(item.path);
    if (exists) complete++;
    return { ...item, exists };
  });

  return { items: analyzed, complete };
}

function analyzeDocs(): { items: Array<{ name: string; exists: boolean }>; complete: number } {
  let complete = 0;

  const analyzed = DOC_FILES.map((name) => {
    const exists = fileExists(`.doc/${name}`);
    if (exists) complete++;
    return { name, exists };
  });

  return { items: analyzed, complete };
}

// Test file definitions for each app
interface TestCheck {
  app: string;
  path: string;
}

const TEST_FILES: TestCheck[] = [
  // API tests
  { app: 'api', path: 'apps/api/src/auth/auth.service.spec.ts' },
  { app: 'api', path: 'apps/api/src/orders/orders.service.spec.ts' },
  { app: 'api', path: 'apps/api/src/orders/order-state-machine.spec.ts' },
  { app: 'api', path: 'apps/api/src/completion/completion.service.spec.ts' },
  { app: 'api', path: 'apps/api/src/settlement/settlement.service.spec.ts' },
  // Web tests
  { app: 'web', path: 'apps/web/src/app/app.component.spec.ts' },
  { app: 'web', path: 'apps/web/src/app/store/orders/orders.store.spec.ts' },
  { app: 'web', path: 'apps/web/src/app/core/services/auth.service.spec.ts' },
  { app: 'web', path: 'apps/web/src/app/core/services/background-sync.service.spec.ts' },
  { app: 'web', path: 'apps/web/src/app/core/services/sync-queue.service.spec.ts' },
  { app: 'web', path: 'apps/web/src/app/core/services/biometric.service.spec.ts' },
  { app: 'web', path: 'apps/web/src/app/core/db/database.spec.ts' },
  { app: 'web', path: 'apps/web/src/app/shared/services/bulk-operation.service.spec.ts' },
  { app: 'web', path: 'apps/web/src/app/shared/services/conflict-resolver.service.spec.ts' },
  { app: 'web', path: 'apps/web/src/app/shared/services/session-manager.service.spec.ts' },
  // Mobile tests
  { app: 'mobile', path: 'apps/mobile/src/app/store/orders/orders.store.spec.ts' },
  { app: 'mobile', path: 'apps/mobile/src/app/core/services/auth.service.spec.ts' },
  { app: 'mobile', path: 'apps/mobile/src/app/core/services/background-sync.service.spec.ts' },
  { app: 'mobile', path: 'apps/mobile/src/app/core/services/sync-queue.service.spec.ts' },
  { app: 'mobile', path: 'apps/mobile/src/app/core/db/database.spec.ts' },
];

function analyzeTests(): {
  items: Array<TestCheck & { exists: boolean }>;
  complete: number;
  byApp: Record<string, { total: number; complete: number }>;
} {
  let complete = 0;
  const byApp: Record<string, { total: number; complete: number }> = {
    api: { total: 0, complete: 0 },
    web: { total: 0, complete: 0 },
    mobile: { total: 0, complete: 0 },
  };

  const analyzed = TEST_FILES.map((item) => {
    const exists = fileExists(item.path);
    byApp[item.app].total++;
    if (exists) {
      complete++;
      byApp[item.app].complete++;
    }
    return { ...item, exists };
  });

  return { items: analyzed, complete, byApp };
}

// Main generation
function generateProgressMd(): string {
  const now = new Date().toISOString().split('T')[0];

  const frAnalysis = analyzeFRStatus();
  const moduleAnalysis = analyzeModules();
  const mobileAnalysis = analyzeMobile();
  const docAnalysis = analyzeDocs();
  const testAnalysis = analyzeTests();

  // Calculate overall progress
  const docProgress = Math.round((docAnalysis.complete / DOC_FILES.length) * 100);
  const apiProgress = Math.round((moduleAnalysis.complete / API_MODULES.length) * 100);
  const mobileProgress = Math.round((mobileAnalysis.complete / MOBILE_CHECKS.length) * 100);
  const frProgress = Math.round((frAnalysis.complete / FR_MAPPINGS.length) * 100);
  const testProgress = Math.round((testAnalysis.complete / TEST_FILES.length) * 100);

  const overallProgress = Math.round((docProgress + apiProgress + mobileProgress + frProgress + testProgress) / 5);

  // Generate markdown
  let md = `# Logistics ERP 프로젝트 진행 상황

> 📅 **마지막 업데이트**: ${now}
> 🔄 **자동 생성**: \`pnpm progress\` 명령으로 재생성 가능

---

## 📊 전체 진행률

\`\`\`
전체 진행률: ${progressBar(overallProgress)} ${overallProgress}%

문서 완성도:  ${progressBar(docProgress)} ${docProgress}% (${docAnalysis.complete}/${DOC_FILES.length})
API 백엔드:   ${progressBar(apiProgress)} ${apiProgress}%  (${moduleAnalysis.complete}/${API_MODULES.length} 모듈 완전)
Mobile 앱:    ${progressBar(mobileProgress)} ${mobileProgress}%  (${mobileAnalysis.complete}/${MOBILE_CHECKS.length} 항목)
FR 구현:      ${progressBar(frProgress)} ${frProgress}%  (${frAnalysis.complete}/${FR_MAPPINGS.length} 완전)
테스트:       ${progressBar(testProgress)} ${testProgress}%  (${testAnalysis.complete}/${TEST_FILES.length} 테스트 파일)
\`\`\`

---

## 🚨 긴급 이슈 (차단 요소)

`;

  // Find critical issues
  const criticalIssues: string[] = [];

  // Check settlement module
  const settlementMod = moduleAnalysis.modules.find((m) => m.name === 'settlement');
  if (settlementMod && !settlementMod.exists.module) {
    criticalIssues.push(
      '| 🔴 P0 | **Settlement 모듈 미완성** | E2002 에러(정산 잠금) 처리 불가 | `settlement.module.ts`, `settlement.service.ts`, `settlement.controller.ts` 생성 필요 |'
    );
  }

  // Check CompletionModule import
  const completionMod = moduleAnalysis.modules.find((m) => m.name === 'completion');
  if (completionMod && completionMod.exists.module && !completionMod.appImported) {
    criticalIssues.push(
      '| 🔴 P0 | **CompletionModule AppModule 미import** | 완료 처리 API 호출 불가 | `app.module.ts`에 `CompletionModule` import 추가 |'
    );
  }

  // Check test coverage
  const hasAnyTests = moduleAnalysis.modules.some((m) => m.exists.test);
  if (!hasAnyTests) {
    criticalIssues.push(
      '| 🟡 P1 | **테스트 커버리지 0%** | 회귀 테스트 불가, 리팩토링 위험 | 최소한 상태 머신, 핵심 서비스 단위 테스트 작성 |'
    );
  }

  if (criticalIssues.length > 0) {
    md += `| 우선순위 | 이슈 | 영향 | 해결 방안 |
|:---:|------|------|----------|
${criticalIssues.join('\n')}

`;
  } else {
    md += `✅ 현재 차단 이슈 없음

`;
  }

  md += `---

## 📋 기능 요구사항 (PRD) 체크리스트

| ID | 요구사항 | 상태 | 파일 존재 | API |
|:---:|---------|:---:|:---:|-----|
`;

  for (const fr of frAnalysis.mappings) {
    const existCount = fr.files.filter((f) => fileExists(f)).length;
    md += `| ${fr.id} | ${fr.name} | ${getStatusIcon(fr.status!)} | ${existCount}/${fr.files.length} | ${fr.apiEndpoint || '-'} |\n`;
  }

  md += `
### FR 구현 요약

\`\`\`
✅ 완전 구현: ${frAnalysis.complete}개 (${Math.round((frAnalysis.complete / FR_MAPPINGS.length) * 100)}%)
⚠️ 부분 구현: ${frAnalysis.partial}개 (${Math.round((frAnalysis.partial / FR_MAPPINGS.length) * 100)}%)
❌ 미구현:    ${frAnalysis.missing}개 (${Math.round((frAnalysis.missing / FR_MAPPINGS.length) * 100)}%)
━━━━━━━━━━━━━━━━━━━━
총 ${FR_MAPPINGS.length}개 기능 요구사항
\`\`\`

---

## 🏗️ 모듈별 구현 상태

### Backend (apps/api/src/)

| 모듈 | Controller | Service | Module | DTO | Tests | AppModule | 상태 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
`;

  for (const mod of moduleAnalysis.modules) {
    const coreComplete = mod.exists.controller && mod.exists.service && mod.exists.module;
    let statusEmoji = '🟢';
    if (!coreComplete) {
      statusEmoji = '🔴';
    } else if (!mod.appImported) {
      statusEmoji = '🔴';
    } else if (!mod.exists.dto) {
      statusEmoji = '🟡';
    }

    md += `| **${mod.name}** | ${getStatusIcon(mod.exists.controller)} | ${getStatusIcon(mod.exists.service)} | ${getStatusIcon(mod.exists.module)} | ${getStatusIcon(mod.exists.dto)} | ${getStatusIcon(mod.exists.test)} | ${getStatusIcon(mod.appImported)} | ${statusEmoji} |\n`;
  }

  md += `
### Frontend Mobile (apps/mobile/src/app/)

| 항목 | 상태 |
|------|:---:|
`;

  for (const item of mobileAnalysis.items) {
    md += `| ${item.name} | ${getStatusIcon(item.exists)} |\n`;
  }

  md += `
---

## 📄 문서 현황 (.doc/)

| 문서 | 상태 |
|------|:---:|
`;

  for (const doc of docAnalysis.items) {
    md += `| ${doc.name} | ${getStatusIcon(doc.exists)} |\n`;
  }

  md += `
---

## 📈 진행률 변경 이력

| 날짜 | 변경 내용 | 진행률 |
|------|----------|:---:|
| ${now} | CLI 스크립트로 자동 생성 | ${overallProgress}% |

---

> 💡 **Tip**: \`pnpm progress\` 명령으로 이 문서를 자동 재생성할 수 있습니다.
`;

  return md;
}

// Terminal output
function printSummary(): void {
  const frAnalysis = analyzeFRStatus();
  const moduleAnalysis = analyzeModules();
  const mobileAnalysis = analyzeMobile();
  const docAnalysis = analyzeDocs();
  const testAnalysis = analyzeTests();

  console.log('\n' + colors.bold + colors.cyan + '═══════════════════════════════════════════════════════' + colors.reset);
  console.log(colors.bold + '           Logistics ERP - Progress Report' + colors.reset);
  console.log(colors.cyan + '═══════════════════════════════════════════════════════' + colors.reset + '\n');

  // Documentation
  const docPercent = Math.round((docAnalysis.complete / DOC_FILES.length) * 100);
  console.log(
    `${colors.blue}📄 Documentation:${colors.reset} ${colors.green}${docAnalysis.complete}/${DOC_FILES.length}${colors.reset} (${docPercent}%)`
  );

  // API Modules
  const apiPercent = Math.round((moduleAnalysis.complete / API_MODULES.length) * 100);
  console.log(
    `${colors.blue}🔧 API Modules:${colors.reset}   ${colors.green}${moduleAnalysis.complete}/${API_MODULES.length}${colors.reset} (${apiPercent}%)`
  );

  // Mobile
  const mobilePercent = Math.round((mobileAnalysis.complete / MOBILE_CHECKS.length) * 100);
  console.log(
    `${colors.blue}📱 Mobile:${colors.reset}        ${colors.green}${mobileAnalysis.complete}/${MOBILE_CHECKS.length}${colors.reset} (${mobilePercent}%)`
  );

  // FR
  const frPercent = Math.round((frAnalysis.complete / FR_MAPPINGS.length) * 100);
  console.log(
    `${colors.blue}📋 FR Complete:${colors.reset}   ${colors.green}${frAnalysis.complete}/${FR_MAPPINGS.length}${colors.reset} (${frPercent}%)`
  );

  // Tests
  const testPercent = Math.round((testAnalysis.complete / TEST_FILES.length) * 100);
  console.log(
    `${colors.blue}🧪 Tests:${colors.reset}         ${colors.green}${testAnalysis.complete}/${TEST_FILES.length}${colors.reset} (${testPercent}%)`
  );
  console.log(
    `   ${colors.cyan}API: ${testAnalysis.byApp.api.complete}/${testAnalysis.byApp.api.total}, Web: ${testAnalysis.byApp.web.complete}/${testAnalysis.byApp.web.total}, Mobile: ${testAnalysis.byApp.mobile.complete}/${testAnalysis.byApp.mobile.total}${colors.reset}`
  );

  // Critical issues
  console.log('\n' + colors.bold + colors.red + '🚨 Critical Issues:' + colors.reset);

  let hasIssues = false;

  const settlementMod = moduleAnalysis.modules.find((m) => m.name === 'settlement');
  if (settlementMod && !settlementMod.exists.module) {
    console.log(colors.red + '   • Settlement module incomplete' + colors.reset);
    hasIssues = true;
  }

  const completionMod = moduleAnalysis.modules.find((m) => m.name === 'completion');
  if (completionMod && completionMod.exists.module && !completionMod.appImported) {
    console.log(colors.red + '   • CompletionModule not imported in AppModule' + colors.reset);
    hasIssues = true;
  }

  if (testAnalysis.complete === 0) {
    console.log(colors.yellow + '   • No test files found' + colors.reset);
    hasIssues = true;
  } else if (testPercent < 50) {
    console.log(colors.yellow + `   • Test coverage low (${testPercent}%)` + colors.reset);
    hasIssues = true;
  }

  if (!hasIssues) {
    console.log(colors.green + '   ✅ No critical issues found' + colors.reset);
  }

  console.log('\n' + colors.cyan + '═══════════════════════════════════════════════════════' + colors.reset);
  console.log(colors.green + `✅ PROGRESS.md generated at: ${OUTPUT_FILE}` + colors.reset);
  console.log(colors.cyan + '═══════════════════════════════════════════════════════' + colors.reset + '\n');
}

// Main execution
function main(): void {
  console.log(colors.cyan + '\n🔍 Analyzing project structure...' + colors.reset);

  const markdown = generateProgressMd();
  fs.writeFileSync(OUTPUT_FILE, markdown, 'utf-8');

  printSummary();
}

main();
