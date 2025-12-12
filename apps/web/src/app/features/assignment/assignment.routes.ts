// apps/web/src/app/features/assignment/assignment.routes.ts
import { Routes } from '@angular/router';

export const ASSIGNMENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/assignment-list/assignment-list.page').then(
        (m) => m.AssignmentListPage
      ),
  },
  {
    path: 'detail/:id',
    loadComponent: () =>
      import('./pages/assignment-detail/assignment-detail.page').then(
        (m) => m.AssignmentDetailPage
      ),
  },
  {
    path: 'release-confirm',
    loadComponent: () =>
      import('./pages/release-confirm/release-confirm.page').then(
        (m) => m.ReleaseConfirmPage
      ),
  },
  {
    path: 'batch-assign',
    loadComponent: () =>
      import('./pages/batch-assign/batch-assign.page').then(
        (m) => m.BatchAssignPage
      ),
  },
];
