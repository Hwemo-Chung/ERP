# Feature Development Templates (기능 개발 템플릿)

> Last Updated: 2025-12-12
> Project: Logistics ERP

---

## Overview

새로운 기능을 개발할 때 사용하는 **프롬프트 템플릿**입니다.
이 프로젝트의 패턴(Standalone Components, Signals, SignalStore)을 따릅니다.

---

## 1. New Standalone Component (Signals)

### 사용 상황
- 새로운 Angular 컴포넌트 생성
- 기존 컴포넌트를 Standalone으로 마이그레이션

### 템플릿
```
Angular 19 + Ionic 8 프로젝트입니다.

## 컴포넌트 정보
- 이름: [ComponentName]
- 위치: apps/mobile/src/app/features/[module]/[component-name]/
- 기능: [상세 설명]

## 요구사항
1. Standalone Component (imports에 필요한 모듈 직접 선언)
2. ChangeDetectionStrategy.OnPush
3. Signal 기반 상태 관리 (BehaviorSubject 금지)
4. Template Control Flow 사용 (@if, @for, @switch)
5. i18n 키 생성 (ko.json, en.json)

## 출력물
- [component-name].component.ts
- [component-name].component.html (별도 파일 또는 inline)
- [component-name].component.scss
- i18n 키 목록
- 라우팅 추가 코드 (필요시)

## Reference
- Component Example: apps/mobile/src/app/features/orders/pages/order-list/
- Store Integration: apps/mobile/src/app/store/orders/orders.store.ts
```

### 출력 예시
```typescript
// order-card.component.ts
@Component({
  selector: 'app-order-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonCard, IonCardHeader, IonCardContent,
    IonBadge, IonButton,
    TranslateModule,
  ],
  template: `
    <ion-card>
      <ion-card-header>
        <ion-badge [color]="statusColor()">
          {{ order().status | translate }}
        </ion-badge>
      </ion-card-header>
      <ion-card-content>
        @if (order().customerName) {
          <h2>{{ order().customerName }}</h2>
        }
        <p>{{ 'orders.card.appointment' | translate }}: {{ order().appointmentDate }}</p>
      </ion-card-content>
    </ion-card>
  `,
})
export class OrderCardComponent {
  // Input Signal
  order = input.required<Order>();

  // Computed
  statusColor = computed(() => {
    const status = this.order().status;
    return status === 'COMPLETED' ? 'success' : status === 'UNASSIGNED' ? 'danger' : 'primary';
  });
}
```

---

## 2. New NestJS Module (Controller + Service + DTO)

### 사용 상황
- 새로운 API 모듈 생성
- 기존 도메인 확장

### 템플릿
```
NestJS 11 + Prisma 6 프로젝트입니다.

## 모듈 정보
- 이름: [ModuleName]
- 위치: apps/api/src/[module-name]/
- 기능: [상세 설명]

## 엔드포인트 목록
1. GET /[module] - 목록 조회
2. GET /[module]/:id - 상세 조회
3. POST /[module] - 생성
4. PATCH /[module]/:id - 수정
5. DELETE /[module]/:id - 삭제

## 요구사항
1. Controller: HTTP 계층만 담당, Guard 적용
2. Service: 비즈니스 로직, 트랜잭션 처리
3. DTO: class-validator + Swagger 데코레이터
4. Optimistic Locking (version 필드)
5. Soft Delete 지원
6. 감사 로그 (AuditLog)

## 출력물
- [module].module.ts
- [module].controller.ts
- [module].service.ts
- dto/create-[module].dto.ts
- dto/update-[module].dto.ts
- dto/get-[modules].dto.ts

## Reference
- Module Example: apps/api/src/orders/orders.module.ts
- Service Example: apps/api/src/orders/orders.service.ts
- DTO Example: apps/api/src/orders/dto/
```

### 출력 예시
```typescript
// reports.module.ts
@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}

// reports.controller.ts
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @Roles(Role.HQ_ADMIN, Role.BRANCH_MANAGER)
  @ApiOperation({ summary: '보고서 목록 조회' })
  findAll(@Query() dto: GetReportsDto, @CurrentUser() user: JwtPayload) {
    return this.reportsService.findAll(dto, user);
  }
}

// reports.service.ts
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: GetReportsDto, user: JwtPayload) {
    return this.prisma.report.findMany({
      where: {
        deletedAt: null,
        ...(user.branchCode && { branchCode: user.branchCode }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

---

## 3. New SignalStore Feature

### 사용 상황
- 새로운 도메인의 클라이언트 상태 관리
- 기존 Store 확장

### 템플릿
```
Angular 19 + NgRx SignalStore 프로젝트입니다.

