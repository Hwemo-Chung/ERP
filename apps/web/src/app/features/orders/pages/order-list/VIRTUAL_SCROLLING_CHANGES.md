# Virtual Scrolling Implementation Changes for Web App

## Changes Required:

### 1. Add import at line 15 (after Router import):
```typescript
import { ScrollingModule } from '@angular/cdk/scrolling';
```

### 2. Add to imports array at line 94 (after TranslateModule):
```typescript
    ScrollingModule,
```

### 3. Add trackById method after line 1110 (in class body):
```typescript
  /**
   * TrackBy function for virtual scrolling optimization
   * Returns unique identifier to help Angular track DOM reuse
   * Complexity: O(1) - Single property access
   */
  protected trackById = (_index: number, order: any): string => order.id;
```

### 4. Replace mobile view ion-list section (lines 372-402) with:
```typescript
        <cdk-virtual-scroll-viewport
          itemSize="88"
          class="order-list-viewport"
          minBufferPx="400"
          maxBufferPx="800">
          <ion-list>
            <ion-item
              *cdkVirtualFor="let order of ordersStore.filteredOrders(); trackBy: trackById"
              button
              (click)="viewOrder(order.id)"
              class="order-item">
              <div class="order-content">
                <div class="order-header">
                  <span class="order-number">{{ order.orderNo }}</span>
                  <ion-badge [color]="getStatusColor(order.status)">
                    {{ getStatusLabel(order.status) }}
                  </ion-badge>
                </div>
                <h2 class="customer-name">{{ order.customerName }}</h2>
                <div class="order-meta">
                  <span class="meta-item">
                    <ion-icon name="location-outline"></ion-icon>
                    {{ order.customerAddress }}
                  </span>
                </div>
                <div class="order-meta">
                  <span class="meta-item appointment">
                    <ion-icon name="calendar-outline"></ion-icon>
                    {{ order.appointmentDate | date:'MM/dd (EEE)' }}
                    @if (order.appointmentSlot) {
                      · {{ order.appointmentSlot }}
                    }
                  </span>
                </div>
              </div>
              <ion-icon slot="end" name="chevron-forward-outline" class="chevron-icon"></ion-icon>
            </ion-item>
          </ion-list>
        </cdk-virtual-scroll-viewport>
```

### 5. Add to styles (after line 596, before web-view styles):
```scss
    /* Virtual Scroll Viewport */
    .order-list-viewport {
      height: calc(100vh - 56px - 56px - 56px - 80px); /* headers + stats + tabs */
      width: 100%;
    }

    cdk-virtual-scroll-viewport {
      contain: strict;

      .cdk-virtual-scroll-content-wrapper {
        display: flex;
        flex-direction: column;
      }
    }
```

## Automated Patch Script:

Save and run this if you want to apply automatically:
```bash
#!/bin/bash
# This is a reference - manual application is safer
echo "Please apply changes manually following the guide above"
```
