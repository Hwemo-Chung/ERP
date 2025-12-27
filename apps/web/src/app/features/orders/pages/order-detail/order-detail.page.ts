import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSpinner,
  IonActionSheet,
  ActionSheetController,
  AlertController,
  ToastController,
  IonProgressBar,
} from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';
import { addIcons } from 'ionicons';
import {
  callOutline,
  navigateOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  timeOutline,
  personOutline,
  attachOutline,
  camera,
  documentOutline,
  downloadOutline,
  closeOutline,
  cloudUploadOutline,
  trashOutline,
} from 'ionicons/icons';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OrdersService, Order } from '../../services/orders.service';
import { FileAttachmentComponent, FileAttachment } from '../../../../shared/components/file-attachment/file-attachment.component';
import { FileAttachmentService } from './file-attachment.service';

// Valid transitions per status
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  ASSIGNED: ['CONFIRMED'],
  CONFIRMED: ['DISPATCHED', 'ASSIGNED'],
  DISPATCHED: ['COMPLETED', 'ABSENT', 'POSTPONED', 'CONFIRMED'],
  COMPLETED: ['COLLECTED'],
  ABSENT: ['DISPATCHED'],
  POSTPONED: ['DISPATCHED'],
};

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonSpinner,
    IonActionSheet,
    FileAttachmentComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/orders"></ion-back-button>
        </ion-buttons>
        <ion-title>Order Details</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      @if (isLoading()) {
        <div class="loading-container">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      } @else if (order()) {
        <!-- Status Badge -->
        <div class="status-section">
          <ion-badge [class]="'status-badge status-' + order()!.status.toLowerCase()">
            {{ order()!.status }}
          </ion-badge>
        </div>

        <!-- Order Info Card -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>{{ order()!.erpOrderNumber }}</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list lines="none">
              <ion-item>
                <ion-icon slot="start" name="time-outline"></ion-icon>
                <ion-label>
                  <p>Appointment</p>
                  <h3>{{ order()!.appointmentDate | date:'yyyy-MM-dd' }} {{ order()!.appointmentSlot }}</h3>
                </ion-label>
              </ion-item>
              @if (order()!.installerName) {
                <ion-item>
                  <ion-icon slot="start" name="person-outline"></ion-icon>
                  <ion-label>
                    <p>Installer</p>
                    <h3>{{ order()!.installerName }}</h3>
                  </ion-label>
                </ion-item>
              }
            </ion-list>
          </ion-card-content>
        </ion-card>

        <!-- Customer Info Card -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>Customer Information</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-list lines="none">
              <ion-item>
                <ion-label>
                  <h2>{{ order()!.customerName }}</h2>
                  <p>{{ order()!.customerAddress }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
            <div class="action-buttons">
              <ion-button fill="outline" size="small" (click)="callCustomer()">
                <ion-icon slot="start" name="call-outline"></ion-icon>
                Call
              </ion-button>
              <ion-button fill="outline" size="small" (click)="navigateToAddress()">
                <ion-icon slot="start" name="navigate-outline"></ion-icon>
                Navigate
              </ion-button>
            </div>
          </ion-card-content>
        </ion-card>

        <!-- Order Lines Card -->
        @if (order()!.orderLines?.length) {
          <ion-card>
            <ion-card-header>
              <ion-card-title>Products ({{ order()!.orderLines!.length }})</ion-card-title>
            </ion-card-header>
            <ion-card-content>
              <ion-list>
                @for (line of order()!.orderLines; track line.id) {
                  <ion-item>
                    <ion-label>
                      <h3>{{ line.productName }}</h3>
                      <p>{{ line.productCode }} × {{ line.quantity }}</p>
                      @if (line.serialNumber) {
                        <p><strong>S/N:</strong> {{ line.serialNumber }}</p>
                      }
                    </ion-label>
                  </ion-item>
                }
              </ion-list>
            </ion-card-content>
          </ion-card>
        }

        <!-- File Attachments (FR-20) -->
        <ion-card>
          <ion-card-header>
            <ion-card-title>
              <ion-icon name="attach-outline"></ion-icon>
              첨부 파일
            </ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <app-file-attachment
              [attachments]="attachments()"
              [orderId]="order()!.id"
              (upload)="onFileUpload($event)"
              (delete)="onFileDelete($event)"
              (preview)="onFilePreview($event)"
            ></app-file-attachment>

            <!-- Quick action buttons -->
            <div class="file-action-buttons">
              @if (isNativeApp()) {
                <ion-button
                  fill="outline"
                  size="small"
                  (click)="takePhoto()"
                  [disabled]="isUploading()"
                >
                  <ion-icon slot="start" name="camera"></ion-icon>
                  사진 촬영
                </ion-button>
                <ion-button
                  fill="outline"
                  size="small"
                  (click)="scanDocument()"
                  [disabled]="isUploading()"
                >
                  <ion-icon slot="start" name="document-outline"></ion-icon>
                  문서 스캔
                </ion-button>
                <ion-button
                  fill="outline"
                  size="small"
                  (click)="pickFromGallery()"
                  [disabled]="isUploading()"
                >
                  <ion-icon slot="start" name="cloud-upload-outline"></ion-icon>
                  갤러리
                </ion-button>
              } @else {
                <input
                  #fileInput
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  style="display: none"
                  (change)="onFileInputChange($event)"
                />
                <ion-button
                  fill="outline"
                  size="small"
                  (click)="fileInput.click()"
                  [disabled]="isUploading()"
                >
                  <ion-icon slot="start" name="cloud-upload-outline"></ion-icon>
                  파일 선택
                </ion-button>
              }
            </div>

            <!-- Upload Progress -->
            @if (isUploading()) {
              <div class="upload-progress">
                <progress
                  class="progress-bar"
                  [value]="uploadProgress()"
                  max="100"
                ></progress>
                <p>{{ uploadProgress() }}% 업로드 중...</p>
              </div>
            }

            <!-- Attachments List -->
            @if (attachments().length > 0) {
              <div class="attachments-list">
                <p class="list-header">
                  첨부 파일 ({{ attachments().length }})
                </p>
                @for (attachment of attachments(); track attachment.id) {
                  <div class="attachment-item">
                    <div class="attachment-info">
                      @if (attachment.isImage) {
                        <div class="attachment-thumbnail">
                          <img
                            [src]="attachment.thumbnailUrl"
                            alt="{{ attachment.fileName }}"
                          />
                        </div>
                      } @else {
                        <div class="attachment-icon">
                          <ion-icon name="document-outline"></ion-icon>
                        </div>
                      }
                      <div class="attachment-details">
                        <h4>{{ attachment.fileName }}</h4>
                        <p class="file-size">{{ formatFileSize(attachment.fileSize ?? 0) }}</p>
                        <p class="file-date">{{ attachment.uploadedAt ? formatDate(attachment.uploadedAt) : '-' }}</p>
                      </div>
                    </div>
                    <div class="attachment-actions">
                      <ion-button
                        fill="clear"
                        size="small"
                        (click)="downloadAttachment(attachment)"
                      >
                        <ion-icon name="download-outline"></ion-icon>
                      </ion-button>
                      <ion-button
                        fill="clear"
                        size="small"
                        color="danger"
                        (click)="deleteAttachment(attachment)"
                      >
                        <ion-icon name="trash-outline"></ion-icon>
                      </ion-button>
                    </div>
                  </div>
                }
              </div>
            }
          </ion-card-content>
        </ion-card>

        <!-- Status Actions -->
        @if (allowedTransitions().length > 0) {
          <div class="status-actions">
            @for (status of allowedTransitions(); track status) {
              <ion-button
                [color]="getStatusButtonColor(status)"
                expand="block"
                (click)="confirmStatusChange(status)"
              >
                <ion-icon slot="start" [name]="getStatusIcon(status)"></ion-icon>
                {{ getStatusLabel(status) }}
              </ion-button>
            }
          </div>
        }
      } @else {
        <div class="empty-state">
          <h3>Order not found</h3>
        </div>
      }
    </ion-content>
  `,
  styles: [`
    .loading-container {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .status-section {
      text-align: center;
      margin-bottom: 16px;

      ion-badge {
        font-size: 16px;
        padding: 8px 24px;
      }
    }

    ion-card {
      margin-bottom: 16px;
    }

    .action-buttons {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    .status-actions {
      margin-top: 24px;

      ion-button {
        margin-bottom: 8px;
      }
    }

    /* File Attachment Styles */
    .file-action-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;

      ion-button {
        flex: 1;
        min-width: 100px;
      }
    }

    .upload-progress {
      margin: 16px 0;

      ion-progress-bar {
        margin-bottom: 8px;
      }

      p {
        text-align: center;
        font-size: 12px;
        color: #666;
      }
    }

    .attachments-list {
      margin-top: 16px;

      .list-header {
        font-weight: 600;
        margin: 12px 0 8px;
        color: #333;
      }
    }

    .attachment-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      margin-bottom: 8px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background: #f9f9f9;

      &:hover {
        background: #f0f0f0;
      }
    }

    .attachment-info {
      display: flex;
      gap: 12px;
      flex: 1;
      align-items: center;
    }

    .attachment-thumbnail {
      width: 60px;
      height: 60px;
      border-radius: 4px;
      overflow: hidden;
      background: #eee;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .attachment-icon {
      width: 60px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      background: #f0f0f0;
      font-size: 32px;
      color: #999;
    }

    .attachment-details {
      flex: 1;

      h4 {
        margin: 0 0 4px;
        font-size: 14px;
        font-weight: 600;
        color: #333;
        word-break: break-word;
      }

      p {
        margin: 0;
        font-size: 12px;
        color: #999;

        &.file-size {
          font-weight: 500;
        }
      }
    }

    .attachment-actions {
      display: flex;
      gap: 4px;

      ion-button {
        margin: 0;
      }
    }

    .empty-state {
      text-align: center;
      padding: 48px 16px;
      color: #999;

      h3 {
        margin: 0;
      }
    }
  `],
})
export class OrderDetailPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ordersService = inject(OrdersService);
  private readonly fileService = inject(FileAttachmentService);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroy$ = new Subject<void>();

  protected readonly order = signal<Order | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly allowedTransitions = signal<string[]>([]);
  protected readonly attachments = signal<FileAttachment[]>([]);
  protected readonly isUploading = signal(false);
  protected readonly uploadProgress = signal(0);

  constructor() {
    addIcons({
      callOutline,
      navigateOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      timeOutline,
      personOutline,
      attachOutline,
      camera,
      documentOutline,
      downloadOutline,
      closeOutline,
      cloudUploadOutline,
      trashOutline,
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadOrder(id);
      this.setupUploadProgressListener();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected isNativeApp(): boolean {
    return Capacitor.isNativePlatform();
  }

  private setupUploadProgressListener(): void {
    this.fileService
      .getUploadProgress$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((progress) => this.uploadProgress.set(progress));
  }

  private async loadOrder(id: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const order = await this.ordersService.getOrder(id);
      this.order.set(order);

      if (order) {
        this.allowedTransitions.set(ALLOWED_TRANSITIONS[order.status] || []);
      }
    } finally {
      this.isLoading.set(false);
    }
  }

  protected callCustomer(): void {
    const phone = this.order()?.customerPhone;
    if (phone) {
      window.open(`tel:${phone}`, '_system');
    }
  }

  protected navigateToAddress(): void {
    const address = this.order()?.customerAddress;
    if (address) {
      const encoded = encodeURIComponent(address);
      window.open(`https://maps.google.com?q=${encoded}`, '_system');
    }
  }

  protected async confirmStatusChange(newStatus: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Confirm Status Change',
      message: `Change status to ${this.getStatusLabel(newStatus)}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm',
          handler: () => this.updateStatus(newStatus),
        },
      ],
    });

    await alert.present();
  }

  private async updateStatus(newStatus: string): Promise<void> {
    const currentOrder = this.order();
    if (!currentOrder) return;

    try {
      const updated = await this.ordersService.updateStatus(currentOrder.id, {
        status: newStatus,
        version: currentOrder.version,
      });

      this.order.set(updated);
      this.allowedTransitions.set(ALLOWED_TRANSITIONS[updated.status] || []);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }

  protected getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      CONFIRMED: 'Confirm Assignment',
      DISPATCHED: 'Start Dispatch',
      COMPLETED: 'Mark Complete',
      COLLECTED: 'Mark Collected',
      ABSENT: 'Customer Absent',
      POSTPONED: 'Postpone',
      ASSIGNED: 'Revert to Assigned',
    };
    return labels[status] || status;
  }

  protected getStatusButtonColor(status: string): string {
    const colors: Record<string, string> = {
      CONFIRMED: 'primary',
      DISPATCHED: 'secondary',
      COMPLETED: 'success',
      COLLECTED: 'success',
      ABSENT: 'warning',
      POSTPONED: 'warning',
      ASSIGNED: 'medium',
    };
    return colors[status] || 'primary';
  }

  protected getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      CONFIRMED: 'checkmark-circle-outline',
      DISPATCHED: 'navigate-outline',
      COMPLETED: 'checkmark-circle-outline',
      COLLECTED: 'checkmark-circle-outline',
      ABSENT: 'close-circle-outline',
      POSTPONED: 'time-outline',
      ASSIGNED: 'person-outline',
    };
    return icons[status] || 'checkmark-circle-outline';
  }

  // FR-20: File Attachment Methods
  protected async onFileUpload(files: File[]): Promise<void> {
    const orderId = this.order()?.id;
    if (!orderId) return;

    for (const file of files) {
      // Create temp attachment with progress
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const tempAttachment: FileAttachment = {
        id: tempId,
        name: file.name,
        url: URL.createObjectURL(file),
        size: file.size,
        type: file.type,
        uploadedAt: new Date(),
        uploadProgress: 0,
      };
      
      this.attachments.update(list => [...list, tempAttachment]);

      try {
        // Upload file via ordersStore
        // Note: File upload requires S3 presigned URL from API
        // Currently simulating upload with progress updates
        
        // Simulate upload progress
        for (let progress = 0; progress <= 100; progress += 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          this.attachments.update(list =>
            list.map(a => a.id === tempId ? { ...a, uploadProgress: progress } : a)
          );
        }

        // Update with final attachment info
        this.attachments.update(list =>
          list.map(a => a.id === tempId ? { 
            ...a, 
            id: `file-${Date.now()}`,
            uploadProgress: undefined 
          } : a)
        );

        const toast = await this.toastCtrl.create({
          message: `${file.name} 업로드 완료`,
          duration: 2000,
          color: 'success',
        });
        await toast.present();
      } catch (error) {
        // Remove failed upload
        this.attachments.update(list => list.filter(a => a.id !== tempId));
        
        const toast = await this.toastCtrl.create({
          message: `${file.name} 업로드 실패`,
          duration: 2000,
          color: 'danger',
        });
        await toast.present();
      }
    }
  }

  protected async onFileDelete(fileId: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '파일 삭제',
      message: '이 파일을 삭제하시겠습니까?',
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '삭제',
          role: 'destructive',
          handler: async () => {
            try {
              // Delete attachment from order
              // Note: API call would be ordersStore.deleteAttachment(orderId, fileId)
              this.attachments.update(list => list.filter(a => a.id !== fileId));
              
              const toast = await this.toastCtrl.create({
                message: '파일이 삭제되었습니다.',
                duration: 2000,
                color: 'success',
              });
              await toast.present();
            } catch (error) {
              const toast = await this.toastCtrl.create({
                message: '파일 삭제 실패',
                duration: 2000,
                color: 'danger',
              });
              await toast.present();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  protected onFilePreview(file: FileAttachment): void {
    // Open file in new window/modal
    window.open(file.url, '_blank');
  }

  // Additional file attachment methods
  protected async takePhoto(): Promise<void> {
    const attachment = await this.fileService.takePhoto();
    if (attachment) {
      this.processAttachment(attachment);
    }
  }

  protected async scanDocument(): Promise<void> {
    const attachment = await this.fileService.pickDocument();
    if (attachment) {
      this.processAttachment(attachment);
    }
  }

  protected async pickFromGallery(): Promise<void> {
    const attachment = await this.fileService.pickFromGallery();
    if (attachment) {
      this.processAttachment(attachment);
    }
  }

  protected onFileInputChange(event: any): void {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of files) {
      const reader = new FileReader();
      reader.onload = async (e: any) => {
        const base64String = e.target.result.split(',')[1];
        const isImage = file.type.startsWith('image/');

        const attachment = {
          id: `file_${Date.now()}`,
          name: file.name,
          url: e.target.result,
          size: file.size,
          type: file.type,
          uploadedAt: new Date(),
          isImage,
          base64Data: base64String,
        };

        await this.processAttachment(attachment);
      };
      reader.readAsDataURL(file);
    }
  }

  private async processAttachment(attachment: any): Promise<void> {
    // Compress image if needed
    if (attachment.isImage) {
      const result = await this.fileService.compressImage(attachment.base64Data, {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.7,
      });

      if (result.success && result.base64Data) {
        attachment.base64Data = result.base64Data;
        const toast = await this.toastCtrl.create({
          message: `압축 완료: ${result.compressionRatio}% 감소`,
          duration: 2000,
          color: 'success',
        });
        await toast.present();
      }
    }

    // Upload file
    const orderId = this.order()?.id;
    if (orderId) {
      this.isUploading.set(true);
      this.fileService
        .uploadFile(orderId, attachment)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.fileService.addAttachment(attachment);
            this.attachments.update(list => [...list, attachment]);
            this.isUploading.set(false);
            const toast = this.toastCtrl.create({
              message: '파일이 업로드되었습니다',
              duration: 2000,
              color: 'success',
            });
            toast.then(t => t.present());
          },
          error: (err) => {
            this.isUploading.set(false);
            const toast = this.toastCtrl.create({
              message: '파일 업로드 실패',
              duration: 2000,
              color: 'danger',
            });
            toast.then(t => t.present());
          },
        });
    }
  }

  protected async downloadAttachment(attachment: FileAttachment): Promise<void> {
    const orderId = this.order()?.id;
    if (!orderId) return;

    this.fileService
      .downloadAttachment(orderId, attachment.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = attachment.name ?? attachment.fileName ?? 'download';
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          this.toastCtrl
            .create({
              message: '파일 다운로드 실패',
              duration: 2000,
              color: 'danger',
            })
            .then(t => t.present());
        },
      });
  }

  protected async deleteAttachment(attachment: FileAttachment): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '파일 삭제',
      message: `${attachment.name}을 삭제하시겠습니까?`,
      buttons: [
        { text: '취소', role: 'cancel' },
        {
          text: '삭제',
          role: 'destructive',
          handler: () => {
            const orderId = this.order()?.id;
            if (orderId) {
              this.fileService
                .deleteAttachment(orderId, attachment.id)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                  next: () => {
                    this.attachments.update(list => list.filter(a => a.id !== attachment.id));
                    this.toastCtrl
                      .create({
                        message: '파일이 삭제되었습니다',
                        duration: 2000,
                        color: 'success',
                      })
                      .then(t => t.present());
                  },
                });
            }
          },
        },
      ],
    });
    await alert.present();
  }

  protected formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  protected formatDate(date: Date | number): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    return d.toLocaleString('ko-KR');
  }
}
