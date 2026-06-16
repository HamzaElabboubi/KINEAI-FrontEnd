import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardPatientResponse }
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
}