## Store 정보
- 이름: [Feature]Store
- 위치: apps/mobile/src/app/store/[feature]/
- 관리 데이터: [설명]

## State 구조
```typescript
interface [Feature]State {
  items: [Item][];
  selectedItem: [Item] | null;
  filters: [FilterOptions];
  pagination: PaginationState;
  isLoading: boolean;
  error: string | null;
}
```

## 요구사항
1. withState: 초기 상태 정의
2. withComputed: 필터링, KPI 계산
3. withMethods: API 호출, 상태 업데이트
4. IndexedDB 캐싱 (오프라인 지원)
5. Optimistic Update 패턴
6. effect: 네트워크 상태 변화 감지

## 출력물
- [feature].store.ts
- [feature].state.ts (인터페이스)

## Reference
- Store Example: apps/mobile/src/app/store/orders/orders.store.ts
- Database: apps/mobile/src/app/core/db/database.ts
```

### 출력 예시
```typescript
// installers.store.ts
@Injectable({ providedIn: 'root' })
export class InstallersStore extends signalStore(
  withState<InstallersState>(initialState),

  withComputed(({ installers, filters }) => ({
    filteredInstallers: computed(() => {
      let result = installers();
      const f = filters();
      if (f.branchCode) {
        result = result.filter(i => i.branchCode === f.branchCode);
      }
      if (f.isActive !== undefined) {
        result = result.filter(i => i.isActive === f.isActive);
      }
      return result;
    }),

    installerCount: computed(() => installers().length),
    activeCount: computed(() => installers().filter(i => i.isActive).length),
  })),

  withMethods((store, http = inject(HttpClient)) => ({
    async loadInstallers(branchCode?: string): Promise<void> {
      patchState(store, { isLoading: true, error: null });

      try {
        const response = await firstValueFrom(
          http.get<Installer[]>(`${API_URL}/installers`, {
            params: branchCode ? { branchCode } : {},
          })
        );

        // IndexedDB 캐시
        await db.installers.bulkPut(response);

        patchState(store, { installers: response, isLoading: false });
      } catch (error: any) {
        // 오프라인 폴백
        const cached = await db.installers.toArray();
        patchState(store, {
          installers: cached,
          isLoading: false,
          error: error.message,
        });
      }
    },

    selectInstaller(id: string): void {
      const installer = store.installers().find(i => i.id === id);
      patchState(store, { selectedInstaller: installer ?? null });
    },
  }))
) {}
```

---

## 4. New Offline-Enabled Feature

### 사용 상황
- 오프라인에서도 작동해야 하는 기능
- 동기화가 필요한 데이터 수정

### 템플릿
```
Angular 19 + Dexie.js 프로젝트입니다.

## 기능 정보
- 이름: [Feature Name]
- 오프라인 동작: [설명]
- 동기화 우선순위: [1-5, 1이 최고]

## 요구사항
1. IndexedDB에 데이터 저장
2. Optimistic Update (즉시 UI 반영)
3. SyncQueue에 작업 추가
4. 409 Conflict 처리
5. 네트워크 복귀 시 자동 동기화

## 데이터 흐름
1. 사용자 액션 → 로컬 상태 즉시 업데이트
2. IndexedDB에 저장
3. 온라인이면 즉시 서버 요청
4. 오프라인이면 SyncQueue에 추가
5. 온라인 복귀 → 큐 처리 → 서버 동기화

## 출력물
- Store 메서드 (optimistic update 포함)
- SyncQueue 연동 코드
- Conflict 처리 로직

