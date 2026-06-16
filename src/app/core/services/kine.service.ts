import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardKineResponse, AlertResponse }
  from '../models/kine.model';

@Injectable({
  providedIn: 'root'
})
export class KineService {

  private readonly API = 'http://localhost:8080/api/v1';
  private http = inject(HttpClient);

  // ── Dashboard kiné ────────────────────────
  getMyDashboard():
    Observable<DashboardKineResponse> {
    return this.http.get<DashboardKineResponse>(
      `${this.API}/dashboard/kine`);
  }

  // ── Résoudre une alerte ───────────────────
  resolveAlert(id: string): Observable<AlertResponse> {
    return this.http.put<AlertResponse>(
      `${this.API}/alerts/${id}/resolve`, {});
  }
}