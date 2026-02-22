import { Injectable, inject, signal } from '@angular/core';
import { Platform, AlertController } from '@ionic/angular/standalone';
import { TRANSLATE_SERVICE_TOKEN } from '../tokens/translate.token';

export interface ScanResult {
  hasContent: boolean;
  content: string;
  format?: string;
}

@Injectable({ providedIn: 'root' })
export class BarcodeScannerService {
  private readonly platform = inject(Platform);
  private readonly alertCtrl = inject(AlertController);
  private readonly translateService = inject(TRANSLATE_SERVICE_TOKEN, { optional: true });

  private readonly _isScanning = signal(false);
  readonly isScanning = this._isScanning.asReadonly();

  private readonly _lastResult = signal<ScanResult | null>(null);
  readonly lastResult = this._lastResult.asReadonly();

  private t(key: string): string {
    if (this.translateService) {
      return this.translateService.instant(key);
    }
    const fallbacks: Record<string, string> = {
      'BARCODE.INPUT_HEADER': '시리얼 번호 입력',
      'BARCODE.INPUT_MESSAGE_NATIVE': '시리얼 번호를 직접 입력하세요.',
      'BARCODE.INPUT_MESSAGE_WEB':
        '바코드 스캐너는 모바일 앱에서 사용 가능합니다.\n직접 입력해 주세요.',
      'BARCODE.PLACEHOLDER': '시리얼 번호 (10-20자)',
      'COMMON.CANCEL': '취소',
      'COMMON.OK': '확인',
    };
    return fallbacks[key] ?? key;
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }

  isNativePlatform(): boolean {
    return this.platform.is('capacitor') || this.platform.is('cordova');
  }

  async requestPermission(): Promise<boolean> {
    return true;
  }

  async scan(): Promise<ScanResult> {
    if (this._isScanning()) {
      return { hasContent: false, content: '' };
    }
    return this.showManualInputDialog();
  }

  async stopScan(): Promise<void> {
    this._isScanning.set(false);
  }

  async showManualInputDialog(): Promise<ScanResult> {
    return new Promise<ScanResult>(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: this.t('BARCODE.INPUT_HEADER'),
        message: this.isNativePlatform()
          ? this.t('BARCODE.INPUT_MESSAGE_NATIVE')
          : this.t('BARCODE.INPUT_MESSAGE_WEB'),
        inputs: [
          {
            name: 'serial',
            type: 'text',
            placeholder: this.t('BARCODE.PLACEHOLDER'),
            attributes: {
              maxlength: 20,
              minlength: 10,
              autocapitalize: 'characters',
            },
          },
        ],
        buttons: [
          {
            text: this.t('COMMON.CANCEL'),
            role: 'cancel',
            handler: () => resolve({ hasContent: false, content: '' }),
          },
          {
            text: this.t('COMMON.OK'),
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
