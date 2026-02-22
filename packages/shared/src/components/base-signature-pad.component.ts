import {
  Directive,
  ElementRef,
  ViewChild,
  signal,
  AfterViewInit,
  OnDestroy,
  HostListener,
} from '@angular/core';

export const SIGNATURE_PAD_TEMPLATE = `
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start">
        <ion-button (click)="close()">{{ 'SIGNATURE.CANCEL' | translate }}</ion-button>
      </ion-buttons>
      <ion-title>{{ 'SIGNATURE.TITLE' | translate }}</ion-title>
      <ion-buttons slot="end">
        <ion-button (click)="clear()">{{ 'SIGNATURE.CLEAR' | translate }}</ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>

  <ion-content class="signature-content">
    <div class="canvas-container">
      <canvas
        #signatureCanvas
        (mousedown)="onMouseDown($event)"
        (mousemove)="onMouseMove($event)"
        (mouseup)="onMouseUp($event)"
        (mouseleave)="onMouseUp($event)"
        (touchstart)="onTouchStart($event)"
        (touchmove)="onTouchMove($event)"
        (touchend)="onTouchEnd($event)"
      ></canvas>
      @if (!hasSignature()) {
        <p class="hint">{{ 'SIGNATURE.HINT' | translate }}</p>
      }
    </div>
  </ion-content>

  <ion-footer>
    <ion-toolbar>
      <ion-button expand="full" [disabled]="!hasSignature()" (click)="confirm()">
        {{ 'SIGNATURE.CONFIRM' | translate }}
      </ion-button>
    </ion-toolbar>
  </ion-footer>
`;

export const SIGNATURE_PAD_STYLES = `
  .signature-content {
    --background: #f5f5f5;
  }

  .canvas-container {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  canvas {
    background: white;
    border: 2px dashed #ddd;
    border-radius: 8px;
    width: 100%;
    height: 300px;
    touch-action: none;
  }

  .hint {
    position: absolute;
    color: #999;
    font-size: 16px;
    pointer-events: none;
  }
`;

@Directive()
export abstract class BaseSignaturePadComponent implements AfterViewInit, OnDestroy {
  @ViewChild('signatureCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  protected readonly hasSignature = signal(false);

  protected canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private isDrawing = false;
  private lastX = 0;
  private lastY = 0;
  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    this.initCanvas();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  private initCanvas(): void {
    this.canvas = this.canvasRef.nativeElement;
    const context = this.canvas.getContext('2d');
    if (!context) return;

    this.ctx = context;
    this.setupCanvas();

    this.resizeObserver = new ResizeObserver(() => {
      this.setupCanvas();
    });
    this.resizeObserver.observe(this.canvas);
  }

  private setupCanvas(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    this.ctx.scale(dpr, dpr);

    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.setupCanvas();
  }

  onMouseDown(event: MouseEvent): void {
    this.startDrawing(event.offsetX, event.offsetY);
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isDrawing) return;
    this.draw(event.offsetX, event.offsetY);
  }

  onMouseUp(_event: MouseEvent): void {
    this.stopDrawing();
  }

  onTouchStart(event: TouchEvent): void {
    event.preventDefault();
    const touch = event.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    this.startDrawing(touch.clientX - rect.left, touch.clientY - rect.top);
  }

  onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    if (!this.isDrawing) return;
    const touch = event.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    this.draw(touch.clientX - rect.left, touch.clientY - rect.top);
  }

  onTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    this.stopDrawing();
  }

  private startDrawing(x: number, y: number): void {
    this.isDrawing = true;
    this.lastX = x;
    this.lastY = y;
    this.hasSignature.set(true);
  }

  private draw(x: number, y: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.lastX = x;
    this.lastY = y;
  }

  private stopDrawing(): void {
    this.isDrawing = false;
  }

  clear(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
    this.hasSignature.set(false);
  }

  abstract close(): void;
  abstract confirm(): void;
}
