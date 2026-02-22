import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonFooter,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import {
  BaseSignaturePadComponent,
  SIGNATURE_PAD_TEMPLATE,
  SIGNATURE_PAD_STYLES,
} from '@erp/shared';

@Component({
  selector: 'app-signature-pad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonFooter,
    TranslateModule,
  ],
  template: SIGNATURE_PAD_TEMPLATE,
  styles: [SIGNATURE_PAD_STYLES],
})
export class SignaturePadComponent extends BaseSignaturePadComponent {
  private readonly modalCtrl = inject(ModalController);

  override close(): void {
    this.modalCtrl.dismiss(null);
  }

  override confirm(): void {
    const dataUrl = this.canvas.toDataURL('image/png');
    this.modalCtrl.dismiss(dataUrl);
  }
}
