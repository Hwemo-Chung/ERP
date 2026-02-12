/**
 * Camera Service for Mobile
 * PRD FR-20: Photo capture for installation completion
 *
 * Uses Capacitor Camera plugin on native platforms
 * Falls back to file input on web
 */
import { Injectable, inject, signal } from '@angular/core';
import { Platform, ActionSheetController } from '@ionic/angular/standalone';
import { LoggerService } from './logger.service';

export interface PhotoResult {
  success: boolean;
  dataUrl?: string;
  webPath?: string;
  format?: string;
  error?: string;
}

export interface PhotoOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  allowEditing?: boolean;
}

const DEFAULT_OPTIONS: PhotoOptions = {
  quality: 80,
  maxWidth: 1920,
  maxHeight: 1920,
  allowEditing: false,
};

@Injectable({ providedIn: 'root' })
export class CameraService {
  private readonly platform = inject(Platform);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly logger = inject(LoggerService);

  private readonly _isCapturing = signal(false);
  readonly isCapturing = this._isCapturing.asReadonly();

  private readonly _photos = signal<string[]>([]);
  readonly photos = this._photos.asReadonly();

  /**
   * Check if running on native platform (Android/iOS)
   */
  isNativePlatform(): boolean {
    return this.platform.is('capacitor') || this.platform.is('cordova');
  }

  /**
   * Check if camera is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.isNativePlatform()) {
      // Web can use file input as fallback
      return true;
    }

    try {
      const { Camera } = await import('@capacitor/camera');
      return !!Camera;
    } catch {
      return true; // Fall back to file input
    }
  }

  /**
   * Request camera permission
   */
  async requestPermission(): Promise<boolean> {
    if (!this.isNativePlatform()) {
      return true;
    }

    try {
      const { Camera } = await import('@capacitor/camera');
      const status = await Camera.checkPermissions();

      if (status.camera === 'granted' && status.photos === 'granted') {
        return true;
      }

      const result = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
      return result.camera === 'granted';
    } catch {
      return true; // Fall back to file input
    }
  }

  /**
   * Take a photo or select from gallery
   */
  async takePhoto(options: PhotoOptions = {}): Promise<PhotoResult> {
    const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

    if (this._isCapturing()) {
      return { success: false, error: 'Already capturing' };
    }

    // Show action sheet to choose source
    const source = await this.showSourceSelector();
    if (!source) {
      return { success: false, error: 'Cancelled' };
    }

    if (this.isNativePlatform()) {
      return this.captureWithNative(source, mergedOptions);
    }

    return this.captureWithFileInput(source);
  }

  /**
   * Show source selector action sheet
   */
  private async showSourceSelector(): Promise<'camera' | 'gallery' | null> {
    return new Promise(async (resolve) => {
      const actionSheet = await this.actionSheetCtrl.create({
        header: '사진 선택',
        buttons: [
          {
            text: '카메라로 촬영',
            icon: 'camera-outline',
            handler: () => resolve('camera'),
          },
          {
            text: '갤러리에서 선택',
            icon: 'images-outline',
            handler: () => resolve('gallery'),
          },
          {
            text: '취소',
            role: 'cancel',
            handler: () => resolve(null),
          },
        ],
      });

      await actionSheet.present();
    });
  }

  /**
   * Capture using native camera
   */
  private async captureWithNative(
    source: 'camera' | 'gallery',
    options: PhotoOptions,
  ): Promise<PhotoResult> {
    this._isCapturing.set(true);

    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        this._isCapturing.set(false);
        return this.captureWithFileInput(source);
      }

      const image = await Camera.getPhoto({
        quality: options.quality,
        width: options.maxWidth,
        height: options.maxHeight,
        allowEditing: options.allowEditing,
        resultType: CameraResultType.DataUrl,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        saveToGallery: false,
      });

      this._isCapturing.set(false);

      if (image.dataUrl) {
        // Add to photos array
        this._photos.update((photos) => [...photos, image.dataUrl!]);

        return {
          success: true,
          dataUrl: image.dataUrl,
          webPath: image.webPath,
          format: image.format,
        };
      }

      return { success: false, error: 'No image data' };
    } catch (error) {
      this._isCapturing.set(false);
      this.logger.error('Camera capture error:', error);

      // Fall back to file input on error
      return this.captureWithFileInput(source);
    }
  }

  /**
   * Capture using file input (web fallback)
   */
  private async captureWithFileInput(source: 'camera' | 'gallery'): Promise<PhotoResult> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      // Enable camera capture on mobile browsers
      if (source === 'camera') {
        input.setAttribute('capture', 'environment');
      }

      input.onchange = async (event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];

        if (!file) {
          resolve({ success: false, error: 'No file selected' });
          return;
        }

        try {
          const dataUrl = await this.fileToDataUrl(file);

          // Add to photos array
          this._photos.update((photos) => [...photos, dataUrl]);

          resolve({
            success: true,
            dataUrl,
            format: file.type.split('/')[1],
          });
        } catch (error) {
          resolve({ success: false, error: 'Failed to read file' });
        }
      };

      input.oncancel = () => {
        resolve({ success: false, error: 'Cancelled' });
      };

      input.click();
    });
  }

  /**
   * Convert file to data URL
   */
  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Remove a photo by index
   */
  removePhoto(index: number): void {
    this._photos.update((photos) => photos.filter((_, i) => i !== index));
  }

  /**
   * Clear all photos
   */
  clearPhotos(): void {
    this._photos.set([]);
  }

  /**
   * Get photo count
   */
  getPhotoCount(): number {
    return this._photos().length;
  }

  /**
   * Initialize with existing photos
   */
  setPhotos(photos: string[]): void {
    this._photos.set([...photos]);
  }
}
