# Required Coding Patterns (필수 코딩 패턴)

> Last Updated: 2025-12-12
> Project: Logistics ERP (Angular 19 + NestJS 11)

---

## Overview

이 프로젝트에서 **반드시 사용해야 할 코딩 패턴**을 정리합니다.
기존 RxJS BehaviorSubject 패턴 대신 **Signals + SignalStore** 패턴을 사용합니다.

---

## 1. Signal State Management

### 기본 개념
Angular 19에서 BehaviorSubject를 대체하는 반응형 상태 관리입니다.

### 패턴 비교
```typescript
// ❌ OLD: BehaviorSubject (사용 금지)
private dataSubject = new BehaviorSubject<Data | null>(null);
public data$ = this.dataSubject.asObservable();
private destroy$ = new Subject<void>();

ngOnInit() {
  this.service.data$
    .pipe(takeUntil(this.destroy$))
    .subscribe(data => { this.data = data; });
}

ngOnDestroy() {
  this.destroy$.next();
  this.destroy$.complete();
}

// ✅ NEW: Signal (권장)
private readonly _data = signal<Data | null>(null);
readonly data = this._data.asReadonly();
readonly isLoaded = computed(() => this._data() !== null);
// → 자동 cleanup, 수동 구독 불필요!
```

### signal, computed, effect 사용법
```typescript
import { signal, computed, effect, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // 1. signal: 기본 반응형 상태
  private readonly _user = signal<User | null>(null);
  private readonly _isLoading = signal(false);

  // 2. computed: 파생 상태 (자동 추적)
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly roles = computed(() => this._user()?.roles ?? []);
  readonly canManageOrders = computed(() =>
    this.roles().includes('BRANCH_MANAGER') || this.roles().includes('HQ_ADMIN')
  );

  // 3. 상태 업데이트 메서드
  setUser(user: User): void {
    this._user.set(user);  // 완전 교체
  }

  updateUserName(name: string): void {
    this._user.update(current => current ? { ...current, name } : null);  // 부분 업데이트
  }

  logout(): void {
    this._user.set(null);
  }
}
```

### effect 사용 (부수효과)
```typescript
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly networkService = inject(NetworkService);

  constructor() {
    // 네트워크 상태 변화 감시
    effect(() => {
      const isOffline = this.networkService.isOffline();
      if (!isOffline) {
        this.syncPendingOperations();  // 온라인 복귀 시 동기화
      }
    }, { allowSignalWrites: true });  // Signal 수정 허용
  }
}
```

### Reference
- `apps/mobile/src/app/core/services/auth.service.ts`
- `apps/mobile/src/app/core/services/network.service.ts`

---

## 2. NgRx SignalStore Pattern

