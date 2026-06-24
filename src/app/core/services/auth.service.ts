import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse }
  from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError }
  from 'rxjs';
import {
  LoginRequest,
  RegisterPatientRequest,
  RegisterKineRequest,
  AuthResponse
} from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly API = 'http://localhost:8080/api/v1/auth';

  // ✅ inject() au lieu du constructeur
  private http   = inject(HttpClient);
  private router = inject(Router);

  // ── Connexion ──────────────────────────────
  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.API}/login`, request)
      .pipe(
        tap(response => this.saveSession(response)),
        // ✅ arrow function — this conservé
        catchError(error => this.handleError(error))
      );
  }

  // ── Inscription Patient ────────────────────
  registerPatient(
    request: RegisterPatientRequest
  ): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(
        `${this.API}/register/patient`, request)
      .pipe(
        tap(response => this.saveSession(response)),
        catchError(error => this.handleError(error))
      );
  }

  // ── Inscription Kiné ───────────────────────
  registerKine(
    request: RegisterKineRequest
  ): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(
        `${this.API}/register/kine`, request)
      .pipe(
        tap(response => this.saveSession(response)),
        catchError(error => this.handleError(error))
      );
  }

  // ── Déconnexion ────────────────────────────
  logout(): void {
    localStorage.clear();
    this.router.navigate(['/auth/login']);
  }

  // ── Sauvegarder session ────────────────────
  private saveSession(response: AuthResponse): void {
    localStorage.setItem('accessToken',
      response.accessToken);
    localStorage.setItem('refreshToken',
      response.refreshToken);
    localStorage.setItem('role',      response.role);
    localStorage.setItem('fullName',  response.fullName);
    localStorage.setItem('userId',    response.userId);
  }

  // ── Getters ────────────────────────────────
  getToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  getRole(): string | null {
    return localStorage.getItem('role');
  }

  getFullName(): string | null {
    return localStorage.getItem('fullName');
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  // ── Gestion erreurs typée ──────────────────
  private handleError(
    error: HttpErrorResponse
  ): Observable<never> {
    let message = 'Une erreur inattendue est survenue';

    if (error.status === 0) {
      message = 'Impossible de contacter le serveur';
    } else if (error.status === 401) {
      message = 'Email ou mot de passe incorrect';
    } else if (error.status === 400) {
      message = error.error?.message || 'Données invalides';
    } else if (error.status === 403) {
      message = error.error?.message
        || 'Compte en attente de validation';
    } else if (error.error?.message) {
      message = error.error.message;
    }

    return throwError(() => ({
      message,
      status: error.status
    }));
  }
}