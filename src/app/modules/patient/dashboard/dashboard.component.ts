import { Component, inject, OnInit, signal }
  from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PatientService }
  from '../../../core/services/patient.service';
import { AuthService }
  from '../../../core/services/auth.service';
import { DashboardPatientResponse }
  from '../../../core/models/patient.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit {

  private patientService = inject(PatientService);
  private authService    = inject(AuthService);
  private router         = inject(Router);

  dashboard = signal<DashboardPatientResponse | null>(null);
  isLoading = signal<boolean>(false);
  errorMsg  = signal<string>('');

  get patientName(): string {
    return this.authService.getFullName() || 'Patient';
  }

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.isLoading.set(true);
    this.errorMsg.set('');

    this.patientService.getMyDashboard().subscribe({
      next: (data: DashboardPatientResponse) => {
        this.dashboard.set(data);
        this.isLoading.set(false);
      },
      error: (err: { message: string; status: number }) => {
        this.errorMsg.set(err.message || 'Erreur');
        this.isLoading.set(false);
      }
    });
  }

  // ── Badge label ───────────────────────────
  getBadgeLabel(type: string): string {
    const labels: Record<string, string> = {
      'FIRST_SESSION':    'Première séance',
      'SEVEN_DAYS':       '7 jours consécutifs',
      'FIFTY_REPS':       '50 répétitions',
      'PERFECT_SCORE':    'Score parfait',
      'WEEK_GOAL':        'Objectif semaine',
      'PROGRAM_COMPLETE': 'Programme complet'
    };
    return labels[type] || type;
  }

  // ── Level label ───────────────────────────
  getLevelLabel(level: string): string {
    const labels: Record<string, string> = {
      'DEBUTANT':      'Débutant',
      'INTERMEDIAIRE': 'Intermédiaire',
      'AVANCE':        'Avancé'
    };
    return labels[level] || level;
  }

  // ── Pathology label ───────────────────────
  getPathologyLabel(pathology: string): string {
    const labels: Record<string, string> = {
      'GENOU':  'Genou',
      'EPAULE': 'Épaule',
      'DOS':    'Dos',
      'HANCHE': 'Hanche',
      'COUDE':  'Coude'
    };
    return labels[pathology] || pathology;
  }

  // ── Session status label ──────────────────
  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'COMPLETED':   'Terminée',
      'INTERRUPTED': 'Interrompue',
      'IN_PROGRESS': 'En cours'
    };
    return labels[status] || status;
  }

  // ── Session status color ──────────────────
  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'COMPLETED':   'text-green-600 bg-green-50 dark:bg-green-950/40 dark:text-green-400',
      'INTERRUPTED': 'text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400',
      'IN_PROGRESS': 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400'
    };
    return colors[status] || '';
  }

  startSession(): void {
    this.router.navigate(['/patient/session']);
  }

  logout(): void {
    this.authService.logout();
  }
}