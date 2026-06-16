import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface KineResponse {
  id: string;
  fullName: string;
  speciality: string;
  validated: boolean;
  email: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {

  private readonly API = 'http://localhost:8080/api/v1/admin';
  private http = inject(HttpClient);

  // ── Kinés en attente ──────────────────────
  getPendingKines(): Observable<KineResponse[]> {
    return this.http.get<KineResponse[]>(
      `${this.API}/kine/pending`);
  }

  // ── Valider un kiné ───────────────────────
  validateKine(id: string): Observable<KineResponse> {
    return this.http.put<KineResponse>(
      `${this.API}/kine/${id}/validate`, {});
  }

  // ── Rejeter un kiné ───────────────────────
  rejectKine(id: string): Observable<void> {
    return this.http.put<void>(
      `${this.API}/kine/${id}/reject`, {});
  }
}