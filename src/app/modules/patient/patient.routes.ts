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
      import('./session/session.component')
        .then(c => c.SessionComponent)
  },
 {
    path: 'progress',
    loadComponent: () =>
      import('./progress/progress.component')
        .then(c => c.ProgressComponent)
  },
   {
    path: 'messages',
    loadComponent: () =>
      import('./messages/messages.component')
        .then(c => c.MessagesComponent)
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./profile/profile.component')
        .then(c => c.ProfileComponent)
  },
  {
  path: 'badges',
  loadComponent: () =>
    import('./badges/badges.component')
      .then(c => c.BadgesComponent)
},
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }
];