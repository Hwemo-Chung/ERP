import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
// import { DocumentScanner } from '@capacitor/document-scanner'; // Optional dependency
import {
  FileAttachment,
  FileUploadRequest,
  FileUploadResponse,
  FileCompressionOptions,
  FileCompressionResult,
} from './file-attachment.models';

@Injectable({
  providedIn: 'root',
})
export class FileAttachmentService {
  private readonly API_BASE = '/api/orders';
  private attachments$ = new BehaviorSubject<FileAttachment[]>([]);
  private uploadProgress$ = new BehaviorSubject<number>(0);
  private readonly translate = inject(TranslateService);

  constructor(private http: HttpClient) {}

  /**
   * Capacitor Document Picker로 문서 선택
   */
  async pickDocument(): Promise<FileAttachment | null> {
    try {
      // Check if DocumentScanner is available
      if (!('DocumentScanner' in window)) {
        console.warn('DocumentScanner not available');
        return null;
      }

      const DocumentScannerPlugin = (window as any).DocumentScanner;
      const result = await DocumentScannerPlugin.scanDocument({
        croppingGuide: 'ON',
        responseType: 'base64',
      });

      if (!result.scans || result.scans.length === 0) {
        return null;
      }

      const scanData = result.scans[0];
      const fileName = `document_${Date.now()}.jpg`;

      return {
        id: this.generateId(),
        orderId: '',
        fileName,
        fileType: 'image/jpeg',
        fileSize: this.estimateBase64Size(scanData),
        base64Data: scanData,
        uploadedAt: Date.now(),
        category: 'photo',
        isImage: true,
        thumbnailUrl: `data:image/jpeg;base64,${scanData}`,
      };
    } catch (error) {
      console.error('Document picker error:', error);
      return null;
    }
  }

