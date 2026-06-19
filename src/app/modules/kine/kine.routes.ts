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
      import('../my_patients/my_patients.component')
        .then(c => c.my_PatientComponent)
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }
];