/**
 * @fileoverview Mobile Order List Page Test Suite
 * @description Tests for virtual scrolling in mobile app
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';

import { OrderListPage } from './order-list.page';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { OrderStatus } from '../../../../store/orders/orders.models';

describe('OrderListPage (Mobile) - Virtual Scrolling', () => {
  let component: OrderListPage;
  let fixture: ComponentFixture<OrderListPage>;

  const mockOrders = Array.from({ length: 1000 }, (_, i) => ({
    id: \`order-\${i}\`,
    orderNo: \`ORD-\${i}\`,
    customerName: \`Customer \${i}\`,
    customerPhone: '010-0000-0000',
    customerAddress: 'Address',
    appointmentDate: new Date(),
    appointmentSlot: null,
    status: OrderStatus.UNASSIGNED,
    installerName: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderListPage, TranslateModule.forRoot(), ScrollingModule],
      providers: [
        {
          provide: OrdersStore,
          useValue: jasmine.createSpyObj('OrdersStore', ['loadOrders', 'loadStats'], {
            filteredOrders: signal(mockOrders),
            isLoading: signal(false),
            pagination: signal({ hasMore: false, total: 1000, page: 1, limit: 20 }),
            kpiMetrics: signal({ total: 1000, pending: 300, dispatched: 200, completed: 500 }),
          }),
        },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderListPage);
    component = fixture.componentInstance;
  });

  it('should render less than 50 items for 1000 orders', () => {
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('ion-item');
    expect(items.length).toBeLessThan(50);
  });

  it('should use virtual scrolling viewport', () => {
    fixture.detectChanges();
    const viewport = fixture.debugElement.query(By.directive(CdkVirtualScrollViewport));
    expect(viewport).toBeTruthy();
  });

  it('should have trackById function', () => {
    expect(component.trackById).toBeDefined();
    const order = mockOrders[0];
    expect(component.trackById(0, order)).toBe(order.id);
  });
});