  /**
   * Capacitor Camera로 사진 촬영
   */
  async takePhoto(): Promise<FileAttachment | null> {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
        promptLabelPicture: this.translate.instant('CAMERA.TAKE_PHOTO'),
        promptLabelCancel: this.translate.instant('COMMON.BUTTON.CANCEL'),
      });

      if (!photo.base64String) {
        return null;
      }

      const fileName = `photo_${Date.now()}.jpg`;

      return {
        id: this.generateId(),
        orderId: '',
        fileName,
        fileType: 'image/jpeg',
        fileSize: this.estimateBase64Size(photo.base64String),
        base64Data: photo.base64String,
        uploadedAt: Date.now(),
        category: 'photo',
        isImage: true,
        thumbnailUrl: `data:image/jpeg;base64,${photo.base64String}`,
      };
    } catch (error) {
      console.error('Camera error:', error);
      return null;
    }
  }

  /**
   * 파일 입력(input[type=file])으로 선택
   */
  async pickFromGallery(): Promise<FileAttachment | null> {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
        promptLabelPicture: this.translate.instant('CAMERA.SELECT_PHOTO'),
        promptLabelCancel: this.translate.instant('COMMON.BUTTON.CANCEL'),
      });

      if (!photo.base64String) {
        return null;
      }

      const fileName = `gallery_${Date.now()}.jpg`;

      return {
        id: this.generateId(),
        orderId: '',
        fileName,
        fileType: 'image/jpeg',
        fileSize: this.estimateBase64Size(photo.base64String),
        base64Data: photo.base64String,
        uploadedAt: Date.now(),
        category: 'photo',
        isImage: true,
        thumbnailUrl: `data:image/jpeg;base64,${photo.base64String}`,
      };
    } catch (error) {
      console.error('Gallery picker error:', error);
      return null;
    }
  }

  /**
   * 이미지 압축 (Canvas API 사용)
   */
  async compressImage(
    base64Data: string,
    options: FileCompressionOptions = {}
  ): Promise<FileCompressionResult> {
    const {
      maxWidth = 1024,
      maxHeight = 1024,
      quality = 0.7,
      mimeType = 'image/webp',
    } = options;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // 종횡비 유지하며 크기 조정
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
        }

        const compressedBase64 = canvas.toDataURL(mimeType, quality);
        const originalSize = this.estimateBase64Size(base64Data);
        const compressedSize = this.estimateBase64Size(compressedBase64);
        const ratio =
          ((originalSize - compressedSize) / originalSize) * 100;

        resolve({
          success: true,
          base64Data: compressedBase64.split(',')[1], // Remove data URL prefix
          originalSize,
          compressedSize,
          compressionRatio: Math.round(ratio),
        });
      };

      img.onerror = () => {
        resolve({
          success: false,
          originalSize: this.estimateBase64Size(base64Data),
          compressedSize: 0,
          compressionRatio: 0,
        });
      };

      img.src = `data:image/jpeg;base64,${base64Data}`;
    });
  }

  /**
   * 파일 업로드 (서버에 전송)
   */
  uploadFile(
    orderId: string,
    attachment: FileAttachment
  ): Observable<FileUploadResponse> {
    const request: FileUploadRequest = {
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      base64Data: attachment.base64Data,
      fileSize: attachment.fileSize,
      category: attachment.category,
    };

    return this.http
      .post<FileUploadResponse>(
        `${this.API_BASE}/${orderId}/attachments`,
        request
      )
      .pipe(
        tap(() => {
          this.uploadProgress$.next(100);
          setTimeout(() => this.uploadProgress$.next(0), 1000);
        }),
        catchError(this.handleError)
      );
  }

  /**
   * 주문의 첨부 파일 목록 조회
   */
  getAttachments(orderId: string): Observable<FileAttachment[]> {
    return this.http
      .get<FileAttachment[]>(`${this.API_BASE}/${orderId}/attachments`)
      .pipe(
        tap((attachments) => this.attachments$.next(attachments)),
        catchError(this.handleError)
      );
  }

  /**
   * 첨부 파일 삭제
   */
  deleteAttachment(
    orderId: string,
    attachmentId: string
  ): Observable<{ success: boolean }> {
    return this.http
      .delete<{ success: boolean }>(
        `${this.API_BASE}/${orderId}/attachments/${attachmentId}`
      )
      .pipe(
        tap(() => {
          const current = this.attachments$.value;
          this.attachments$.next(
            current.filter((a) => a.id !== attachmentId)
          );
        }),
        catchError(this.handleError)
      );
  }

  /**
   * 첨부 파일 다운로드 (data URL로 반환)
   */
  downloadAttachment(
    orderId: string,
    attachmentId: string
  ): Observable<Blob> {
    return this.http
      .get(
        `${this.API_BASE}/${orderId}/attachments/${attachmentId}/download`,
        { responseType: 'blob' }
      )
      .pipe(catchError(this.handleError));
  }

  /**
   * 첨부 파일 목록 상태 구독
   */
  getAttachments$(): Observable<FileAttachment[]> {
    return this.attachments$.asObservable();
  }

  /**
   * 업로드 진행 상황 구독
   */
  getUploadProgress$(): Observable<number> {
    return this.uploadProgress$.asObservable();
  }

  /**
   * 첨부 파일 추가 (로컬)
   */
  addAttachment(attachment: FileAttachment): void {
    const current = this.attachments$.value;
    this.attachments$.next([...current, attachment]);
  }

  /**
   * 로컬에서 첨부 파일 제거
   */
  removeAttachmentLocal(attachmentId: string): void {
    const current = this.attachments$.value;
    this.attachments$.next(current.filter((a) => a.id !== attachmentId));
  }

  /**
   * Capacitor 플랫폼 확인
   */
  isNativeApp(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Base64 크기 추정 (바이트)
   */
  private estimateBase64Size(base64String: string): number {
    // Base64 인코딩은 원본의 33% 더 크므로, 역산하여 추정
    const length = base64String.replace(/[=]/g, '').length;
    return Math.floor((length * 3) / 4);
  }

  /**
   * 고유 ID 생성
   */
  private generateId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * HTTP 에러 처리
   */
  private handleError(error: HttpErrorResponse) {
    const errorMsg = error.error?.message || error.message || 'File upload error';
    console.error('FileAttachmentService error:', errorMsg);
    return throwError(() => new Error(errorMsg));
  }
}
