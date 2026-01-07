/**
 * FR-20: File Attachment Component
 * PRD: 주문별 파일 첨부 - 사진 업로드 (5MB, 10개 제한)
 * 
 * 기능:
 * - 사진 업로드 (최대 5MB each, 10개 per order)
 * - 미리보기 표시
 * - 삭제/재정렬
 * - S3 업로드 연동
 */
import { Component, ChangeDetectionStrategy, inject, signal, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonIcon,
  IonSpinner,
  IonBadge,
  ActionSheetController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { 
  cameraOutline, 
  imageOutline, 
  trashOutline,
  addOutline,
  closeOutline,
  expandOutline,
} from 'ionicons/icons';

export interface FileAttachment {
  id: string;
  name?: string;
  fileName?: string;
  url?: string;
  size?: number;
  fileSize?: number;
  type?: string;
  uploadedAt?: Date;
  uploadProgress?: number;
  isImage?: boolean;
  thumbnailUrl?: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 10;

@Component({
  selector: 'app-file-attachment',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    IonIcon,
    IonSpinner,
    IonBadge,
  ],
  template: `
    <div class="file-attachment-container">
      <!-- 헤더 -->
      <div class="header">
        <span class="title">{{ 'FILE_ATTACHMENT.TITLE' | translate }}</span>
        <ion-badge [color]="attachments().length >= maxFiles ? 'danger' : 'primary'">
          {{ attachments().length }} / {{ maxFiles }}
        </ion-badge>
      </div>

      <!-- 파일 목록 -->
      <div class="file-grid">
        @for (file of attachments(); track file.id) {
          <div class="file-item">
            <!-- 이미지 미리보기 -->
            @if (isImage(file.type ?? '')) {
              <div class="preview-image" [style.background-image]="'url(' + file.url + ')'">
                @if (file.uploadProgress !== undefined && file.uploadProgress < 100) {
                  <div class="upload-overlay">
                    <ion-spinner name="crescent"></ion-spinner>
                    <span>{{ file.uploadProgress }}%</span>
                  </div>
                }
              </div>
            } @else {
              <div class="preview-file">
                <ion-icon name="document-outline"></ion-icon>
                <span class="file-name">{{ file.name }}</span>
              </div>
            }

            <!-- 액션 버튼 -->
            <div class="file-actions">
              <button class="action-btn" (click)="onPreview(file)">
                <ion-icon name="expand-outline"></ion-icon>
              </button>
              <button class="action-btn danger" (click)="onDelete(file)" [disabled]="isUploading()">
                <ion-icon name="trash-outline"></ion-icon>
              </button>
            </div>

            <!-- 파일 정보 -->
            <div class="file-info">
              <span class="file-size">{{ formatSize(file.size ?? 0) }}</span>
            </div>
          </div>
        }

        <!-- 추가 버튼 -->
        @if (attachments().length < maxFiles) {
          <div class="add-file" (click)="openFilePicker()">
            @if (isUploading()) {
              <ion-spinner name="crescent"></ion-spinner>
            } @else {
              <ion-icon name="add-outline"></ion-icon>
              <span>{{ 'FILE_ATTACHMENT.ADD_FILE' | translate }}</span>
            }
          </div>
        }
      </div>

      <!-- 안내 메시지 -->
      <p class="help-text">
        {{ 'FILE_ATTACHMENT.HELP_TEXT' | translate: { maxFiles: maxFiles, maxSize: formatSize(maxFileSize) } }}
      </p>

      <!-- Hidden file input -->
      <input 
        type="file" 
        #fileInput 
        hidden 
        multiple 
        accept="image/*,.pdf,.doc,.docx"
        (change)="onFileSelected($event)"
      />
    </div>
  `,
  styles: [`
    .file-attachment-container {
      padding: 16px;
      background: var(--ion-color-light);
      border-radius: 12px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .title {
      font-weight: 600;
      font-size: 16px;
    }

    .file-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 12px;
    }

    .file-item {
      position: relative;
      border-radius: 8px;
      overflow: hidden;
      background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .preview-image {
      width: 100%;
      aspect-ratio: 1;
      background-size: cover;
      background-position: center;
      position: relative;
    }

    .upload-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
    }

    .preview-file {
      width: 100%;
      aspect-ratio: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 8px;
    }

    .preview-file ion-icon {
      font-size: 32px;
      color: var(--ion-color-medium);
    }

    .preview-file .file-name {
      font-size: 11px;
      color: var(--ion-color-medium);
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 100%;
      margin-top: 4px;
    }

    .file-actions {
      position: absolute;
      top: 4px;
      right: 4px;
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .file-item:hover .file-actions {
      opacity: 1;
    }

    .action-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: none;
      background: rgba(0,0,0,0.6);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .action-btn.danger:hover {
      background: var(--ion-color-danger);
    }

    .file-info {
      padding: 6px 8px;
      background: var(--ion-color-light);
    }

    .file-size {
      font-size: 11px;
      color: var(--ion-color-medium);
    }

    .add-file {
      aspect-ratio: 1;
      border: 2px dashed var(--ion-color-medium);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    .add-file:hover {
      border-color: var(--ion-color-primary);
      background: rgba(var(--ion-color-primary-rgb), 0.05);
    }

    .add-file ion-icon {
      font-size: 24px;
      color: var(--ion-color-medium);
    }

    .add-file span {
      font-size: 12px;
      color: var(--ion-color-medium);
      margin-top: 4px;
    }

    .help-text {
      margin-top: 12px;
      font-size: 12px;
      color: var(--ion-color-medium);
      text-align: center;
    }
  `]
})
export class FileAttachmentComponent {
  private actionSheetCtrl = inject(ActionSheetController);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);

  // Inputs
  attachments = input<FileAttachment[]>([]);
  orderId = input<string>('');
  disabled = input<boolean>(false);

  // Outputs
  upload = output<File[]>();
  delete = output<string>();
  preview = output<FileAttachment>();

  // State
  isUploading = signal(false);

  // Constants
  readonly maxFileSize = MAX_FILE_SIZE;
  readonly maxFiles = MAX_FILES;

  constructor() {
    addIcons({ 
      cameraOutline, 
      imageOutline, 
      trashOutline,
      addOutline,
      closeOutline,
      expandOutline,
    });
  }

  isImage(type: string): boolean {
    return type.startsWith('image/');
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  async openFilePicker() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: this.translate.instant('FILE_ATTACHMENT.ADD_FILE'),
      buttons: [
        {
          text: this.translate.instant('FILE_ATTACHMENT.CAMERA'),
          icon: 'camera-outline',
          handler: () => this.openCamera(),
        },
        {
          text: this.translate.instant('FILE_ATTACHMENT.GALLERY'),
          icon: 'image-outline',
          handler: () => this.selectFromGallery(),
        },
        {
          text: this.translate.instant('COMMON.BUTTON.CANCEL'),
          role: 'cancel',
        },
      ],
    });
    await actionSheet.present();
  }

  private async openCamera() {
    try {
      // Dynamic import for tree-shaking and to avoid SSR issues
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        saveToGallery: false,
      });

      if (image.dataUrl) {
        // Convert data URL to File object
        const response = await fetch(image.dataUrl);
        const blob = await response.blob();
        const fileName = `photo_${Date.now()}.${image.format || 'jpeg'}`;
        const file = new File([blob], fileName, { type: `image/${image.format || 'jpeg'}` });

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          const msg = this.translate.instant('FILE_ATTACHMENT.ERROR.SIZE_EXCEEDED', { fileName });
          this.showToast(msg, 'warning');
          return;
        }

        // Check max files limit
        if (this.attachments().length >= MAX_FILES) {
          const msg = this.translate.instant('FILE_ATTACHMENT.ERROR.MAX_FILES', { maxFiles: MAX_FILES });
          this.showToast(msg, 'warning');
          return;
        }

        // Emit the file for upload
        this.upload.emit([file]);
      }
    } catch (error: unknown) {
      // User cancelled or permission denied
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('User cancelled') && !errorMessage.includes('cancelled')) {
        console.error('Camera error:', error);
        this.showToast(this.translate.instant('FILE_ATTACHMENT.ERROR.CAMERA_FAILED'), 'danger');
      }
    }
  }

  private selectFromGallery() {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    input?.click();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);

    // Validate
    const validFiles: File[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        const msg = this.translate.instant('FILE_ATTACHMENT.ERROR.SIZE_EXCEEDED', { fileName: file.name });
        this.showToast(msg, 'warning');
        continue;
      }
      if (this.attachments().length + validFiles.length >= MAX_FILES) {
        const msg = this.translate.instant('FILE_ATTACHMENT.ERROR.MAX_FILES', { maxFiles: MAX_FILES });
        this.showToast(msg, 'warning');
        break;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      this.upload.emit(validFiles);
    }

    // Reset input
    input.value = '';
  }

  onDelete(file: FileAttachment) {
    this.delete.emit(file.id);
  }

  onPreview(file: FileAttachment) {
    this.preview.emit(file);
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
    });
    await toast.present();
  }
}
