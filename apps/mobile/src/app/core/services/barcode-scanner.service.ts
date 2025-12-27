/**
 * Barcode Scanner Service for Mobile
 * PRD FR-04: Serial number capture via barcode scanning
 *
 * Uses Capacitor MLKit Barcode Scanning on native platforms
 * Falls back to manual input when not available
 */
import { Injectable, inject, signal } from '@angular/core';
import { Platform, AlertController } from '@ionic/angular/standalone';

export interface ScanResult {
  hasContent: boolean;
  content: string;
  format?: string;
}

@Injectable({ providedIn: 'root' })
export class BarcodeScannerService {
  private readonly platform = inject(Platform);
  private readonly alertCtrl = inject(AlertController);

  private readonly _isScanning = signal(false);
  readonly isScanning = this._isScanning.asReadonly();

  private readonly _lastResult = signal<ScanResult | null>(null);
  readonly lastResult = this._lastResult.asReadonly();

  /**
   * Check if running on native platform (Android/iOS)
   */
  isNativePlatform(): boolean {
    return this.platform.is('capacitor') || this.platform.is('cordova');
  }

  /**
   * Check if barcode scanner is available
   * Note: Native barcode scanning requires Capacitor MLKit plugin
   * Currently using manual input fallback for all platforms
   */
  async isAvailable(): Promise<boolean> {
    // Always return false to use manual input fallback
    // Native scanning can be enabled by installing @capacitor-mlkit/barcode-scanning
    return false;
  }

  /**
   * Request camera permission for scanning
   * Manual input doesn't require permission
   */
  async requestPermission(): Promise<boolean> {
    return true;
  }

  /**
   * Start barcode scanning
   * Currently uses manual input fallback on all platforms
   */
  async scan(): Promise<ScanResult> {
    if (this._isScanning()) {
      return { hasContent: false, content: '' };
    }

    return this.showManualInputDialog();
  }

  /**
   * Stop scanning
   */
  async stopScan(): Promise<void> {
    this._isScanning.set(false);
  }

  /**
   * Show manual input dialog as fallback
   */
  async showManualInputDialog(): Promise<ScanResult> {
    return new Promise<ScanResult>(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: '시리얼 번호 입력',
        message: this.isNativePlatform()
          ? '시리얼 번호를 직접 입력하세요.'
          : '바코드 스캐너는 모바일 앱에서 사용 가능합니다.\n직접 입력해 주세요.',
        inputs: [
          {
            name: 'serial',
            type: 'text',
            placeholder: '시리얼 번호 (10-20자)',
            attributes: {
              maxlength: 20,
              minlength: 10,
              autocapitalize: 'characters',
            },
          },
        ],
        buttons: [
          {
            text: '취소',
            role: 'cancel',
            handler: () => resolve({ hasContent: false, content: '' }),
          },
          {
            text: '확인',
            handler: (data) => {
              const serial = data.serial?.trim().toUpperCase() || '';
              const result: ScanResult = {
                hasContent: serial.length > 0,
                content: serial,
              };
              this._lastResult.set(result);
              resolve(result);
            },
          },
        ],
      });

      await alert.present();
    });
  }
}
