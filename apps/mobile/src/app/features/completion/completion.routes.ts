// apps/web/src/app/features/completion/completion.routes.ts
import { Routes } from '@angular/router';

export const COMPLETION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/completion-list/completion-list.page').then(
        (m) => m.CompletionListPage
      ),
  },
  {
    path: 'process/:id',
    loadComponent: () =>
      import('./pages/completion-process/completion-process.page').then(
        (m) => m.CompletionProcessPage
      ),
  },
  {
    path: 'serial-input/:id',
    loadComponent: () =>
      import('./pages/serial-input/serial-input.page').then(
        (m) => m.SerialInputPage
      ),
  },
  {
    path: 'waste-pickup/:id',
    loadComponent: () =>
      import('./pages/waste-pickup/waste-pickup.page').then(
        (m) => m.WastePickupPage
      ),
  },
  {
    path: 'certificate/:id',
    loadComponent: () =>
      import('./pages/completion-certificate/completion-certificate.page').then(
        (m) => m.CompletionCertificatePage
      ),
  },
];
