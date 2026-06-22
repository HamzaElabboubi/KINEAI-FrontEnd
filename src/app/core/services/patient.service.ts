import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardPatientResponse, PatientResponse }
  from '../models/patient.model';

@Injectable({
  providedIn: 'root'
})
export class PatientService {

  private readonly API = 'http://localhost:8080/api/v1';
  private http = inject(HttpClient);

  // ── Dashboard patient connecté ─────────────
  getMyDashboard():
    Observable<DashboardPatientResponse> {
    return this.http.get<DashboardPatientResponse>(
      `${this.API}/dashboard/patient`);
  }
  // ── Mon profil complet ─────────────────────
getMyProfile(): Observable<PatientResponse> {
  return this.http.get<PatientResponse>(
    `${this.API}/patient/profile`);
}

// ── Patients du kiné connecté ──────────────
getMyPatients(): Observable<PatientResponse[]> {
  return this.http.get<PatientResponse[]>(
    `${this.API}/kine/patients`);
}

updateMyProfile(
  request: { fullName: string; age: number }
): Observable<PatientResponse> {
  return this.http.put<PatientResponse>(
    `${this.API}/patient/profile`, request);
}
}