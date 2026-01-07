/**
 * @fileoverview Order List Page Component Test Suite
 * @description Tests for virtual scrolling implementation and order list functionality
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { of } from 'rxjs';

import { OrderListPage } from './order-list.page';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { InstallersStore } from '../../../../store/installers/installers.store';
import { UIStore } from '../../../../store/ui/ui.store';
import { NetworkService } from '@core/services/network.service';
import { OrderStatus } from '../../../../store/orders/orders.models';

describe('OrderListPage - Virtual Scrolling', () => {
  let component: OrderListPage;
  let fixture: ComponentFixture<OrderListPage>;
  let ordersStore: jasmine.SpyObj<OrdersStore>;

  const mockOrders = Array.from({ length: 1000 }, (_, i) => ({
    id: 'order-' + i,
    orderNo: 'ORD-2024-' + String(i).padStart(4, '0'),
    customerName: 'Customer ' + i,
    customerPhone: '010-0000-0000',
    customerAddress: 'Address',
    appointmentDate: new Date('2024-01-15'),
    appointmentSlot: '09:00-12:00',
    status: OrderStatus.UNASSIGNED,
    installerName: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  beforeEach(async () => {
    const ordersStoreSpy = jasmine.createSpyObj('OrdersStore', [
      'loadOrders',
      'loadStats',
      'selectOrder',
    ], {
      orders: signal(mockOrders),
      filteredOrders: signal(mockOrders),
      isLoading: signal(false),
      pagination: signal({ hasMore: false, total: 1000, page: 1, limit: 20 }),
      kpiMetrics: signal({ total: 1000, pending: 300, dispatched: 200, completed: 500 }),
    });

    await TestBed.configureTestingModule({
      imports: [OrderListPage, TranslateModule.forRoot(), ScrollingModule],
      providers: [
        { provide: OrdersStore, useValue: ordersStoreSpy },
        { provide: InstallersStore, useValue: jasmine.createSpyObj('InstallersStore', ['loadInstallers']) },
        { provide: UIStore, useValue: jasmine.createSpyObj('UIStore', ['showToast']) },
        { provide: NetworkService, useValue: jasmine.createSpyObj('NetworkService', ['isOffline']) },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
        {
          provide: TranslateService,
          useValue: {
            instant: (key: string) => key,
            get: (key: string) => of(key),
            onLangChange: of({}),
            onTranslationChange: of({}),
            onDefaultLangChange: of({}),
          },
        },
      ],
    }).compileComponents();

    ordersStore = TestBed.inject(OrdersStore) as jasmine.SpyObj<OrdersStore>;
    fixture = TestBed.createComponent(OrderListPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render less than 50 DOM nodes for 1000 items', () => {
    fixture.detectChanges();
    const renderedItems = fixture.nativeElement.querySelectorAll('.order-item, tr[data-order-id]');
    expect(renderedItems.length).toBeLessThan(50);
  });

  it('should use CdkVirtualScrollViewport', () => {
    fixture.detectChanges();
    const viewport = fixture.debugElement.query(By.directive(CdkVirtualScrollViewport));
    expect(viewport).toBeTruthy();
  });
});
