import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component')
        .then(c => c.DashboardComponent)
  },
   {
    path: 'kines',
    loadComponent: () =>
      import('./kines/kines.component')
        .then(c => c.KinesComponent)
  },
  {
    path: 'patients',
    loadComponent: () =>
      import('./patients/patients.component')
        .then(c => c.PatientsComponent)
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }
];