import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CreateSessionRequest,
  SaveMetricsRequest,
  CompleteSessionRequest,
  SessionResponse
} from '../models/session.model';

@Injectable({ providedIn: 'root' })
export class SessionService {

  private readonly API =
    'http://localhost:8080/api/v1/sessions';
  private http = inject(HttpClient);

  start(req: CreateSessionRequest):
    Observable<SessionResponse> {
    return this.http.post<SessionResponse>(
      `${this.API}/start`, req);
  }

  saveMetrics(
    sessionId: string,
    req: SaveMetricsRequest
  ): Observable<void> {
    return this.http.post<void>(
      `${this.API}/${sessionId}/metrics`, req);
  }

  complete(
    sessionId: string,
    req: CompleteSessionRequest
  ): Observable<SessionResponse> {
    return this.http.post<SessionResponse>(
      `${this.API}/${sessionId}/complete`, req);
  }

  interrupt(sessionId: string):
    Observable<SessionResponse> {
    return this.http.post<SessionResponse>(
      `${this.API}/${sessionId}/interrupt`, {});
  }
  getMyHistory(): Observable<SessionResponse[]> {
  return this.http.get<SessionResponse[]>(
    `${this.API}/my`);
}
}