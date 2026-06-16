import { Routes } from '@angular/router';

export const patientRoutes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component')
        .then(c => c.DashboardComponent)
  },
      {
    path: 'session',
    loadComponent: () =>
      import('./session/session')
        .then(c => c.SessionComponent)
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }
];
