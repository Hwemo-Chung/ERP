import { Injectable, signal } from '@angular/core';

/**
 * 반응형 레이아웃 서비스
 * 
 * Breakpoints:
 * - Mobile: < 1080px
 * - Tablet: 1080px - 1279px
 * - Desktop: 1280px - 1919px
 * - Large Desktop: >= 1920px
 */
@Injectable({
  providedIn: 'root'
})
export class ResponsiveLayoutService {
  // Breakpoints
  static readonly MOBILE_MAX = 1079;
  static readonly TABLET_MIN = 1080;
  static readonly TABLET_MAX = 1279;
  static readonly DESKTOP_MIN = 1280;
  static readonly DESKTOP_MAX = 1919;
  static readonly LARGE_DESKTOP_MIN = 1920;

  // Reactive signals
  private readonly _isMobile = signal(false);
  private readonly _isTablet = signal(false);
  private readonly _isDesktop = signal(false);
  private readonly _isLargeDesktop = signal(false);
  private readonly _isWebView = signal(false);
  private readonly _currentBreakpoint = signal<'mobile' | 'tablet' | 'desktop' | 'large-desktop'>('mobile');
  private readonly _screenWidth = signal(0);
  private readonly _screenHeight = signal(0);

  // Public readonly signals
  readonly isMobile = this._isMobile.asReadonly();
  readonly isTablet = this._isTablet.asReadonly();
  readonly isDesktop = this._isDesktop.asReadonly();
  readonly isLargeDesktop = this._isLargeDesktop.asReadonly();
  readonly isWebView = this._isWebView.asReadonly();
  readonly currentBreakpoint = this._currentBreakpoint.asReadonly();
  readonly screenWidth = this._screenWidth.asReadonly();
  readonly screenHeight = this._screenHeight.asReadonly();

  constructor() {
    this.updateLayout();
    
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.updateLayout());
    }
  }

  private updateLayout(): void {
    if (typeof window === 'undefined') return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    this._screenWidth.set(width);
    this._screenHeight.set(height);

    // Update breakpoint flags
    const isMobile = width <= ResponsiveLayoutService.MOBILE_MAX;
    const isTablet = width >= ResponsiveLayoutService.TABLET_MIN && width <= ResponsiveLayoutService.TABLET_MAX;
    const isDesktop = width >= ResponsiveLayoutService.DESKTOP_MIN && width <= ResponsiveLayoutService.DESKTOP_MAX;
    const isLargeDesktop = width >= ResponsiveLayoutService.LARGE_DESKTOP_MIN;

    this._isMobile.set(isMobile);
    this._isTablet.set(isTablet);
    this._isDesktop.set(isDesktop);
    this._isLargeDesktop.set(isLargeDesktop);
    this._isWebView.set(!isMobile); // 1080px 이상은 웹 뷰

    // Set current breakpoint
    if (isMobile) {
      this._currentBreakpoint.set('mobile');
    } else if (isTablet) {
      this._currentBreakpoint.set('tablet');
    } else if (isLargeDesktop) {
      this._currentBreakpoint.set('large-desktop');
    } else {
      this._currentBreakpoint.set('desktop');
    }
  }

  /**
   * Get optimal grid columns based on current breakpoint
   */
  getGridColumns(): number {
    const breakpoint = this._currentBreakpoint();
    switch (breakpoint) {
      case 'mobile': return 1;
      case 'tablet': return 2;
      case 'desktop': return 3;
      case 'large-desktop': return 4;
      default: return 1;
    }
  }

  /**
   * Get optimal stat card columns
   */
  getStatColumns(): number {
    const breakpoint = this._currentBreakpoint();
    switch (breakpoint) {
      case 'mobile': return 2;
      case 'tablet': return 4;
      case 'desktop': return 4;
      case 'large-desktop': return 6;
      default: return 2;
    }
  }

  /**
   * Get sidebar width based on breakpoint
   */
  getSidebarWidth(): number {
    const breakpoint = this._currentBreakpoint();
    switch (breakpoint) {
      case 'tablet': return 80; // Collapsed
      case 'desktop': return 260;
      case 'large-desktop': return 280;
      default: return 0;
    }
  }

  /**
   * Check if should show sidebar
   */
  shouldShowSidebar(): boolean {
    return !this._isMobile();
  }

  /**
   * Check if should use table view (vs card/list)
   */
  shouldUseTableView(): boolean {
    return !this._isMobile();
  }

  /**
   * Get content max width based on breakpoint
   */
  getContentMaxWidth(): string {
    const breakpoint = this._currentBreakpoint();
    switch (breakpoint) {
      case 'mobile': return '100%';
      case 'tablet': return '100%';
      case 'desktop': return '1400px';
      case 'large-desktop': return '1800px';
      default: return '100%';
    }
  }

  /**
   * Get padding based on breakpoint
   */
  getContentPadding(): string {
    const breakpoint = this._currentBreakpoint();
    switch (breakpoint) {
      case 'mobile': return '12px';
      case 'tablet': return '20px';
      case 'desktop': return '24px';
      case 'large-desktop': return '32px';
      default: return '12px';
    }
  }
}
