# 웹/모바일 반응형 레이아웃 가이드

## 개요

이 프로젝트는 **1080px**를 기준으로 웹 버전과 모바일 버전을 분리합니다.

| 구분 | 해상도 범위 | 최적화 |
|------|-------------|--------|
| **모바일** | < 1080px | 터치 최적화, 카드/리스트 뷰 |
| **태블릿** | 1080px - 1279px | 웹 레이아웃 (축소 사이드바) |
| **데스크탑** | 1280px - 1919px | 웹 레이아웃 |
| **대형 데스크탑** | ≥ 1920px | 1920×1080 최적화 |

## Breakpoint 변수

### CSS Variables
```css
:root {
  --breakpoint-mobile: 1080px;
  --breakpoint-tablet: 1280px;
  --breakpoint-desktop: 1920px;
}
```

### SCSS Mixins
```scss
// apps/web/src/theme/_breakpoints.scss

@mixin mobile-only {
  @media (max-width: 1079px) { @content; }
}

@mixin web-only {
  @media (min-width: 1080px) { @content; }
}

@mixin tablet {
  @media (min-width: 1080px) and (max-width: 1279px) { @content; }
}

@mixin desktop {
  @media (min-width: 1280px) { @content; }
}

@mixin large-desktop {
  @media (min-width: 1920px) { @content; }
}
```

## Helper Classes

```html
<!-- 모바일에서만 표시 -->
<div class="mobile-only">모바일 전용 콘텐츠</div>

<!-- 웹에서만 표시 (1080px 이상) -->
<div class="web-only">웹 전용 콘텐츠</div>

<!-- 태블릿에서만 표시 -->
<div class="tablet-only">태블릿 전용 콘텐츠</div>

<!-- 데스크탑에서만 표시 (1280px 이상) -->
<div class="desktop-only">데스크탑 전용 콘텐츠</div>
```

## ResponsiveLayoutService

### 사용법
```typescript
import { inject } from '@angular/core';
import { ResponsiveLayoutService } from '@shared/services/responsive-layout.service';

@Component({...})
export class MyComponent {
  private layout = inject(ResponsiveLayoutService);

  // Signal 기반 반응형 값
  isMobile = this.layout.isMobile;
  isWebView = this.layout.isWebView;
  currentBreakpoint = this.layout.currentBreakpoint;
}
```

### 제공 기능
| Signal | 설명 |
|--------|------|
| `isMobile()` | 1080px 미만 여부 |
| `isTablet()` | 1080px - 1279px 여부 |
| `isDesktop()` | 1280px - 1919px 여부 |
| `isLargeDesktop()` | 1920px 이상 여부 |
| `isWebView()` | 1080px 이상 여부 (웹 레이아웃 사용) |
| `currentBreakpoint()` | 현재 breakpoint 문자열 |
| `screenWidth()` | 현재 화면 너비 |
| `screenHeight()` | 현재 화면 높이 |

## 컴포넌트 구현 예시

### 템플릿에서 분기
```html
<ion-content [class.web-view]="isWebView()">
  @if (isWebView()) {
    <!-- 웹 버전 레이아웃 -->
    <div class="web-dashboard">
      <div class="web-stats-grid">...</div>
      <div class="web-data-table">...</div>
    </div>
  } @else {
    <!-- 모바일 버전 레이아웃 -->
    <div class="mobile-dashboard">
      <ion-grid>...</ion-grid>
      <ion-list>...</ion-list>
    </div>
  }
</ion-content>
```

### 컴포넌트에서 윈도우 리사이즈 감지
```typescript
import { HostListener, signal } from '@angular/core';

export class MyComponent {
  protected readonly isWebView = signal(window.innerWidth >= 1080);

  @HostListener('window:resize')
  onResize() {
    this.isWebView.set(window.innerWidth >= 1080);
  }
}
```

## 웹 전용 스타일 클래스

### 데이터 테이블 (.web-data-table)
```html
<div class="web-data-table">
  <div class="table-header">
    <div class="table-title">제목</div>
  </div>
  <table>
    <thead><tr><th>컬럼</th></tr></thead>
    <tbody><tr><td>데이터</td></tr></tbody>
  </table>
  <div class="table-footer">페이지네이션</div>
</div>
```

### 통계 그리드 (.web-stats-grid)
```html
<div class="web-stats-grid">
  <div class="web-stat-card">
    <div class="stat-icon primary"><ion-icon name="cube-outline"></ion-icon></div>
    <div class="stat-value">100</div>
    <div class="stat-label">전체</div>
  </div>
</div>
```

### 카드 그리드 (.web-card-grid)
```html
<div class="web-card-grid">
  <div class="web-card">
    <div class="card-header">제목</div>
    <div class="card-body">내용</div>
  </div>
</div>
```

### 필터 바 (.web-filter-bar)
```html
<div class="web-filter-bar">
  <div class="filter-group">
    <label>필터</label>
    <select>...</select>
  </div>
  <div class="filter-actions">
    <button class="web-btn secondary">액션</button>
  </div>
</div>
```

## 버튼 스타일 (.web-btn)
```html
<button class="web-btn primary">기본</button>
<button class="web-btn secondary">보조</button>
<button class="web-btn success">성공</button>
<button class="web-btn danger">위험</button>
<button class="web-btn ghost">고스트</button>
<button class="web-btn sm">작은</button>
<button class="web-btn lg">큰</button>
```

## 파일 구조

```
apps/
├── web/
│   └── src/
│       ├── global.scss              # 전역 스타일 (breakpoints import)
│       ├── theme/
│       │   ├── _breakpoints.scss    # Breakpoint 변수 및 mixins
│       │   ├── _web-layout.scss     # 웹 전용 레이아웃 스타일
│       │   └── variables.scss       # 색상 변수
│       └── app/
│           └── shared/
│               └── services/
│                   └── responsive-layout.service.ts
│
└── mobile/
    └── src/
        ├── global.scss              # 반응형 helper classes 포함
        └── app/
            └── shared/
                └── services/
                    └── responsive-layout.service.ts
```

## 주요 변경된 컴포넌트

1. **대시보드 (dashboard.page.ts)**
   - 웹: 4열 통계 그리드, 상태별 테이블, KPI 카드
   - 모바일: 2열 카드 그리드, 간단한 리스트

2. **주문 목록 (order-list.page.ts)**
   - 웹: 필터 바, 데이터 테이블/카드 뷰 전환
   - 모바일: 세그먼트 필터, Ion-list

## 체크리스트

- [ ] 새 컴포넌트 개발 시 `isWebView` signal 구현
- [ ] 웹 레이아웃은 `.web-*` 클래스 사용
- [ ] 모바일 레이아웃은 Ionic 컴포넌트 사용
- [ ] 반응형 테스트: 1079px, 1080px, 1280px, 1920px
