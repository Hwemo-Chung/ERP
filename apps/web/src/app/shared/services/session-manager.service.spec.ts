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

  beforeEach(() => {
    localStorage.clear();

    router = jasmine.createSpyObj('Router', ['navigate']);
    modalCtrl = jasmine.createSpyObj('ModalController', ['create']);

    // Mock modal create
    const mockModal = {
      present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
      onDidDismiss: jasmine.createSpy('onDidDismiss').and.returnValue(
        Promise.resolve({ data: { action: 'extend' }, role: 'confirm' })
      ),
      dismiss: jasmine.createSpy('dismiss').and.returnValue(Promise.resolve()),
    };
    modalCtrl.create.and.returnValue(Promise.resolve(mockModal as any));

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
    it('should extend session and update expiration time', () => {
      service.startSession();
      const beforeExtend = service.state().expiresAt.getTime();

      // Wait a bit before extending
      setTimeout(() => {
        service.extendSession();
        const afterExtend = service.state().expiresAt.getTime();
        expect(afterExtend).toBeGreaterThanOrEqual(beforeExtend);
      }, 10);
    });

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

  describe('Session timeout state', () => {
    it('should have showWarning signal initialized to false', () => {
      expect(service.showWarning()).toBeFalse();
    });

    it('should have remainingSeconds initialized correctly after startSession', () => {
      service.startSession();
      expect(service.remainingSeconds()).toBe(IDLE_TIMEOUT_MS / 1000);
    });

    it('should have isExpired return false for active session', () => {
      service.startSession();
      expect(service.isExpired()).toBeFalse();
    });
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

  describe('Complex data types', () => {
    it('should preserve nested objects', () => {
      const complexData = {
        user: { name: 'Test', roles: ['admin', 'user'] },
        settings: { theme: 'dark', notifications: true },
      };

      service.preserveFormData('complex', complexData);

      const retrieved = service.getPreservedData('complex');
      expect(retrieved).toEqual(complexData);
    });

    it('should preserve arrays', () => {
      const arrayData = ['item1', 'item2', 'item3'];

      service.preserveFormData('array', arrayData);

      expect(service.getPreservedData('array')).toEqual(arrayData);
    });

    it('should preserve null and undefined values', () => {
      const dataWithNulls = { name: 'Test', value: null, other: undefined };

      service.preserveFormData('nulls', dataWithNulls);

      const retrieved = service.getPreservedData<typeof dataWithNulls>('nulls');
      expect(retrieved?.name).toBe('Test');
      expect(retrieved?.value).toBeNull();
    });
  });

  describe('Storage integration', () => {
    it('should handle missing localStorage gracefully', () => {
      // Clear storage and try to get data
      localStorage.removeItem('session_preserved_data');

      const result = service.getPreservedData('nonexistent');
      expect(result).toBeNull();
    });

    it('should handle corrupted localStorage data gracefully', () => {
      // Set invalid JSON
      localStorage.setItem('session_preserved_data', 'invalid-json');

      // Should not throw
      expect(() => service.getPreservedData('test')).not.toThrow();
    });

    it('should handle empty preserved data', () => {
      localStorage.setItem('session_preserved_data', '{}');

      const result = service.getPreservedData('any');
      expect(result).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid session extensions', () => {
      service.startSession();

      // Multiple rapid extensions should not cause issues
      for (let i = 0; i < 5; i++) {
        service.extendSession();
      }

      expect(service.state().isAuthenticated).toBeTrue();
      expect(service.showWarning()).toBeFalse();
    });

    it('should handle session end during active state', () => {
      service.startSession();
      expect(service.state().isAuthenticated).toBeTrue();

      service.endSession(true);

      expect(service.state().isAuthenticated).toBeFalse();
    });
  });
});
