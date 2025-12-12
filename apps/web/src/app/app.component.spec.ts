// apps/web/src/app/app.component.spec.ts
// FR-21: Hardware Back Button Unit Tests
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { AppComponent } from './app.component';
import { Platform, AlertController, ToastController } from '@ionic/angular/standalone';
import { SessionManagerService } from './core/services/session-manager.service';
import { NetworkService } from './core/services/network.service';
import { App } from '@capacitor/app';

// Mock Capacitor App
jest.mock('@capacitor/app', () => ({
  App: {
    addListener: jest.fn(),
    exitApp: jest.fn(),
  },
}));

describe('AppComponent - FR-21 Hardware Back Button', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let router: jasmine.SpyObj<Router>;
  let location: jasmine.SpyObj<Location>;
  let platform: jasmine.SpyObj<Platform>;
  let alertController: jasmine.SpyObj<AlertController>;
  let toastController: jasmine.SpyObj<ToastController>;
  let sessionManager: jasmine.SpyObj<SessionManagerService>;
  let networkService: jasmine.SpyObj<NetworkService>;

  let backButtonHandler: (event: { canGoBack: boolean }) => void;

  beforeEach(async () => {
    // Create spies
    router = jasmine.createSpyObj('Router', ['navigate'], {
      url: '/tabs/orders',
    });

    location = jasmine.createSpyObj('Location', ['back']);

    platform = jasmine.createSpyObj('Platform', ['is']);
    platform.is.and.returnValue(true); // Default to capacitor platform

    alertController = jasmine.createSpyObj('AlertController', ['create']);
    toastController = jasmine.createSpyObj('ToastController', ['create']);

    sessionManager = jasmine.createSpyObj('SessionManagerService', ['state'], {
      state: jest.fn().mockReturnValue({ preservedFormData: {} }),
    });

    networkService = jasmine.createSpyObj('NetworkService', ['isOffline'], {
      isOffline: jest.fn().mockReturnValue(false),
    });

    // Capture backButton listener
    (App.addListener as jest.Mock).mockImplementation((eventName, handler) => {
      if (eventName === 'backButton') {
        backButtonHandler = handler;
      }
      return { remove: jest.fn() };
    });

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: Location, useValue: location },
        { provide: Platform, useValue: platform },
        { provide: AlertController, useValue: alertController },
        { provide: ToastController, useValue: toastController },
        { provide: SessionManagerService, useValue: sessionManager },
        { provide: NetworkService, useValue: networkService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setupHardwareBackButton', () => {
    it('should not setup listener on web platform', () => {
      platform.is.and.returnValue(false);

      component.ngOnInit();

      expect(App.addListener).not.toHaveBeenCalled();
    });

    it('should setup listener on capacitor platform', () => {
      platform.is.and.returnValue(true);

      component.ngOnInit();

      expect(App.addListener).toHaveBeenCalledWith('backButton', jasmine.any(Function));
    });
  });

  describe('double-back to exit', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should show exit warning on first back press from root tab', fakeAsync(() => {
      Object.defineProperty(router, 'url', { value: '/tabs/orders', writable: true });

      const mockToast = {
        present: jest.fn(),
      };
      toastController.create.and.returnValue(Promise.resolve(mockToast as any));

      backButtonHandler({ canGoBack: false });
      tick();

      expect(toastController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: '뒤로 버튼을 한 번 더 누르면 앱이 종료됩니다',
          duration: 2000,
        })
      );
      expect(mockToast.present).toHaveBeenCalled();
      expect(App.exitApp).not.toHaveBeenCalled();
    }));

    it('should exit app on second back press within 2 seconds', fakeAsync(() => {
      Object.defineProperty(router, 'url', { value: '/tabs/orders', writable: true });

      const mockToast = {
        present: jest.fn(),
      };
      toastController.create.and.returnValue(Promise.resolve(mockToast as any));

      // First press
      backButtonHandler({ canGoBack: false });
      tick();

      // Second press within 2 seconds
      backButtonHandler({ canGoBack: false });
      tick();

      expect(App.exitApp).toHaveBeenCalled();
    }));

    it('should reset timer after 2 seconds', fakeAsync(() => {
      Object.defineProperty(router, 'url', { value: '/tabs/orders', writable: true });

      const mockToast = {
        present: jest.fn(),
      };
      toastController.create.and.returnValue(Promise.resolve(mockToast as any));

      // First press
      backButtonHandler({ canGoBack: false });
      tick();

      // Wait more than 2 seconds
      tick(2500);

      // Second press (should show warning again, not exit)
      backButtonHandler({ canGoBack: false });
      tick();

      expect(App.exitApp).not.toHaveBeenCalled();
      expect(toastController.create).toHaveBeenCalledTimes(2);
    }));

    it('should recognize all root tabs', fakeAsync(() => {
      const rootTabs = [
        '/tabs/orders',
        '/tabs/assignment',
        '/tabs/completion',
        '/tabs/reports',
        '/tabs/settings',
      ];

      const mockToast = {
        present: jest.fn(),
      };
      toastController.create.and.returnValue(Promise.resolve(mockToast as any));

      for (const tab of rootTabs) {
        Object.defineProperty(router, 'url', { value: tab, writable: true });

        backButtonHandler({ canGoBack: false });
        tick();

        expect(toastController.create).toHaveBeenCalled();
        toastController.create.calls.reset();
      }
    }));

    it('should not trigger double-back on sub-pages', fakeAsync(() => {
      Object.defineProperty(router, 'url', { value: '/tabs/orders/detail/123', writable: true });

      backButtonHandler({ canGoBack: true });
      tick();

      expect(toastController.create).not.toHaveBeenCalled();
      expect(location.back).toHaveBeenCalled();
    }));
  });

  describe('unsaved data protection', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should show confirmation dialog when unsaved data exists', fakeAsync(() => {
      Object.defineProperty(router, 'url', { value: '/tabs/orders/detail/123', writable: true });

      // Mock unsaved data
      (sessionManager.state as any).mockReturnValue({
        preservedFormData: {
          orderForm: { customerId: '123' },
        },
      });

      const mockAlert = {
        present: jest.fn(),
        onDidDismiss: jest.fn().mockResolvedValue({ role: 'cancel' }),
      };
      alertController.create.and.returnValue(Promise.resolve(mockAlert as any));

      backButtonHandler({ canGoBack: true });
      tick();

      expect(alertController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          header: '저장되지 않은 데이터',
          message: '작성 중인 내용이 있습니다. 페이지를 나가시겠습니까?',
        })
      );
      expect(mockAlert.present).toHaveBeenCalled();
    }));

    it('should go back when user confirms discarding changes', fakeAsync(() => {
      Object.defineProperty(router, 'url', { value: '/tabs/orders/detail/123', writable: true });

      (sessionManager.state as any).mockReturnValue({
        preservedFormData: {
          orderForm: { customerId: '123' },
        },
      });

      const mockAlert = {
        present: jest.fn(),
        onDidDismiss: jest.fn().mockResolvedValue({ role: 'discard' }),
      };
      alertController.create.and.returnValue(Promise.resolve(mockAlert as any));

      backButtonHandler({ canGoBack: true });
      tick();

      expect(mockAlert.onDidDismiss).toHaveBeenCalled();
    }));

    it('should cancel navigation when user cancels', fakeAsync(() => {
      Object.defineProperty(router, 'url', { value: '/tabs/orders/detail/123', writable: true });

      (sessionManager.state as any).mockReturnValue({
        preservedFormData: {
          orderForm: { customerId: '123' },
        },
      });

      const mockAlert = {
        present: jest.fn(),
        onDidDismiss: jest.fn().mockResolvedValue({ role: 'cancel' }),
      };
      alertController.create.and.returnValue(Promise.resolve(mockAlert as any));

      backButtonHandler({ canGoBack: true });
      tick();

      expect(location.back).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    }));
  });

  describe('normal navigation', () => {
    beforeEach(() => {
      component.ngOnInit();
      // Clear preserved form data
      (sessionManager.state as any).mockReturnValue({
        preservedFormData: {},
      });
    });

    it('should use location.back() when history exists', fakeAsync(() => {
      Object.defineProperty(router, 'url', { value: '/tabs/orders/detail/123', writable: true });

      backButtonHandler({ canGoBack: true });
      tick();

      expect(location.back).toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    }));

    it('should navigate to /tabs/orders when no history', fakeAsync(() => {
      Object.defineProperty(router, 'url', { value: '/tabs/settings/profile', writable: true });

      backButtonHandler({ canGoBack: false });
      tick();

      expect(router.navigate).toHaveBeenCalledWith(['/tabs/orders'], { replaceUrl: true });
      expect(location.back).not.toHaveBeenCalled();
    }));

    it('should handle sub-page with history correctly', fakeAsync(() => {
      Object.defineProperty(router, 'url', { value: '/tabs/completion/detail/456', writable: true });

      backButtonHandler({ canGoBack: true });
      tick();

      expect(location.back).toHaveBeenCalled();
    }));
  });

  describe('edge cases', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should handle invalid URLs gracefully', fakeAsync(() => {
      Object.defineProperty(router, 'url', { value: '', writable: true });

      backButtonHandler({ canGoBack: false });
      tick();

      expect(router.navigate).toHaveBeenCalledWith(['/tabs/orders'], { replaceUrl: true });
    }));

    it('should handle URLs with query parameters', fakeAsync(() => {
      Object.defineProperty(router, 'url', { value: '/tabs/orders?filter=pending', writable: true });

      const mockToast = {
        present: jest.fn(),
      };
      toastController.create.and.returnValue(Promise.resolve(mockToast as any));

      backButtonHandler({ canGoBack: false });
      tick();

      expect(toastController.create).toHaveBeenCalled();
    }));

    it('should handle URLs with fragments', fakeAsync(() => {
      Object.defineProperty(router, 'url', { value: '/tabs/settings#account', writable: true });

      const mockToast = {
        present: jest.fn(),
      };
      toastController.create.and.returnValue(Promise.resolve(mockToast as any));

      backButtonHandler({ canGoBack: false });
      tick();

      expect(toastController.create).toHaveBeenCalled();
    }));
  });

  describe('checkUnsavedData', () => {
    it('should return true when preserved form data exists', () => {
      (sessionManager.state as any).mockReturnValue({
        preservedFormData: {
          orderForm: { customerId: '123' },
        },
      });

      const result = component['checkUnsavedData']();

      expect(result).toBeTrue();
    });

    it('should return false when no preserved form data', () => {
      (sessionManager.state as any).mockReturnValue({
        preservedFormData: {},
      });

      const result = component['checkUnsavedData']();

      expect(result).toBeFalse();
    });

    it('should return false when preservedFormData is null', () => {
      (sessionManager.state as any).mockReturnValue({
        preservedFormData: null,
      });

      const result = component['checkUnsavedData']();

      expect(result).toBeFalse();
    });
  });

  describe('ngOnDestroy', () => {
    it('should complete destroy$ subject', () => {
      const destroySpy = spyOn(component['destroy$'], 'next');
      const completeSpy = spyOn(component['destroy$'], 'complete');

      component.ngOnDestroy();

      expect(destroySpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalled();
    });
  });
});
