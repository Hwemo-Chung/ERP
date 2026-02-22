import { Component, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonFooter,
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
  readonly confirmed = output<string>();
  readonly cancelled = output<void>();

  override close(): void {
    this.cancelled.emit();
  }

  override confirm(): void {
    const dataUrl = this.canvas.toDataURL('image/png');
    this.confirmed.emit(dataUrl);
  }
}
