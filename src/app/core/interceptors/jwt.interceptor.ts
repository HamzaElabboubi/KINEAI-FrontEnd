import { HttpInterceptorFn,
         HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
// ✅ Chemin correct
import { AuthService }
  from '../services/auth.service';
import { Router } from '@angular/router';

export const jwtInterceptor: HttpInterceptorFn =
  (req, next) => {
    const auth   = inject(AuthService);
    const router = inject(Router);
    const token  = auth.getToken();

    // ✅ Exclure les requêtes auth du token
    const isAuthRequest = req.url.includes('/auth/');
    const isPublicRequest = req.url.includes(
      '/kine/validated');

    const authReq = (token && !isAuthRequest
                     && !isPublicRequest)
      ? req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        })
      : req;

    return next(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // ✅ Ne pas rediriger sur les routes auth
        if (error.status === 401
            && !req.url.includes('/auth/')) {
          auth.logout();
          router.navigate(['/auth/login']);
        }
        return throwError(() => ({
          message: error.error?.message
            || 'Erreur inattendue',
          status: error.status
        }));
      })
    );
  };