import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ExerciseResponse }
  from '../models/session.model';

@Injectable({ providedIn: 'root' })
export class ExerciseService {

  private readonly API =
    'http://localhost:8080/api/v1/exercises';
  private http = inject(HttpClient);

  getAll(): Observable<ExerciseResponse[]> {
    return this.http.get<ExerciseResponse[]>(this.API);
  }

  getByBodyZone(zone: string):
    Observable<ExerciseResponse[]> {
    return this.http.get<ExerciseResponse[]>(
      `${this.API}/zone/${zone}`);
  }

  // ✅ Nouvelle méthode pour le patient connecté
getMyExercises(): Observable<ExerciseResponse[]> {
    return this.http.get<ExerciseResponse[]>(
        `${this.API}/my`);
}
}