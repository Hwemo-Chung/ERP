// apps/web/src/app/shared/services/session-manager.service.spec.ts
// FR-19: Session Manager Service Unit Tests
import { TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular/standalone';
import { SessionManagerService } from './session-manager.service';

describe('SessionManagerService - FR-19', () => {
  let service: SessionManagerService;
  let router: jasmine.SpyObj<Router>;
  let modalCtrl: jasmine.SpyObj<ModalController>;

  const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  const WARNING_BEFORE_MS = 5 * 60 * 1000; // 5 minutes warning

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Create spies
    router = jasmine.createSpyObj('Router', ['navigate']);
    modalCtrl = jasmine.createSpyObj('ModalController', ['create']);

    TestBed.configureTestingModule({
      providers: [
        SessionManagerService,
        { provide: Router, useValue: router },
        { provide: ModalController, useValue: modalCtrl },
      ],
    });

    service = TestBed.inject(SessionManagerService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Session lifecycle', () => {
    it('should start session with correct state', () => {
      service.startSession();

      expect(service.state().isAuthenticated).toBeTrue();
      expect(service.state().lastActivity).toBeDefined();
      expect(service.state().expiresAt).toBeDefined();
    });

    it('should set expiration time to 30 minutes from now', () => {
      const beforeStart = Date.now();
      service.startSession();
      const afterStart = Date.now();

      const expiresAt = service.state().expiresAt.getTime();
      const expectedMin = beforeStart + IDLE_TIMEOUT_MS;
      const expectedMax = afterStart + IDLE_TIMEOUT_MS;

      expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
      expect(expiresAt).toBeLessThanOrEqual(expectedMax);
    });

    it('should end session and clear state', () => {
      service.startSession();
      service.preserveFormData('testKey', { value: 'test' });

      service.endSession(true);

      expect(service.state().isAuthenticated).toBeFalse();
      expect(Object.keys(service.state().preservedFormData).length).toBe(0);
    });

    it('should end session but preserve form data when requested', () => {
      service.startSession();
      service.preserveFormData('testKey', { value: 'test' });

      service.endSession(false);

      expect(service.state().isAuthenticated).toBeFalse();
      expect(service.state().preservedFormData['testKey']).toBeDefined();
    });
  });

  describe('Session extension', () => {
    it('should extend session and update expiration time', fakeAsync(() => {
      service.startSession();
      tick(5000); // Wait 5 seconds

      const beforeExtend = service.state().expiresAt.getTime();
      service.extendSession();
      const afterExtend = service.state().expiresAt.getTime();

      expect(afterExtend).toBeGreaterThan(beforeExtend);
    }));

    it('should reset warning flag when session extended', () => {
      service.startSession();
      (service as any).showWarning.set(true);

      service.extendSession();

      expect(service.showWarning()).toBeFalse();
    });

    it('should reset remaining seconds counter', () => {
      service.startSession();
      (service as any).remainingSeconds.set(100);

      service.extendSession();

      expect(service.remainingSeconds()).toBe(IDLE_TIMEOUT_MS / 1000);
    });
  });

  describe('Form data preservation', () => {
    it('should preserve form data with key', () => {
      const testData = { username: 'test', email: 'test@example.com' };

      service.preserveFormData('loginForm', testData);

      expect(service.state().preservedFormData['loginForm']).toEqual(testData);
    });

    it('should retrieve preserved form data', () => {
      const testData = { orderId: '123', status: 'pending' };
      service.preserveFormData('orderForm', testData);

      const retrieved = service.getPreservedData<typeof testData>('orderForm');

      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent key', () => {
      const retrieved = service.getPreservedData('nonExistent');

      expect(retrieved).toBeNull();
    });

    it('should save preserved data to localStorage', () => {
      const testData = { field: 'value' };
      service.preserveFormData('testForm', testData);

      const stored = localStorage.getItem('session_preserved_data');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.testForm).toEqual(testData);
    });

    it('should load preserved data from localStorage on init', () => {
      const testData = { testForm: { field: 'value' } };
      localStorage.setItem('session_preserved_data', JSON.stringify(testData));

      // Create new service instance to trigger load
      const newService = new SessionManagerService();

      expect(newService.state().preservedFormData).toEqual(testData);
    });

    it('should handle multiple form data keys', () => {
      service.preserveFormData('form1', { data: '1' });
      service.preserveFormData('form2', { data: '2' });
      service.preserveFormData('form3', { data: '3' });

      expect(Object.keys(service.state().preservedFormData).length).toBe(3);
      expect(service.getPreservedData('form1')).toEqual({ data: '1' });
      expect(service.getPreservedData('form2')).toEqual({ data: '2' });
      expect(service.getPreservedData('form3')).toEqual({ data: '3' });
    });
  });

  describe('Clear preserved data', () => {
    it('should clear specific key', () => {
      service.preserveFormData('form1', { data: '1' });
      service.preserveFormData('form2', { data: '2' });

      service.clearPreservedData('form1');

      expect(service.getPreservedData('form1')).toBeNull();
      expect(service.getPreservedData('form2')).toBeDefined();
    });

    it('should clear all preserved data when no key provided', () => {
      service.preserveFormData('form1', { data: '1' });
      service.preserveFormData('form2', { data: '2' });

      service.clearPreservedData();

      expect(Object.keys(service.state().preservedFormData).length).toBe(0);
    });

    it('should update localStorage when clearing data', () => {
      service.preserveFormData('form1', { data: '1' });
      service.clearPreservedData();

      const stored = localStorage.getItem('session_preserved_data');
      const parsed = JSON.parse(stored!);

      expect(Object.keys(parsed).length).toBe(0);
    });
  });

  describe('Session timeout', () => {
    it('should show warning before timeout', fakeAsync(() => {
      service.startSession();

      // Advance time to warning threshold (25 minutes)
      tick(IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);

      expect(service.showWarning()).toBeTrue();

      flush();
    }));

    it('should expire session after idle timeout', fakeAsync(() => {
      service.startSession();

      // Advance time past timeout
      tick(IDLE_TIMEOUT_MS + 1000);

      expect(router.navigate).toHaveBeenCalledWith(
        ['/auth/login'],
        jasmine.objectContaining({
          queryParams: { sessionExpired: true },
        })
      );

      flush();
    }));

    it('should not expire if user activity occurs', fakeAsync(() => {
      service.startSession();

      // Simulate user activity halfway through
      tick(IDLE_TIMEOUT_MS / 2);
      service.extendSession();

      // Wait another half timeout (should not expire)
      tick(IDLE_TIMEOUT_MS / 2);

      expect(router.navigate).not.toHaveBeenCalled();

      flush();
    }));

    it('should calculate isExpired correctly', fakeAsync(() => {
      service.startSession();

      expect(service.isExpired()).toBeFalse();

      // Advance past expiration
      tick(IDLE_TIMEOUT_MS + 1000);

      expect(service.isExpired()).toBeTrue();

      flush();
    }));
  });

  describe('Activity tracking', () => {
    it('should reset timer on user activity', fakeAsync(() => {
      service.startSession();
      const initialExpiry = service.state().expiresAt.getTime();

      // Wait 5 seconds
      tick(5000);

      // Simulate user activity (mouse click)
      const mouseEvent = new MouseEvent('mousedown');
      document.dispatchEvent(mouseEvent);
      tick(100);

      const newExpiry = service.state().expiresAt.getTime();

      // New expiry should be later than initial
      expect(newExpiry).toBeGreaterThan(initialExpiry);

      flush();
    }));

    it('should not auto-extend during warning state', fakeAsync(() => {
      service.startSession();

      // Move to warning state
      tick(IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);
      expect(service.showWarning()).toBeTrue();

      // Try to trigger activity
      const mouseEvent = new MouseEvent('mousedown');
      document.dispatchEvent(mouseEvent);
      tick(100);

      // Should still be in warning state
      expect(service.showWarning()).toBeTrue();

      flush();
    }));

    it('should track mousedown events', fakeAsync(() => {
      service.startSession();
      const initialActivity = service.state().lastActivity.getTime();

      tick(1000);

      const event = new MouseEvent('mousedown');
      document.dispatchEvent(event);
      tick(100);

      const newActivity = service.state().lastActivity.getTime();
      expect(newActivity).toBeGreaterThan(initialActivity);

      flush();
    }));

    it('should track keydown events', fakeAsync(() => {
      service.startSession();
      const initialActivity = service.state().lastActivity.getTime();

      tick(1000);

      const event = new KeyboardEvent('keydown');
      document.dispatchEvent(event);
      tick(100);

      const newActivity = service.state().lastActivity.getTime();
      expect(newActivity).toBeGreaterThan(initialActivity);

      flush();
    }));

    it('should track touchstart events', fakeAsync(() => {
      service.startSession();
      const initialActivity = service.state().lastActivity.getTime();

      tick(1000);

      const event = new TouchEvent('touchstart');
      document.dispatchEvent(event);
      tick(100);

      const newActivity = service.state().lastActivity.getTime();
      expect(newActivity).toBeGreaterThan(initialActivity);

      flush();
    }));
  });

  describe('Session restoration', () => {
    it('should restore session after re-authentication', async () => {
      const result = await service.restoreSession();

      expect(result).toBeTrue();
      expect(service.state().isAuthenticated).toBeTrue();
    });

    it('should not clear preserved data on restoration', async () => {
      service.preserveFormData('testForm', { data: 'preserved' });
      service.endSession(false);

      await service.restoreSession();

      expect(service.getPreservedData('testForm')).toEqual({ data: 'preserved' });
    });
  });

  describe('Remaining time calculation', () => {
    it('should calculate remaining seconds correctly', fakeAsync(() => {
      service.startSession();

      const initial = service.remainingSeconds();
      expect(initial).toBe(IDLE_TIMEOUT_MS / 1000);

      tick(5000); // Wait 5 seconds

      // Countdown should update
      expect(service.remainingSeconds()).toBeLessThan(initial);

      flush();
    }));

    it('should update remaining seconds every second', fakeAsync(() => {
      service.startSession();

      const values: number[] = [];
      for (let i = 0; i < 3; i++) {
        tick(1000);
        values.push(service.remainingSeconds());
      }

      // Each value should be less than previous
      expect(values[0]).toBeGreaterThan(values[1]);
      expect(values[1]).toBeGreaterThan(values[2]);

      flush();
    }));
  });

  describe('Edge cases', () => {
    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('session_preserved_data', 'invalid json');

      // Should not throw error
      expect(() => {
        new SessionManagerService();
      }).not.toThrow();
    });

    it('should handle localStorage quota exceeded', () => {
      const largeData = { huge: 'x'.repeat(10000000) };

      // Should not throw error even if localStorage is full
      expect(() => {
        service.preserveFormData('large', largeData);
      }).not.toThrow();
    });

    it('should not track activity when not authenticated', fakeAsync(() => {
      // Don't start session
      const event = new MouseEvent('mousedown');
      document.dispatchEvent(event);
      tick(100);

      expect(service.state().isAuthenticated).toBeFalse();

      flush();
    }));

    it('should handle multiple rapid session extensions', fakeAsync(() => {
      service.startSession();

      // Rapid extensions
      for (let i = 0; i < 10; i++) {
        service.extendSession();
        tick(100);
      }

      expect(service.state().isAuthenticated).toBeTrue();

      flush();
    }));

    it('should handle session end during warning period', fakeAsync(() => {
      service.startSession();

      // Move to warning state
      tick(IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);
      expect(service.showWarning()).toBeTrue();

      // End session
      service.endSession();

      expect(service.state().isAuthenticated).toBeFalse();
      expect(service.showWarning()).toBeFalse();

      flush();
    }));
  });

  describe('Storage integration', () => {
    it('should persist multiple form updates', () => {
      service.preserveFormData('form1', { step: 1 });
      service.preserveFormData('form1', { step: 2 });
      service.preserveFormData('form1', { step: 3 });

      const stored = localStorage.getItem('session_preserved_data');
      const parsed = JSON.parse(stored!);

      expect(parsed.form1.step).toBe(3);
    });

    it('should maintain separate form data keys', () => {
      service.preserveFormData('orderForm', { orderId: '123' });
      service.preserveFormData('customerForm', { name: 'John' });

      const orderData = service.getPreservedData('orderForm');
      const customerData = service.getPreservedData('customerForm');

      expect(orderData).toEqual({ orderId: '123' });
      expect(customerData).toEqual({ name: 'John' });
    });

    it('should handle empty preserved data', () => {
      localStorage.setItem('session_preserved_data', '{}');

      const newService = new SessionManagerService();

      expect(Object.keys(newService.state().preservedFormData).length).toBe(0);
    });
  });

  describe('Complex data types', () => {
    it('should preserve arrays', () => {
      const arrayData = [1, 2, 3, 4, 5];
      service.preserveFormData('arrayForm', arrayData);

      const retrieved = service.getPreservedData<number[]>('arrayForm');

      expect(retrieved).toEqual(arrayData);
    });

    it('should preserve nested objects', () => {
      const nestedData = {
        user: {
          id: '123',
          profile: {
            name: 'Test',
            settings: {
              theme: 'dark',
            },
          },
        },
      };

      service.preserveFormData('nestedForm', nestedData);

      const retrieved = service.getPreservedData('nestedForm');

      expect(retrieved).toEqual(nestedData);
    });

    it('should preserve null and undefined values', () => {
      service.preserveFormData('nullForm', null);
      service.preserveFormData('undefinedForm', undefined);

      expect(service.getPreservedData('nullForm')).toBeNull();
      expect(service.getPreservedData('undefinedForm')).toBeUndefined();
    });
  });
});
