import { Routes } from '@angular/router';
import { patientGuard }
  from './core/guards/patient.guard';
import { kineGuard }
  from './core/guards/kine.guard';
import { adminGuard }
  from './core/guards/admin.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./modules/auth/auth.routes')
        .then(r => r.authRoutes)
  },
  {
    path: 'patient',
    canActivate: [patientGuard],
    loadChildren: () =>
      import('./modules/patient/patient.routes')
        .then(r => r.patientRoutes)
  },
  {
    path: 'kine',
    canActivate: [kineGuard],
    loadChildren: () =>
      import('./modules/kine/kine.routes')
        .then(r => r.kineRoutes)
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadChildren: () =>
      import('./modules/admin/admin.routes')
        .then(r => r.adminRoutes)
  },
  {
    path: '**',
    redirectTo: 'auth/login'
  }
];