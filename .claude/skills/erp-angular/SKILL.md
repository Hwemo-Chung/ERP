---
name: erp-angular
description: This skill should be used when working with Angular components, inject() errors, Signals, firstValueFrom, or Ionic patterns in this ERP project.
---

## Dependency Injection

```typescript
// CORRECT: inject() in field initializer only
@Component({...})
export class OrderListPage {
  private authService = inject(AuthService);
  private ordersStore = inject(OrdersStore);

  loadOrders() {
    const user = this.authService.user();
    const branchCode = user?.branchCode ?? 'ALL';
  }
}

// WRONG: inject() inside method - Runtime Error!
loadOrders() {
  const store = inject(OrdersStore);  // Error!
}
```

## Signal-based State

```typescript
private loading = signal(false);
private orders = signal<Order[]>([]);

protected filteredOrders = computed(() =>
  this.orders().filter(o => o.status === this.selectedStatus())
);

constructor() {
  effect(() => {
    if (this.authService.isAuthenticated()) {
      this.loadOrders();
    }
  });
}
```

## Observable to Promise

```typescript
import { firstValueFrom } from 'rxjs';

async loadData() {
  const response = await firstValueFrom(
    this.http.get<ApiResponse>('/api/orders')
  );
  this.orders.set(response.data.data);  // Double nesting!
}
```

## Optimization

- Zoneless: `provideExperimentalZonelessChangeDetection()`
- `ChangeDetectionStrategy.OnPush`
- Virtual Scrolling for 20+ items
