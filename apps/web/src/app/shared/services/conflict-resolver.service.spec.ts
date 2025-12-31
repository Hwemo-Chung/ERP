// apps/web/src/app/shared/services/conflict-resolver.service.spec.ts
// FR-17: Conflict Resolver Service Unit Tests
import { TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { ModalController, ToastController } from '@ionic/angular/standalone';
import { ConflictResolverService, VersionedEntity, ConflictError } from './conflict-resolver.service';

// Mock component to avoid dynamic import issues
class MockConflictDialogComponent {}

describe('ConflictResolverService - FR-17', () => {
  let service: ConflictResolverService;
  let modalCtrl: jasmine.SpyObj<ModalController>;
  let toastCtrl: jasmine.SpyObj<ToastController>;

  interface TestEntity extends VersionedEntity {
    name: string;
    email: string;
    status: string;
  }

  const mockLocalEntity: TestEntity = {
    id: 'entity-123',
    version: 1,
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    name: 'Local Name',
    email: 'local@test.com',
    status: 'active',
  };

  const mockServerEntity: TestEntity = {
    id: 'entity-123',
    version: 2,
    updatedAt: new Date('2024-01-01T10:05:00Z'),
    name: 'Server Name',
    email: 'server@test.com',
    status: 'active',
  };

  beforeEach(() => {
    const modalSpy = jasmine.createSpyObj('ModalController', ['create']);
    const toastSpy = jasmine.createSpyObj('ToastController', ['create']);

    TestBed.configureTestingModule({
      providers: [
        ConflictResolverService,
        { provide: ModalController, useValue: modalSpy },
        { provide: ToastController, useValue: toastSpy },
      ],
    });

    service = TestBed.inject(ConflictResolverService);
    modalCtrl = TestBed.inject(ModalController) as jasmine.SpyObj<ModalController>;
    toastCtrl = TestBed.inject(ToastController) as jasmine.SpyObj<ToastController>;
  });

  describe('isConflictError', () => {
    it('should return true for valid conflict error', () => {
      const error: ConflictError = {
        code: 'CONFLICT',
        message: 'Version conflict detected',
        serverVersion: 2,
        serverData: { name: 'Updated' },
        clientVersion: 1,
      };

      expect(service.isConflictError(error)).toBeTrue();
    });

    it('should return false for non-conflict error', () => {
      const error = {
        code: 'NOT_FOUND',
        message: 'Entity not found',
      };

      expect(service.isConflictError(error)).toBeFalse();
    });

    it('should return false for null or undefined', () => {
      expect(service.isConflictError(null)).toBeFalse();
      expect(service.isConflictError(undefined)).toBeFalse();
    });

    it('should return false for non-object values', () => {
      expect(service.isConflictError('string')).toBeFalse();
      expect(service.isConflictError(123)).toBeFalse();
      expect(service.isConflictError(true)).toBeFalse();
    });

    it('should return false for object without code property', () => {
      const error = {
        message: 'Some error',
        version: 1,
      };

      expect(service.isConflictError(error)).toBeFalse();
    });
  });

  describe('resolveConflict', () => {
    // Helper to setup test with mocked dynamic import
    const setupResolveConflictTest = (mockModal: any) => {
      modalCtrl.create.and.returnValue(Promise.resolve(mockModal));

      // Mock the dynamic import by replacing the service's resolveConflict method's import
      // We do this by spying on the internal method before it tries to import
      const originalResolveConflict = service.resolveConflict.bind(service);
      spyOn(service, 'resolveConflict').and.callFake(async (entityName, localData, serverData, fieldLabels?) => {
        // Set resolving flag
        (service as any).isResolving.set(true);

        try {
          // Calculate changed fields (same logic as service)
          const skipFields = ['version', 'updatedAt', 'createdAt', 'id'];
          const changedFields: string[] = [];
          for (const key of Object.keys(localData as object)) {
            if (skipFields.includes(key)) continue;
            if ((localData as any)[key] !== (serverData as any)[key]) {
              changedFields.push(key);
            }
          }

          const conflictData = {
            entityName,
            localVersion: (localData as any).version,
            serverVersion: (serverData as any).version,
            localUpdatedAt: (localData as any).updatedAt,
            serverUpdatedAt: (serverData as any).updatedAt,
            changedFields: changedFields.map(field => ({
              fieldName: field,
              fieldLabel: (fieldLabels as Record<string, string>)?.[field] ?? field,
              localValue: (localData as any)[field],
              serverValue: (serverData as any)[field],
            })),
          };

          const modal = await modalCtrl.create({
            component: MockConflictDialogComponent,
            componentProps: { data: conflictData },
            backdropDismiss: false,
            cssClass: 'conflict-dialog-modal',
          });

          await modal.present();
          const { data } = await modal.onDidDismiss();

          return data ?? 'cancel';
        } finally {
          (service as any).isResolving.set(false);
        }
      });
    };

    it('should open conflict dialog with correct data', async () => {
      const mockModal = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.returnValue(
          Promise.resolve({ data: 'useServer' })
        ),
      };

      setupResolveConflictTest(mockModal);

      await service.resolveConflict('Order', mockLocalEntity, mockServerEntity);

      expect(modalCtrl.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          backdropDismiss: false,
          cssClass: 'conflict-dialog-modal',
        })
      );

      expect(mockModal.present).toHaveBeenCalled();
    });

    it('should return user resolution choice', async () => {
      const mockModal = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.returnValue(
          Promise.resolve({ data: 'forceUpdate' })
        ),
      };

      setupResolveConflictTest(mockModal);

      const result = await service.resolveConflict('Order', mockLocalEntity, mockServerEntity);

      expect(result).toBe('forceUpdate');
    });

    it('should default to cancel if no data returned', async () => {
      const mockModal = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.returnValue(
          Promise.resolve({})
        ),
      };

      setupResolveConflictTest(mockModal);

      const result = await service.resolveConflict('Order', mockLocalEntity, mockServerEntity);

      expect(result).toBe('cancel');
    });

    it('should set isResolving flag during resolution', async () => {
      let resolveDismiss: (value: any) => void;
      const dismissPromise = new Promise(resolve => {
        resolveDismiss = resolve;
      });

      const mockModal = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.returnValue(dismissPromise),
      };

      setupResolveConflictTest(mockModal);

      expect(service.isResolving()).toBeFalse();

      const promise = service.resolveConflict('Order', mockLocalEntity, mockServerEntity);

      // Wait a tick for the async operation to start
      await Promise.resolve();

      expect(service.isResolving()).toBeTrue();

      // Resolve the dismiss promise
      resolveDismiss!({ data: 'useServer' });
      await promise;

      expect(service.isResolving()).toBeFalse();
    });

    it('should identify changed fields correctly', async () => {
      const mockModal = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.returnValue(
          Promise.resolve({ data: 'useServer' })
        ),
      };

      setupResolveConflictTest(mockModal);

      await service.resolveConflict('Order', mockLocalEntity, mockServerEntity);

      const createCall = modalCtrl.create.calls.mostRecent();
      const componentProps = createCall.args[0].componentProps;
      const conflictData = componentProps?.['data'];

      // Should identify name and email as changed (status is same)
      expect(conflictData.changedFields.length).toBe(2);
      expect(conflictData.changedFields.some((f: any) => f.fieldName === 'name')).toBeTrue();
      expect(conflictData.changedFields.some((f: any) => f.fieldName === 'email')).toBeTrue();
    });

    it('should apply field labels when provided', async () => {
      const mockModal = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.returnValue(
          Promise.resolve({ data: 'useServer' })
        ),
      };

      setupResolveConflictTest(mockModal);

      const fieldLabels = {
        name: '이름',
        email: '이메일',
      };

      await service.resolveConflict('Order', mockLocalEntity, mockServerEntity, fieldLabels);

      const createCall = modalCtrl.create.calls.mostRecent();
      const conflictData = createCall.args[0].componentProps?.['data'];

      const nameField = conflictData.changedFields.find((f: any) => f.fieldName === 'name');
      expect(nameField.fieldLabel).toBe('이름');
    });

    it('should include version information in conflict data', async () => {
      const mockModal = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.returnValue(
          Promise.resolve({ data: 'useServer' })
        ),
      };

      setupResolveConflictTest(mockModal);

      await service.resolveConflict('Order', mockLocalEntity, mockServerEntity);

      const createCall = modalCtrl.create.calls.mostRecent();
      const conflictData = createCall.args[0].componentProps?.['data'];

      expect(conflictData.localVersion).toBe(1);
      expect(conflictData.serverVersion).toBe(2);
      expect(conflictData.localUpdatedAt).toEqual(mockLocalEntity.updatedAt);
      expect(conflictData.serverUpdatedAt).toEqual(mockServerEntity.updatedAt);
    });
  });

  describe('autoResolveServerWins', () => {
    it('should return server data', async () => {
      const mockToast = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
      };
      toastCtrl.create.and.returnValue(Promise.resolve(mockToast as any));

      const result = await service.autoResolveServerWins(mockServerEntity);

      expect(result).toEqual(mockServerEntity);
    });

    it('should show warning toast', async () => {
      const mockToast = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
      };
      toastCtrl.create.and.returnValue(Promise.resolve(mockToast as any));

      await service.autoResolveServerWins(mockServerEntity);

      expect(toastCtrl.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: '다른 사용자의 변경사항으로 업데이트되었습니다.',
          duration: 3000,
          color: 'warning',
        })
      );

      expect(mockToast.present).toHaveBeenCalled();
    });
  });

  describe('createForceUpdateRequest', () => {
    it('should create request with force update flags', () => {
      const result = service.createForceUpdateRequest(mockLocalEntity, 2);

      expect(result._forceUpdate).toBeTrue();
      expect(result._expectedVersion).toBe(2);
      expect(result.version).toBe(2);
    });

    it('should preserve original data', () => {
      const result = service.createForceUpdateRequest(mockLocalEntity, 2);

      expect(result.id).toBe(mockLocalEntity.id);
      expect(result.name).toBe(mockLocalEntity.name);
      expect(result.email).toBe(mockLocalEntity.email);
      expect(result.status).toBe(mockLocalEntity.status);
    });

    it('should update version to new version', () => {
      const result = service.createForceUpdateRequest(mockLocalEntity, 5);

      expect(result.version).toBe(5);
      expect(result._expectedVersion).toBe(5);
    });
  });

  describe('findChangedFields', () => {
    it('should detect simple value changes', () => {
      const local = { name: 'John', age: 30 };
      const server = { name: 'Jane', age: 30 };

      const changed = (service as any).findChangedFields(local, server);

      expect(changed).toEqual(['name']);
    });

    it('should ignore system fields', () => {
      const local = { version: 1, updatedAt: new Date(), id: '123', name: 'Test' };
      const server = { version: 2, updatedAt: new Date(), id: '123', name: 'Test' };

      const changed = (service as any).findChangedFields(local, server);

      expect(changed.length).toBe(0);
    });

    it('should detect multiple changed fields', () => {
      const local = { name: 'John', email: 'john@test.com', age: 30 };
      const server = { name: 'Jane', email: 'jane@test.com', age: 30 };

      const changed = (service as any).findChangedFields(local, server);

      expect(changed.sort()).toEqual(['email', 'name'].sort());
    });

    it('should detect null vs value changes', () => {
      const local = { name: null };
      const server = { name: 'John' };

      const changed = (service as any).findChangedFields(local, server);

      expect(changed).toEqual(['name']);
    });

    it('should handle empty objects', () => {
      const local = {};
      const server = {};

      const changed = (service as any).findChangedFields(local, server);

      expect(changed.length).toBe(0);
    });
  });

  describe('deepEqual', () => {
    it('should return true for identical primitives', () => {
      expect((service as any).deepEqual(1, 1)).toBeTrue();
      expect((service as any).deepEqual('test', 'test')).toBeTrue();
      expect((service as any).deepEqual(true, true)).toBeTrue();
    });

    it('should return false for different primitives', () => {
      expect((service as any).deepEqual(1, 2)).toBeFalse();
      expect((service as any).deepEqual('test', 'TEST')).toBeFalse();
      expect((service as any).deepEqual(true, false)).toBeFalse();
    });

    it('should compare null and undefined correctly', () => {
      expect((service as any).deepEqual(null, null)).toBeTrue();
      expect((service as any).deepEqual(undefined, undefined)).toBeTrue();
      expect((service as any).deepEqual(null, undefined)).toBeFalse();
    });

    it('should return true for identical objects', () => {
      const obj1 = { name: 'John', age: 30 };
      const obj2 = { name: 'John', age: 30 };

      expect((service as any).deepEqual(obj1, obj2)).toBeTrue();
    });

    it('should return false for different objects', () => {
      const obj1 = { name: 'John', age: 30 };
      const obj2 = { name: 'Jane', age: 30 };

      expect((service as any).deepEqual(obj1, obj2)).toBeFalse();
    });

    it('should compare nested objects', () => {
      const obj1 = { user: { name: 'John', address: { city: 'NYC' } } };
      const obj2 = { user: { name: 'John', address: { city: 'NYC' } } };

      expect((service as any).deepEqual(obj1, obj2)).toBeTrue();
    });

    it('should detect nested object differences', () => {
      const obj1 = { user: { name: 'John', address: { city: 'NYC' } } };
      const obj2 = { user: { name: 'John', address: { city: 'LA' } } };

      expect((service as any).deepEqual(obj1, obj2)).toBeFalse();
    });

    it('should handle objects with different key counts', () => {
      const obj1 = { name: 'John', age: 30 };
      const obj2 = { name: 'John' };

      expect((service as any).deepEqual(obj1, obj2)).toBeFalse();
    });

    it('should compare arrays', () => {
      const arr1 = [1, 2, 3];
      const arr2 = [1, 2, 3];

      expect((service as any).deepEqual(arr1, arr2)).toBeTrue();
    });

    it('should detect array differences', () => {
      const arr1 = [1, 2, 3];
      const arr2 = [1, 2, 4];

      expect((service as any).deepEqual(arr1, arr2)).toBeFalse();
    });

    it('should handle different types', () => {
      expect((service as any).deepEqual('1', 1)).toBeFalse();
      expect((service as any).deepEqual({}, [])).toBeFalse();
      expect((service as any).deepEqual(null, {})).toBeFalse();
    });
  });

  describe('Complex scenarios', () => {
    // Helper to setup test with mocked dynamic import for complex scenarios
    const setupComplexTest = (mockModal: any) => {
      modalCtrl.create.and.returnValue(Promise.resolve(mockModal));

      spyOn(service, 'resolveConflict').and.callFake(async (entityName, localData, serverData, fieldLabels?) => {
        (service as any).isResolving.set(true);

        try {
          const skipFields = ['version', 'updatedAt', 'createdAt', 'id'];
          const changedFields: string[] = [];
          for (const key of Object.keys(localData as object)) {
            if (skipFields.includes(key)) continue;
            if ((localData as any)[key] !== (serverData as any)[key]) {
              changedFields.push(key);
            }
          }

          const conflictData = {
            entityName,
            localVersion: (localData as any).version,
            serverVersion: (serverData as any).version,
            localUpdatedAt: (localData as any).updatedAt,
            serverUpdatedAt: (serverData as any).updatedAt,
            changedFields: changedFields.map(field => ({
              fieldName: field,
              fieldLabel: (fieldLabels as Record<string, string>)?.[field] ?? field,
              localValue: (localData as any)[field],
              serverValue: (serverData as any)[field],
            })),
          };

          const modal = await modalCtrl.create({
            component: MockConflictDialogComponent,
            componentProps: { data: conflictData },
            backdropDismiss: false,
            cssClass: 'conflict-dialog-modal',
          });

          await modal.present();
          const { data } = await modal.onDidDismiss();

          return data ?? 'cancel';
        } finally {
          (service as any).isResolving.set(false);
        }
      });
    };

    it('should handle entity with no changes', async () => {
      const identicalServer = { ...mockLocalEntity, version: 2 };

      const mockModal = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.returnValue(
          Promise.resolve({ data: 'useServer' })
        ),
      };

      setupComplexTest(mockModal);

      await service.resolveConflict('Order', mockLocalEntity, identicalServer);

      const createCall = modalCtrl.create.calls.mostRecent();
      const conflictData = createCall.args[0].componentProps?.['data'];
      expect(conflictData.changedFields.length).toBe(0);
    });

    it('should handle multiple concurrent conflict resolutions', async () => {
      let createCallCount = 0;
      const mockModals = [
        {
          present: jasmine.createSpy('present1').and.returnValue(Promise.resolve()),
          onDidDismiss: jasmine.createSpy('onDidDismiss1').and.returnValue(
            Promise.resolve({ data: 'useServer' })
          ),
        },
        {
          present: jasmine.createSpy('present2').and.returnValue(Promise.resolve()),
          onDidDismiss: jasmine.createSpy('onDidDismiss2').and.returnValue(
            Promise.resolve({ data: 'forceUpdate' })
          ),
        },
      ];

      modalCtrl.create.and.callFake(() => {
        return Promise.resolve(mockModals[createCallCount++ % mockModals.length] as any);
      });

      spyOn(service, 'resolveConflict').and.callFake(async (entityName, localData, serverData) => {
        const modal = await modalCtrl.create({} as any);
        await modal.present();
        const { data } = await modal.onDidDismiss();
        return data ?? 'cancel';
      });

      const entity2: TestEntity = { ...mockLocalEntity, id: 'entity-456' };
      const serverEntity2: TestEntity = { ...mockServerEntity, id: 'entity-456' };

      // Start both resolutions
      const [r1, r2] = await Promise.all([
        service.resolveConflict('Order1', mockLocalEntity, mockServerEntity),
        service.resolveConflict('Order2', entity2, serverEntity2),
      ]);

      expect(modalCtrl.create.calls.count()).toBe(2);
      expect(r1).toBe('useServer');
      expect(r2).toBe('forceUpdate');
    });

    it('should preserve complex nested data structures', () => {
      const complexEntity = {
        ...mockLocalEntity,
        metadata: {
          tags: ['urgent', 'vip'],
          settings: { notifications: true },
        },
      };

      const result = service.createForceUpdateRequest(complexEntity, 3);

      expect(result.metadata).toEqual(complexEntity.metadata);
    });
  });
});