### 구조
```typescript
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';

// 1. State 인터페이스 정의
interface OrdersState {
  orders: Order[];
  selectedOrder: Order | null;
  filters: OrderFilterOptions;
  pagination: PaginationState;
  isLoading: boolean;
  error: string | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncTime: number | null;
}

const initialState: OrdersState = {
  orders: [],
  selectedOrder: null,
  filters: {},
  pagination: { page: 1, limit: 20, total: 0, hasMore: false },
  isLoading: false,
  error: null,
  syncStatus: 'idle',
  lastSyncTime: null,
};

// 2. Store 정의
@Injectable({ providedIn: 'root' })
export class OrdersStore extends signalStore(
  // Step 1: 상태 정의
  withState<OrdersState>(initialState),

  // Step 2: 계산된 값 (Computed)
  withComputed(({ orders, filters }) => ({
    filteredOrders: computed(() => {
      let result = orders();
      const f = filters();

      if (f.status?.length) {
        result = result.filter(o => f.status!.includes(o.status));
      }
      if (f.branchCode) {
        result = result.filter(o => o.branchCode === f.branchCode);
      }
      return result;
    }),

    kpiMetrics: computed(() => {
      const all = orders();
      return {
        total: all.length,
        pending: all.filter(o => o.status === 'UNASSIGNED').length,
        assigned: all.filter(o => o.status === 'ASSIGNED').length,
        completed: all.filter(o => o.status === 'COMPLETED').length,
      };
    }),

    ordersByStatus: computed(() => {
      const groups = new Map<string, Order[]>();
      orders().forEach(o => {
        if (!groups.has(o.status)) groups.set(o.status, []);
        groups.get(o.status)!.push(o);
      });
      return groups;
    }),
  })),

  // Step 3: 메서드 정의
  withMethods((store, http = inject(HttpClient), db = inject(DatabaseService)) => ({
    async loadOrders(branchCode?: string): Promise<void> {
      patchState(store, { isLoading: true, error: null });

      try {
        const response = await firstValueFrom(
          http.get<{ data: Order[]; pagination: any }>(`${API_URL}/orders`, {
            params: branchCode ? { branchCode } : {},
          })
        );

        // IndexedDB에 캐시
        await db.orders.bulkPut(response.data);

        patchState(store, {
          orders: response.data,
          pagination: response.pagination,
          isLoading: false,
          lastSyncTime: Date.now(),
        });
      } catch (error: any) {
        // 오프라인 → IndexedDB 폴백
        const cached = await db.orders.toArray();
        patchState(store, {
          orders: cached,
          isLoading: false,
          error: error.message,
        });
      }
    },

    selectOrder(orderId: string): void {
      const order = store.orders().find(o => o.id === orderId);
      patchState(store, { selectedOrder: order ?? null });
    },

    setFilters(filters: OrderFilterOptions): void {
      patchState(store, { filters });
    },

    clearError(): void {
      patchState(store, { error: null });
    },
  }))
) {}
```

### Component에서 사용
```typescript
@Component({
  selector: 'app-order-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.isLoading()) {
      <ion-spinner></ion-spinner>
    } @else {
      @for (order of store.filteredOrders(); track order.id) {
        <app-order-item [order]="order" (click)="onSelect(order.id)" />
      } @empty {
        <div class="no-data">{{ 'orders.empty' | translate }}</div>
      }
    }

    <div class="kpi-summary">
      Total: {{ store.kpiMetrics().total }}
      Pending: {{ store.kpiMetrics().pending }}
    </div>
  `,
})
export class OrderListPage {
  protected readonly store = inject(OrdersStore);

  ngOnInit(): void {
    this.store.loadOrders();
  }

  onSelect(orderId: string): void {
    this.store.selectOrder(orderId);
  }
}
```

### Reference
- `apps/mobile/src/app/store/orders/orders.store.ts`
- `apps/mobile/src/app/store/auth/auth.store.ts`

---

## 3. Offline Queue Pattern (Dexie.js)

### Database Schema
```typescript
// apps/mobile/src/app/core/db/database.ts
import Dexie, { Table } from 'dexie';

export interface OfflineOrder {
  id: string;
  erpOrderNumber: string;
  status: string;
  version: number;
  localUpdatedAt: number;
  syncedAt?: number;
}

export interface SyncQueueEntry {
  id?: number;
  method: 'POST' | 'PATCH' | 'DELETE';
  url: string;
  body: unknown;
  timestamp: number;
  retryCount: number;
  priority: number;  // 1=highest
  status: 'pending' | 'in_progress' | 'conflict' | 'failed';
}

class ERPDatabase extends Dexie {
  orders!: Table<OfflineOrder, string>;
  syncQueue!: Table<SyncQueueEntry, number>;

  constructor() {
    super('ERPLogistics');

    this.version(1).stores({
      orders: 'id, status, branchCode, appointmentDate, localUpdatedAt',
      syncQueue: '++id, timestamp, status, priority',
    });
  }
}

export const db = new ERPDatabase();
```

### Sync Queue Service
```typescript
@Injectable({ providedIn: 'root' })
export class SyncQueueService {
  private readonly http = inject(HttpClient);