## Reference
- SyncQueueService: apps/mobile/src/app/core/services/sync-queue.service.ts
- OrdersStore: apps/mobile/src/app/store/orders/orders.store.ts (assignOrder 메서드)
```

### 출력 예시
```typescript
// orders.store.ts (assignOrder 메서드)
async assignOrder(orderId: string, installerId: string): Promise<void> {
  const order = store.orders().find(o => o.id === orderId);
  if (!order) return;

  // 1. Optimistic Update
  const optimisticOrder = {
    ...order,
    installerId,
    status: OrderStatus.ASSIGNED,
    version: order.version + 1,
  };
  patchState(store, {
    orders: store.orders().map(o => o.id === orderId ? optimisticOrder : o),
  });

  // 2. IndexedDB 저장
  await db.orders.put({ ...optimisticOrder, localUpdatedAt: Date.now() });

  // 3. 네트워크 상태에 따른 처리
  const networkService = inject(NetworkService);
  if (networkService.isOffline()) {
    // 오프라인 → 큐에 추가
    await syncQueue.enqueue({
      method: 'PATCH',
      url: `/orders/${orderId}`,
      body: { installerId, status: OrderStatus.ASSIGNED, expectedVersion: order.version },
      priority: 3,  // ASSIGNMENT priority
    });
  } else {
    // 온라인 → 즉시 요청
    try {
      const result = await firstValueFrom(
        this.http.patch<Order>(`${API_URL}/orders/${orderId}`, {
          installerId,
          status: OrderStatus.ASSIGNED,
          expectedVersion: order.version,
        })
      );
      patchState(store, {
        orders: store.orders().map(o => o.id === orderId ? result : o),
      });
    } catch (error: any) {
      if (error.status === 409) {
        // Conflict → 롤백 + 최신 데이터 fetch
        patchState(store, {
          orders: store.orders().map(o => o.id === orderId ? order : o),
          error: 'Version conflict. Refreshing...',
        });
        await this.loadOrders();
      } else {
        // 다른 에러 → 큐에 추가
        await syncQueue.enqueue({ ... });
      }
    }
  }
}
```

---

## 5. New API Endpoint + Frontend Integration

### 사용 상황
- 백엔드 + 프론트엔드 풀스택 기능 개발

### 템플릿
```
Logistics ERP 풀스택 프로젝트입니다.

## 기능 정보
- 이름: [Feature Name]
- 설명: [상세 설명]

## API 설계
- Method: [GET/POST/PATCH/DELETE]
- Endpoint: /api/v1/[endpoint]
- Request Body: [구조]
- Response: [구조]

## 요구사항
### Backend (NestJS)
1. Controller 엔드포인트
2. Service 비즈니스 로직
3. DTO 검증
4. Guard 적용 (인증, 권한)
5. Swagger 문서화

### Frontend (Angular)
1. SignalStore 메서드
2. 컴포넌트 UI
3. 오프라인 지원 (필요시)
4. i18n 키

## 출력물
### Backend
- apps/api/src/[module]/[module].controller.ts (엔드포인트 추가)
- apps/api/src/[module]/[module].service.ts (메서드 추가)
- apps/api/src/[module]/dto/[action].dto.ts

### Frontend
- apps/mobile/src/app/store/[feature]/[feature].store.ts
- apps/mobile/src/app/features/[feature]/pages/[page]/
- apps/mobile/src/assets/i18n/ko.json, en.json

## Reference
- API Example: apps/api/src/orders/
- Store Example: apps/mobile/src/app/store/orders/
- Component Example: apps/mobile/src/app/features/orders/
```

---

## 6. Migration: BehaviorSubject to Signal

### 사용 상황
- 기존 BehaviorSubject 코드를 Signal로 마이그레이션

### 템플릿
```
Angular 19 마이그레이션 작업입니다.

## 마이그레이션 대상
- 파일: [파일 경로]
- 현재: BehaviorSubject + takeUntil 패턴
- 목표: Signal + computed 패턴

## 현재 코드
```typescript
[기존 코드 붙여넣기]
```

## 요구사항
1. BehaviorSubject → signal()
2. Observable 파이프 → computed()
3. subscribe() → effect() (부수효과인 경우)
4. takeUntil + destroy$ 제거 (자동 cleanup)
5. async 파이프 → Signal 직접 호출

## 출력물
- 마이그레이션된 코드
- 변경 설명

## Reference
- Signal Pattern: .prompt-guides/04-coding-patterns.md (Section 1)
- AuthService Example: apps/mobile/src/app/core/services/auth.service.ts
```

### 마이그레이션 체크리스트
```
□ BehaviorSubject → signal()
□ .asObservable() → .asReadonly()
□ .getValue() → signal()
□ .next() → .set() 또는 .update()
□ .pipe(map(...)) → computed()
□ .pipe(filter(...)) → computed() 내부 조건문
□ .subscribe() → effect() 또는 제거
□ takeUntil(destroy$) → 제거
□ ngOnDestroy cleanup → 제거
□ async 파이프 → {{ signal() }}
```

---

## Quick Reference

| 작업 | 템플릿 | 주요 키워드 |
|------|--------|------------|
| 새 컴포넌트 | Section 1 | standalone, OnPush, Signal |
| 새 API 모듈 | Section 2 | Controller, Service, DTO |
| 새 Store | Section 3 | withState, withComputed, withMethods |
| 오프라인 기능 | Section 4 | IndexedDB, SyncQueue, Optimistic |
| 풀스택 기능 | Section 5 | API + Store + Component |
| Signal 마이그레이션 | Section 6 | BehaviorSubject → Signal |
