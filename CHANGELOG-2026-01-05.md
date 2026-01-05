# Changelog - 2026-01-05

## Overview

This session focused on three major areas:

1. **Web App Button Styling** - Remove `expand="block"` and center-align buttons for desktop
2. **Mobile App CORS Fix** - Enable Mobile app (port 4201) to communicate with API
3. **Mobile Auth Service Fix** - Fix login/logout response handling

---

## 1. Web App Button Center Alignment (21 files)

### Problem

Ionic `expand="block"` attribute makes buttons stretch full-width, which is appropriate for mobile but looks poor on desktop web interfaces.

### Solution

Removed `expand="block"` from all buttons in Web app and applied centered flexbox styling.

### CSS Pattern Applied

```scss
.action-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;

  ion-button {
    flex: 0 1 auto;
    min-width: 140px;
    max-width: 200px;
  }

  @media (max-width: 767px) {
    flex-direction: column;
    align-items: center;

    ion-button {
      width: 100%;
      max-width: 100%;
    }
  }
}
```

### Files Modified

#### Assignment Module

| File                        | Changes                                        |
| --------------------------- | ---------------------------------------------- |
| `assignment-detail.page.ts` | Footer buttons centered with `.action-buttons` |
| `batch-assign.page.ts`      | Action buttons centered                        |
| `release-confirm.page.ts`   | Footer buttons centered                        |

#### Completion Module

| File                             | Changes                        |
| -------------------------------- | ------------------------------ |
| `completion-certificate.page.ts` | Form action buttons centered   |
| `completion-process.page.ts`     | Process buttons centered       |
| `serial-input.page.ts`           | Input action buttons centered  |
| `waste-pickup.page.ts`           | Pickup action buttons centered |

#### Orders Module

| File                     | Changes                        |
| ------------------------ | ------------------------------ |
| `order-absence.page.ts`  | Absence form buttons centered  |
| `order-detail.page.ts`   | Detail action buttons centered |
| `order-postpone.page.ts` | Postpone form buttons centered |

#### Profile Module

| File              | Changes                         |
| ----------------- | ------------------------------- |
| `profile.page.ts` | Profile action buttons centered |

#### Reports Module

| File                  | Changes                        |
| --------------------- | ------------------------------ |
| `export-page.page.ts` | Export action buttons centered |

#### Settings Module

| File                         | Changes                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| `biometric-settings.page.ts` | Test button centered                                              |
| `split-order.page.ts`        | Save button centered with `.action-buttons`                       |
| `system-settings.page.ts`    | 5 buttons (form-actions, section-actions, modal-actions) centered |

#### Shared Components

| File                                 | Changes                                       |
| ------------------------------------ | --------------------------------------------- |
| `bulk-operation-result.component.ts` | 2 buttons centered                            |
| `conflict-dialog.component.ts`       | 3 buttons centered                            |
| `order-filter.modal.ts`              | Footer button centered with `.footer-actions` |
| `session-timeout-modal.component.ts` | 2 buttons centered                            |

---

## 2. API CORS Configuration Fix

### Problem

Mobile app running on `localhost:4201` was blocked by CORS policy. API only allowed origins `4200` and `4300`.

### Solution

Added `localhost:4201` to CORS allowed origins.

### File Modified

`apps/api/src/main.ts`

### Change

```typescript
// Before
origin: ['http://localhost:4200', 'http://localhost:4300'],

// After
origin: ['http://localhost:4200', 'http://localhost:4201', 'http://localhost:4300'],
```

### Port Assignments

| Port | Application        | Target Users     |
| ---- | ------------------ | ---------------- |
| 3000 | API Server         | Backend          |
| 4200 | Legacy/Development | -                |
| 4201 | Mobile App         | Field Installers |
| 4300 | Web App            | HQ/Admin Desktop |

---

## 3. Mobile Auth Service Fixes

### Problem 1: Login Response Parsing

Mobile AuthService was manually parsing `response.data.accessToken` but `apiResponseInterceptor` already unwraps the response.

### Root Cause

Both Web and Mobile apps have `apiResponseInterceptor` that transforms:

```typescript
{ success: true, data: { ... } }  →  { ... }
```

Mobile AuthService was double-accessing with `response.data.accessToken` resulting in `undefined`.

### Solution

Changed to access unwrapped data directly:

```typescript
// Before (WRONG)
const response = await firstValueFrom(this.http.post<{ success, data }>(...));
tokens.accessToken = response.data.accessToken;

// After (CORRECT)
const data = await firstValueFrom(this.http.post<{ accessToken, refreshToken, user }>(...));
tokens.accessToken = data.accessToken;
```

### Problem 2: Logout 401 Error

Logout cleared tokens from state BEFORE calling logout API, causing auth interceptor to send request without token.

### Solution

Save token before clearing state, then pass it directly in request header:

```typescript
async logout(): Promise<void> {
  const currentToken = this._state().tokens?.accessToken;

  // Clear state first
  this._state.set({ user: null, tokens: null, ... });
  await Preferences.remove(...);

  // Call API with saved token
  if (currentToken) {
    await this.http.post(
      `${environment.apiUrl}/auth/logout`,
      {},
      { headers: { Authorization: `Bearer ${currentToken}` } }
    );
  }
}
```

### File Modified

`apps/mobile/src/app/core/services/auth.service.ts`

### Methods Fixed

- `login()` - Fixed response parsing
- `logout()` - Fixed token handling for API call
- `_doRefresh()` - Fixed response parsing

---

## 4. Other Changes

### Order Models Update

Files updated to support API response structure:

- `apps/mobile/src/app/store/orders/orders.models.ts`
- `apps/web/src/app/store/orders/orders.models.ts`

### Shell Scripts

- `start-all.sh` - Updated for service management
- `stop-all.sh` - Updated for service management

---

## Technical Notes

### API Response Interceptor Pattern

Both Web and Mobile apps use `apiResponseInterceptor` to unwrap API responses:

```typescript
// Interceptor location
apps/mobile/src/app/core/interceptors/api-response.interceptor.ts
apps/web/src/app/core/interceptors/api-response.interceptor.ts

// Behavior
Input:  { success: true, data: T, timestamp: string }
Output: T (unwrapped data)
```

**Important**: When working with auth services, remember that responses are already unwrapped by the interceptor.

### Test Credentials

- **Username**: `0001`
- **Password**: `test`

### Service URLs

- API: http://localhost:3000
- Web: http://localhost:4300
- Mobile: http://localhost:4201

---

## Files Changed Summary

| Category           | Files Modified |
| ------------------ | -------------- |
| API                | 1              |
| Mobile Auth        | 1              |
| Web Button Styling | 18             |
| Store Models       | 2              |
| Shell Scripts      | 2              |
| **Total**          | **24 files**   |

---

## Verification Steps

1. **Web App Buttons**
   - Navigate to any page with action buttons
   - Verify buttons are centered, not full-width
   - Test responsive behavior on mobile viewport

2. **Mobile Login**
   - Open http://localhost:4201
   - Login with credentials (0001/test)
   - Verify successful login and redirect

3. **Mobile Logout**
   - Click logout button
   - Verify no 401 errors in console
   - Verify redirect to login page

---

## Known Issues

None identified in current changes.

---

## Next Steps (Recommended)

1. Run full build verification: `pnpm build`
2. Run test suite: `pnpm test`
3. Consider adding E2E tests for login/logout flow