  // 작업 추가
  async enqueue(operation: Omit<SyncQueueEntry, 'id' | 'timestamp'>): Promise<void> {
    await db.syncQueue.add({
      ...operation,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    });
  }

  // 대기 중인 작업 처리
  async processQueue(): Promise<void> {
    const operations = await db.syncQueue
      .where('status')
      .equals('pending')
      .sortBy('priority');  // 우선순위 순

    for (const op of operations) {
      await this.processOperation(op);
    }
  }

  private async processOperation(op: SyncQueueEntry): Promise<void> {
    try {
      await db.syncQueue.update(op.id!, { status: 'in_progress' });

      const url = `${environment.apiUrl}${op.url}`;
      switch (op.method) {
        case 'POST':
          await firstValueFrom(this.http.post(url, op.body));
          break;
        case 'PATCH':
          await firstValueFrom(this.http.patch(url, op.body));
          break;
        case 'DELETE':
          await firstValueFrom(this.http.delete(url));
          break;
      }

      // 성공 → 삭제
      await db.syncQueue.delete(op.id!);
    } catch (error: any) {
      await this.handleError(op, error);
    }
  }

  private async handleError(op: SyncQueueEntry, error: any): Promise<void> {
    if (error.status === 409) {
      // Version conflict → 사용자 해결 필요
      await db.syncQueue.update(op.id!, {
        status: 'conflict',
        conflictData: error.error,
      });
    } else if (op.retryCount < 5) {
      // 재시도 (지수 백오프)
      await db.syncQueue.update(op.id!, {
        status: 'pending',
        retryCount: op.retryCount + 1,
      });
    } else {
      await db.syncQueue.update(op.id!, { status: 'failed' });
    }
  }
}
```

### 우선순위 체계
```typescript
const PRIORITY = {
  COMPLETION: 1,      // 완료 (KPI 영향 큼)
  STATUS_CHANGE: 2,   // 상태 변경
  ASSIGNMENT: 3,      // 배정
  ATTACHMENT: 4,      // 첨부파일
  NOTE: 5,           // 메모
};
```

### Reference
- `apps/mobile/src/app/core/db/database.ts`
- `apps/mobile/src/app/core/services/sync-queue.service.ts`

---

## 4. NestJS DTO + Validation

### DTO 패턴
```typescript
// apps/api/src/orders/dto/update-order.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsInt, IsBoolean } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderDto {
  @ApiPropertyOptional({ enum: OrderStatus, description: '주문 상태' })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ description: '설치 기사 ID' })
  @IsOptional()
  @IsString()
  installerId?: string;

  @ApiPropertyOptional({ description: '약속 일자 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  appointmentDate?: string;

  @ApiPropertyOptional({ description: '낙관적 잠금 버전' })
  @IsOptional()
  @IsInt()
  expectedVersion?: number;

  @ApiPropertyOptional({ description: '시리얼 캡처 완료 여부' })
  @IsOptional()
  @IsBoolean()
  serialsCaptured?: boolean;
}
```

### Controller + Service 패턴
```typescript
// Controller: HTTP 계층만 담당
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: '주문 목록 조회' })
  findAll(@Query() dto: GetOrdersDto, @CurrentUser() user: JwtPayload) {
    const branchCode = user.roles.includes(Role.HQ_ADMIN)
      ? undefined
      : user.branchCode;
    return this.ordersService.findAll(dto, branchCode);
  }

  @Patch(':id')
  @ApiOperation({ summary: '주문 수정' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ordersService.update(id, dto, user.sub);
  }
}

