import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RehabPlanResponse {
  id: string;
  patientId: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | string;
  difficultyLevel: 'DEBUTANT' | 'INTERMEDIAIRE' | 'AVANCE';
  currentWeek: number;
}

export interface CreatePlanRequest {
  patientId: string;
  startDate: string;
}

@Injectable({
  providedIn: 'root'
})
export class RehabPlanService {

  private readonly API =
    'http://localhost:8080/api/v1/plans';
  private http = inject(HttpClient);

  generatePlan(
    request: CreatePlanRequest
  ): Observable<RehabPlanResponse> {
    return this.http.post<RehabPlanResponse>(
      `${this.API}`, request);
  }

  // ✅ Nouveau — plan actif du patient connecté
  getMyActivePlan(): Observable<RehabPlanResponse> {
    return this.http.get<RehabPlanResponse>(
      `${this.API}/my/active`);
    }
    
  getActivePlan(
    patientId: string
  ): Observable<RehabPlanResponse> {
    return this.http.get<RehabPlanResponse>(
      `${this.API}/patient/${patientId}/active`);
  }

  getAllPlans(
    patientId: string
  ): Observable<RehabPlanResponse[]> {
    return this.http.get<RehabPlanResponse[]>(
      `${this.API}/patient/${patientId}/history`);
  }
}