import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PatientResponse }
  from '../models/patient.model';

export interface KineResponse {
  id: string;
  fullName: string;
  speciality: string;
  validated: boolean;
  patientCount: number;
  email: string;
  active: boolean;
}

export interface AdminStatsResponse {
  totalPatients: number;
  totalKines: number;
  validatedKines: number;
  pendingKines: number;
  patientsByLevel: Record<string, number>;
  patientsByPathology: Record<string, number>;
  kinesBySpeciality: Record<string, number>;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {

  private readonly API = 'http://localhost:8080/api/v1/admin';
  private http = inject(HttpClient);

  // ── Statistiques globales ─────────────────
  getStats(): Observable<AdminStatsResponse> {
    return this.http.get<AdminStatsResponse>(
      `${this.API}/stats`);
  }

  // ── Kinés en attente ──────────────────────
  getPendingKines(): Observable<KineResponse[]> {
    return this.http.get<KineResponse[]>(
      `${this.API}/kine/pending`);
  }

  // ── Tous les kinés ─────────────────────────
  getAllKines(): Observable<KineResponse[]> {
    return this.http.get<KineResponse[]>(
      `${this.API}/kines`);
  }

  // ── Tous les patients ──────────────────────
  getAllPatients(): Observable<PatientResponse[]> {
    return this.http.get<PatientResponse[]>(
      `${this.API}/patients`);
  }

  // ── Valider un kiné ────────────────────────
  validateKine(id: string): Observable<KineResponse> {
    return this.http.put<KineResponse>(
      `${this.API}/kine/${id}/validate`, {});
  }

  // ── Rejeter un kiné ────────────────────────
  rejectKine(id: string): Observable<void> {
    return this.http.put<void>(
      `${this.API}/kine/${id}/reject`, {});
  }

  // ── Supprimer un kiné ──────────────────────
  deleteKine(id: string): Observable<void> {
    return this.http.delete<void>(
      `${this.API}/kine/${id}`);
  }

  // ── Désactiver un kiné ─────────────────────
  deactivateKine(id: string): Observable<KineResponse> {
    return this.http.put<KineResponse>(
      `${this.API}/kine/${id}/deactivate`, {});
  }

  // ── Réactiver un kiné ──────────────────────
  activateKine(id: string): Observable<KineResponse> {
    return this.http.put<KineResponse>(
      `${this.API}/kine/${id}/activate`, {});
  }

  // ── Archiver un patient ────────────────────
  archivePatient(id: string): Observable<void> {
    return this.http.delete<void>(
      `http://localhost:8080/api/v1/admin/patients/${id}`);
  }

  // ── Réactiver un patient ───────────────────
  reactivatePatient(
    id: string
  ): Observable<PatientResponse> {
    return this.http.put<PatientResponse>(
      `${this.API}/patients/${id}/reactivate`, {});
  }

  reassignKine(
  patientId: string, newKineId: string
): Observable<PatientResponse> {
  return this.http.put<PatientResponse>(
    `${this.API}/patients/${patientId}/reassign`
    + `?newKineId=${newKineId}`, {});
}
}