// Service: 비즈니스 로직 + 트랜잭션
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stateMachine: OrderStateMachine,
  ) {}

  async update(id: string, dto: UpdateOrderDto, userId: string) {
    return this.prisma.executeTransaction(async (tx) => {
      const existing = await tx.order.findFirst({
        where: { id, deletedAt: null },
      });

      if (!existing) {
        throw new NotFoundException({ error: 'E3004', message: 'error.order_not_found' });
      }

      // State machine 검증
      if (dto.status) {
        const validation = this.stateMachine.validateTransition(
          existing.status,
          dto.status,
          { serialsCaptured: dto.serialsCaptured, appointmentDate: existing.appointmentDate },
        );

        if (!validation.valid) {
          throw new BadRequestException({
            error: validation.errorCode,
            message: validation.error,
          });
        }
      }

      // Optimistic locking
      if (dto.expectedVersion && existing.version !== dto.expectedVersion) {
        throw new ConflictException({
          error: 'E2017',
          currentVersion: existing.version,
          serverState: existing,
        });
      }

      return tx.order.update({
        where: { id },
        data: {
          ...dto,
          version: { increment: 1 },
          updatedBy: userId,
        },
      });
    });
  }
}
```

### Reference
- `apps/api/src/orders/orders.controller.ts`
- `apps/api/src/orders/orders.service.ts`
- `apps/api/src/orders/dto/`

---

## 5. State Machine Transition Guards

### 구조
```typescript
// apps/api/src/orders/order-state-machine.ts
@Injectable()
export class OrderStateMachine {
  // 허용된 전환 맵
  private readonly transitions = new Map<OrderStatus, OrderStatus[]>([
    [OrderStatus.UNASSIGNED, [OrderStatus.ASSIGNED]],
    [OrderStatus.ASSIGNED, [OrderStatus.CONFIRMED, OrderStatus.UNASSIGNED]],
    [OrderStatus.CONFIRMED, [OrderStatus.RELEASED, OrderStatus.ASSIGNED]],
    [OrderStatus.RELEASED, [OrderStatus.DISPATCHED, OrderStatus.CONFIRMED]],
    [OrderStatus.DISPATCHED, [
      OrderStatus.COMPLETED,
      OrderStatus.POSTPONED,
      OrderStatus.ABSENT,
    ]],
  ]);

  // Guard 조건
  private readonly guards = new Map<string, (ctx: TransitionContext) => boolean>([
    // RELEASED → DISPATCHED: 오늘 약속만
    [`${OrderStatus.RELEASED}:${OrderStatus.DISPATCHED}`, (ctx) => {
      const today = new Date().toISOString().split('T')[0];
      return ctx.appointmentDate === today;
    }],

    // DISPATCHED → COMPLETED: 시리얼 필수
    [`${OrderStatus.DISPATCHED}:${OrderStatus.COMPLETED}`, (ctx) =>
      ctx.serialsCaptured === true
    ],
  ]);

  canTransition(from: OrderStatus, to: OrderStatus): boolean {
    return this.transitions.get(from)?.includes(to) ?? false;
  }

  validateTransition(
    from: OrderStatus,
    to: OrderStatus,
    context: TransitionContext,
  ): ValidationResult {
    if (!this.canTransition(from, to)) {
      return { valid: false, error: 'Invalid transition', errorCode: 'E2001' };
    }

    const guard = this.guards.get(`${from}:${to}`);
    if (guard && !guard(context)) {
      return { valid: false, error: 'Guard condition failed', errorCode: 'E2003' };
    }

    return { valid: true };
  }
}
```

### Reference
- `apps/api/src/orders/order-state-machine.ts`
- `.doc/ARCHITECTURE.md` (State Machine 다이어그램)

---

## 6. Optimistic Locking Pattern

### Prisma에서 구현
```typescript
async update(id: string, dto: UpdateOrderDto, userId: string) {
  const existing = await this.prisma.order.findFirst({
    where: { id, deletedAt: null },
  });

  // Version 체크
  if (dto.expectedVersion !== undefined && existing.version !== dto.expectedVersion) {
    throw new ConflictException({
      error: 'E2017',
      message: 'error.version_conflict',
      currentVersion: existing.version,
      serverState: existing,
    });
  }

  // 업데이트 + 버전 증가
  return this.prisma.order.update({
    where: { id },
    data: {
      ...updateData,
      version: { increment: 1 },
    },
  });
}
```

### Client 측 처리
```typescript
// SignalStore에서 optimistic update
async assignOrder(orderId: string, installerId: string): Promise<void> {
  const order = this.store.orders().find(o => o.id === orderId);
  if (!order) return;

  // 1. 낙관적 업데이트 (즉시 UI 반영)
  const optimisticOrder = { ...order, installerId, version: order.version + 1 };
  patchState(this.store, {
    orders: this.store.orders().map(o => o.id === orderId ? optimisticOrder : o),
  });

  try {
    // 2. 서버 요청
    const result = await firstValueFrom(
      this.http.patch(`/orders/${orderId}`, {
        installerId,
        expectedVersion: order.version,
      })
    );

    // 3. 서버 응답으로 업데이트
    patchState(this.store, {
      orders: this.store.orders().map(o => o.id === orderId ? result : o),
    });
  } catch (error: any) {
    if (error.status === 409) {
      // 4. 충돌 → 롤백 + 최신 데이터 fetch
      patchState(this.store, {
        orders: this.store.orders().map(o => o.id === orderId ? order : o),
        error: 'Version conflict. Refreshing data...',
      });
      await this.loadOrders();
    }
  }
}
```

---

## 7. i18n Pattern (ngx-translate)

### 키 형식
```
MODULE.COMPONENT.KEY_NAME

