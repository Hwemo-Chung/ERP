/**
 * Barcode Scanner Service
 * PRD FR-04: Serial number capture via barcode scanning
 * 
 * Uses manual input on web platform (native scanner requires plugin installation)
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

  /**
   * Check if barcode scanner is available
   * Note: Native scanning requires @capacitor-mlkit/barcode-scanning plugin
   */
  async isAvailable(): Promise<boolean> {
    // Currently using manual input fallback for all platforms
    // To enable native scanning, install @capacitor-mlkit/barcode-scanning
    return false;
  }

  /**
   * Check if running on native platform (Android/iOS)
   */
  private isNativePlatform(): boolean {
    return this.platform.is('capacitor') || this.platform.is('cordova');
  }

  /**
   * Request camera permission for scanning
   */
  async requestPermission(): Promise<boolean> {
    // Manual input doesn't require permission
    return true;
  }

  /**
   * Start barcode scanning
   * Currently falls back to manual input on all platforms
   */
  async scan(): Promise<ScanResult> {
    // Show manual input dialog
    return this.showManualInputDialog();
  }

  /**
   * Stop scanning
   */
  async stopScan(): Promise<void> {
    this._isScanning.set(false);
  }

  /**
   * Show manual input dialog
   */
  private async showManualInputDialog(): Promise<ScanResult> {
    return new Promise<ScanResult>(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: '시리얼 번호 입력',
        message: this.isNativePlatform() 
          ? '시리얼 번호를 입력하세요.'
          : '바코드 스캐너는 모바일 앱에서 사용 가능합니다.\n직접 입력해 주세요.',
        inputs: [
          {
            name: 'serial',
            type: 'text',
            placeholder: '시리얼 번호 (10-20자)',
            attributes: {
              maxlength: 20,
              minlength: 10,
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
              const serial = data.serial?.trim() || '';
              resolve({
                hasContent: serial.length > 0,
                content: serial,
              });
            },
          },
        ],
      });

      await alert.present();
    });
  }
}
