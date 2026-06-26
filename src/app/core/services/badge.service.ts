import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface BadgeResponse {
  id: string;
  badgeType: 'FIRST_SESSION' | 'SEVEN_DAYS'
    | 'PERFECT_SCORE' | string;
  unlockedAt: string;
  displayed: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class BadgeService {

  private readonly API =
    'http://localhost:8080/api/v1/badges';
  private http = inject(HttpClient);

  getMyBadges(): Observable<BadgeResponse[]> {
    return this.http.get<BadgeResponse[]>(
      `${this.API}/my`);
  }

  countMyBadges(): Observable<number> {
    return this.http.get<number>(
      `${this.API}/my/count`);
  }

  markDisplayed(badgeId: string): Observable<void> {
    return this.http.put<void>(
      `${this.API}/${badgeId}/display`, {});
  }
}