예시:
- orders.list.title
- orders.detail.status_label
- orders.actions.assign
- errors.version_conflict
- common.buttons.save
```

### JSON 파일 구조
```json
// apps/mobile/src/assets/i18n/ko.json
{
  "orders": {
    "list": {
      "title": "주문 목록",
      "empty": "주문이 없습니다"
    },
    "detail": {
      "status_label": "상태",
      "customer_name": "고객명"
    },
    "actions": {
      "assign": "배정",
      "complete": "완료"
    }
  },
  "errors": {
    "version_conflict": "다른 사용자가 수정했습니다. 새로고침해주세요.",
    "network_error": "네트워크 오류가 발생했습니다."
  }
}
```

### 사용법
```typescript
// Template
<ion-title>{{ 'orders.list.title' | translate }}</ion-title>

// Component
const message = this.translate.instant('errors.version_conflict');

// 파라미터 전달
// JSON: "greeting": "안녕하세요, {{name}}님"
{{ 'greeting' | translate: { name: user.name } }}
```

---

## 8. Type Safety (No 'any')

### Interface 정의
```typescript
// ❌ BAD
const data: any = response;
const value = data.something;

// ✅ GOOD
interface OrderResponse {
  data: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

const response = await firstValueFrom(
  this.http.get<OrderResponse>('/orders')
);
// response.data와 response.pagination에 타입 추론 적용
```

### Type Narrowing
```typescript
// unknown + type guard
function isOrder(obj: unknown): obj is Order {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'status' in obj
  );
}

const data: unknown = JSON.parse(rawData);
if (isOrder(data)) {
  console.log(data.status);  // 타입 안전
}
```

### Generic 활용
```typescript
async function fetchData<T>(url: string): Promise<T> {
  const response = await firstValueFrom(this.http.get<T>(url));
  return response;
}

const orders = await fetchData<Order[]>('/orders');
```

---

## Quick Reference

| 패턴 | 위치 | 핵심 키워드 |
|------|------|------------|
| Signal | Service | `signal()`, `computed()`, `effect()` |
| SignalStore | Store | `withState`, `withComputed`, `withMethods`, `patchState` |
| Offline Queue | DB Service | `db.syncQueue.add()`, `processQueue()` |
| NestJS DTO | DTO | `@IsOptional()`, `@IsEnum()`, `@ApiPropertyOptional()` |
| State Machine | Service | `transitions`, `guards`, `validateTransition()` |
| Optimistic Lock | Service | `expectedVersion`, `version: { increment: 1 }` |
| i18n | JSON | `MODULE.COMPONENT.KEY` 형식 |
| Type Safety | Interface | `interface`, `type guard`, `generic` |
