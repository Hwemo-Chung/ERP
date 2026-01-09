import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { signal } from '@angular/core';

import { OrderListPage } from './order-list.page';
import { OrdersStore } from '../../../../store/orders/orders.store';
import { InstallersStore } from '../../../../store/installers/installers.store';
import { UIStore } from '../../../../store/ui/ui.store';
import { AuthService } from '@core/services/auth.service';
import { NetworkService } from '@core/services/network.service';
import { OrderStatus } from '../../../../store/orders/orders.models';

describe('OrderListPage (Mobile)', () => {
  let component: OrderListPage;
  let fixture: ComponentFixture<OrderListPage>;

  const mockOrders = Array.from({ length: 100 }, (_, i) => ({
    id: `order-${i}`,
    orderNo: `ORD-${i}`,
    customerName: `Customer ${i}`,
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
      imports: [OrderListPage, TranslateModule.forRoot()],
      providers: [
        {
          provide: OrdersStore,
          useValue: jasmine.createSpyObj(
            'OrdersStore',
            [
              'loadOrders',
              'loadStats',
              'setFilters',
              'clearFilters',
              'loadMoreOrders',
              'selectOrder',
            ],
            {
              orders: signal(mockOrders),
              filteredOrders: signal(mockOrders),
              isLoading: signal(false),
              pagination: signal({ hasMore: false, total: 100, page: 1, limit: 20 }),
              kpiMetrics: signal({ total: 100, pending: 30, dispatched: 20, completed: 50 }),
            },
          ),
        },
        {
          provide: InstallersStore,
          useValue: jasmine.createSpyObj('InstallersStore', ['loadInstallers']),
        },
        {
          provide: UIStore,
          useValue: jasmine.createSpyObj('UIStore', ['showToast']),
        },
        {
          provide: AuthService,
          useValue: jasmine.createSpyObj('AuthService', [], {
            user: signal({ branchCode: 'BR001' }),
          }),
        },
        {
          provide: NetworkService,
          useValue: jasmine.createSpyObj('NetworkService', [], {
            isOffline: signal(false),
          }),
        },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderListPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render orders list', () => {
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('ion-item');
    expect(items.length).toBeGreaterThan(0);
  });

  it('should display KPI metrics', () => {
    fixture.detectChanges();
    const badges = fixture.nativeElement.querySelectorAll('.kpi-summary ion-badge');
    expect(badges.length).toBe(2);
  });
});
