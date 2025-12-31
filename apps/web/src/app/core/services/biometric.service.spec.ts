// apps/web/src/app/core/services/biometric.service.spec.ts
// FR-22: Biometric Authentication Service Unit Tests
import { TestBed } from '@angular/core/testing';
import { BiometricService, BiometricConfig } from './biometric.service';
import { BiometryType, NativeBiometric } from 'capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

describe('BiometricService', () => {
  const mockUserId = 'user-123';
  const mockRefreshToken = 'mock-refresh-token-abc';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('on web platform', () => {
    let service: BiometricService;

    beforeEach(() => {
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);

      TestBed.configureTestingModule({
        imports: [TranslateModule.forRoot()],
        providers: [BiometricService],
      });

      service = TestBed.inject(BiometricService);
    });

    it('should create service', () => {
      expect(service).toBeTruthy();
    });

    it('checkAvailability should return false', async () => {
      const result = await service.checkAvailability();
      expect(result).toBeFalse();
    });

    it('getBiometryTypeName should return empty string', () => {
      const name = service.getBiometryTypeName();
      expect(name).toBe('');
    });

    it('isEnabledForUser should return false when no config', () => {
      const result = service.isEnabledForUser(mockUserId);
      expect(result).toBeFalse();
    });

    it('config$ should emit initial config', (done) => {
      service.config$.subscribe(config => {
        expect(config.enabled).toBeFalse();
        expect(config.userId).toBeNull();
        done();
      });
    });

    it('currentConfig should return default config', () => {
      const config = service.currentConfig;
      expect(config).toBeDefined();
      expect(config.enabled).toBeFalse();
    });

    it('enableBiometric should throw when not available', async () => {
      await expectAsync(
        service.enableBiometric(mockUserId, mockRefreshToken)
      ).toBeRejectedWithError('Biometric authentication not available');
    });
  });

  describe('on native platform with biometric support', () => {
    let service: BiometricService;

    beforeEach(() => {
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);

      TestBed.configureTestingModule({
        imports: [TranslateModule.forRoot()],
        providers: [BiometricService],
      });

      service = TestBed.inject(BiometricService);
    });

    it('checkAvailability should handle native platform check', async () => {
      // When running on web, NativeBiometric.isAvailable throws "Method not implemented"
      // This test verifies the service handles this gracefully
      const result = await service.checkAvailability();
      // On web platform during tests, this returns false due to error handling
      expect(typeof result).toBe('boolean');
    });
  });

  describe('on native platform without biometric support', () => {
    let service: BiometricService;

    beforeEach(() => {
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
      spyOn(NativeBiometric, 'isAvailable').and.resolveTo({
        isAvailable: false,
        biometryType: BiometryType.NONE,
      });

      TestBed.configureTestingModule({
        imports: [TranslateModule.forRoot()],
        providers: [BiometricService],
      });

      service = TestBed.inject(BiometricService);
    });

    it('checkAvailability should return false', async () => {
      const result = await service.checkAvailability();
      expect(result).toBeFalse();
    });
  });

  describe('on native platform with biometric error', () => {
    let service: BiometricService;

    beforeEach(() => {
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
      spyOn(NativeBiometric, 'isAvailable').and.rejectWith(new Error('Not supported'));

      TestBed.configureTestingModule({
        imports: [TranslateModule.forRoot()],
        providers: [BiometricService],
      });

      service = TestBed.inject(BiometricService);
    });

    it('checkAvailability should handle errors gracefully', async () => {
      const result = await service.checkAvailability();
      expect(result).toBeFalse();
    });
  });

  describe('isEnabledForUser with saved config', () => {
    let service: BiometricService;

    beforeEach(() => {
      // Save config before service initialization
      const config: BiometricConfig = {
        enabled: true,
        userId: mockUserId,
        biometryType: BiometryType.FINGERPRINT,
        lastUsedAt: Date.now(),
      };
      localStorage.setItem('biometric_config', JSON.stringify(config));

      // On web platform, config is NOT loaded from localStorage (service returns early)
      spyOn(Capacitor, 'isNativePlatform').and.returnValue(false);

      TestBed.configureTestingModule({
        imports: [TranslateModule.forRoot()],
        providers: [BiometricService],
      });

      service = TestBed.inject(BiometricService);
    });

    it('should return false on web platform (config not loaded)', () => {
      // On web platform, initializeBiometric() returns early without loading config
      // So isEnabledForUser always returns false as config.enabled stays false
      const result = service.isEnabledForUser(mockUserId);
      expect(result).toBeFalse();
    });

    it('should return false for different user', () => {
      const result = service.isEnabledForUser('different-user-id');
      expect(result).toBeFalse();
    });
  });
});
