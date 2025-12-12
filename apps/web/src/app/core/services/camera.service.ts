// apps/web/src/app/core/services/camera.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { AlertController, ActionSheetController } from '@ionic/angular/standalone';

export interface CapturedPhoto {
  dataUrl: string;
  format: string;
  webPath?: string;
  base64?: string;
}

@Injectable({
  providedIn: 'root',
})
export class CameraService {
  private readonly alertCtrl = inject(AlertController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  
  readonly isCapturing = signal(false);

  /**
   * Check if camera is available (native or web)
   */
  async isAvailable(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      return true;
    }
    // Web: Check for mediaDevices API
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Request camera permissions
   */
  async requestPermission(): Promise<boolean> {
    try {
      const permissions = await Camera.checkPermissions();
      
      if (permissions.camera === 'granted' && permissions.photos === 'granted') {
        return true;
      }

      const request = await Camera.requestPermissions({
        permissions: ['camera', 'photos'],
      });

      return request.camera === 'granted' || request.camera === 'limited';
    } catch (error) {
      console.error('Camera permission error:', error);
      return false;
    }
  }

  /**
   * Take a photo with camera or select from gallery
   * Shows action sheet to let user choose source
   */
  async capturePhoto(): Promise<CapturedPhoto | null> {
    const source = await this.selectSource();
    if (!source) return null;

    return this.takePhoto(source);
  }

  /**
   * Take a photo directly from camera
   */
  async takePhotoFromCamera(): Promise<CapturedPhoto | null> {
    return this.takePhoto(CameraSource.Camera);
  }

  /**
   * Select photo from gallery
   */
  async selectFromGallery(): Promise<CapturedPhoto | null> {
    return this.takePhoto(CameraSource.Photos);
  }

  /**
   * Take multiple photos
   */
  async captureMultiplePhotos(maxCount: number = 5): Promise<CapturedPhoto[]> {
    const photos: CapturedPhoto[] = [];
    
    for (let i = 0; i < maxCount; i++) {
      const photo = await this.capturePhoto();
      if (!photo) break;
      photos.push(photo);

      if (i < maxCount - 1) {
        const continueCapture = await this.askContinue(photos.length);
        if (!continueCapture) break;
      }
    }

    return photos;
  }

  private async selectSource(): Promise<CameraSource | null> {
    return new Promise(async (resolve) => {
      const sheet = await this.actionSheetCtrl.create({
        header: '사진 선택',
        buttons: [
          {
            text: '카메라',
            icon: 'camera-outline',
            data: CameraSource.Camera,
          },
          {
            text: '갤러리',
            icon: 'image-outline',
            data: CameraSource.Photos,
          },
          {
            text: '취소',
            role: 'cancel',
            data: null,
          },
        ],
      });
      await sheet.present();
      const { data, role } = await sheet.onDidDismiss();
      resolve(role === 'cancel' ? null : data);
    });
  }

  private async takePhoto(source: CameraSource): Promise<CapturedPhoto | null> {
    this.isCapturing.set(true);

    try {
      // Check for native platform
      if (!Capacitor.isNativePlatform()) {
        // Web fallback: use file input
        return await this.webFileInput(source === CameraSource.Camera);
      }

      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        await this.showPermissionError();
        return null;
      }

      const image: Photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: source,
        width: 1280,
        height: 1280,
        correctOrientation: true,
      });

      if (!image.dataUrl) {
        return null;
      }

      return {
        dataUrl: image.dataUrl,
        format: image.format,
        webPath: image.webPath,
        base64: image.base64String,
      };
    } catch (error: any) {
      if (error.message !== 'User cancelled photos app') {
        console.error('Camera capture error:', error);
        await this.showCaptureError();
      }
      return null;
    } finally {
      this.isCapturing.set(false);
    }
  }

  private async webFileInput(cameraOnly: boolean): Promise<CapturedPhoto | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (cameraOnly) {
        input.capture = 'environment';
      }

      input.onchange = async (event: Event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        
        if (!file) {
          resolve(null);
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve({
            dataUrl,
            format: file.type.split('/')[1] || 'jpeg',
            webPath: URL.createObjectURL(file),
          });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      };

      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  private async askContinue(currentCount: number): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header: '사진 추가',
        message: `${currentCount}장의 사진이 추가되었습니다. 더 추가하시겠습니까?`,
        buttons: [
          {
            text: '완료',
            role: 'cancel',
            handler: () => resolve(false),
          },
          {
            text: '추가',
            handler: () => resolve(true),
          },
        ],
      });
      await alert.present();
    });
  }

  private async showPermissionError(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '권한 필요',
      message: '카메라 및 갤러리 접근 권한이 필요합니다. 설정에서 권한을 허용해주세요.',
      buttons: ['확인'],
    });
    await alert.present();
  }

  private async showCaptureError(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '오류',
      message: '사진 촬영 중 오류가 발생했습니다.',
      buttons: ['확인'],
    });
    await alert.present();
  }
}
