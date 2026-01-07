/**
 * @fileoverview Skeleton Loading Component
 * @description Loading state placeholder using Ionic skeleton elements
 * 
 * Provides visual feedback during data loading with customizable skeleton items.
 * Supports avatar, title, and content placeholders with animation.
 * 
 * Complexity:
 * - Cyclomatic Complexity: 3
 * - Cognitive Complexity: 4
 * 
 * @example
 * ```html
 * <!-- Basic usage -->
 * <app-skeleton-loading></app-skeleton-loading>
 * 
 * <!-- Custom count without avatar -->
 * <app-skeleton-loading [count]="3" [showAvatar]="false"></app-skeleton-loading>
 * 
 * <!-- Minimal skeleton without animation -->
 * <app-skeleton-loading [animated]="false" [showExtra]="false"></app-skeleton-loading>
 * ```
 */
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-skeleton-loading',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    @for (item of items; track $index) {
      <div class="skeleton-item">
        @if (showAvatar) {
          <ion-skeleton-text [animated]="animated" class="skeleton-avatar"></ion-skeleton-text>
        }
        <div class="skeleton-content">
          <ion-skeleton-text [animated]="animated" class="skeleton-title"></ion-skeleton-text>
          <ion-skeleton-text [animated]="animated" class="skeleton-text"></ion-skeleton-text>
          @if (showExtra) {
            <ion-skeleton-text [animated]="animated" class="skeleton-text short"></ion-skeleton-text>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .skeleton-item {
      display: flex;
      padding: 12px;
      gap: 12px;
      border-bottom: 1px solid var(--ion-color-light);
    }
    
    .skeleton-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    
    .skeleton-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
      justify-content: center;
    }
    
    .skeleton-title {
      width: 60%;
      height: 20px;
      border-radius: 4px;
    }
    
    .skeleton-text {
      width: 90%;
      height: 14px;
      border-radius: 4px;
    }
    
    .skeleton-text.short {
      width: 40%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonLoadingComponent {
  /**
   * Number of skeleton items to display
   * @default 5
   */
  @Input() count = 5;

  /**
   * Enable skeleton animation
   * @default true
   */
  @Input() animated = true;

  /**
   * Show circular avatar skeleton
   * @default true
   */
  @Input() showAvatar = true;

  /**
   * Show extra content line
   * @default true
   */
  @Input() showExtra = true;

  /**
   * Generate array for skeleton items
   * @returns Array of zeros with length equal to count
   */
  get items(): number[] {
    return Array(this.count).fill(0);
  }
}
