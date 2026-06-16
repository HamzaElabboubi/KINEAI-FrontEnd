import { Routes } from '@angular/router';

export const kineRoutes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component')
        .then(c => c.DashboardComponent)
  },
  {
    path: 'patients',
    loadComponent: () =>
      import('../patients/patients.component')
        .then(c => c.PatientsComponent)
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }
];