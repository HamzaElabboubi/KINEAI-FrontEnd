import {
  Component, inject, OnInit, OnDestroy,
  AfterViewInit, signal, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PatientService }
  from '../../../core/services/patient.service';
import { AuthService }
  from '../../../core/services/auth.service';
import { DashboardPatientResponse }
  from '../../../core/models/patient.model';
import { PatientSidebarComponent }
  from '../../../shared/components/patient-sidebar/patient-sidebar.component';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, PatientSidebarComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent
  implements OnInit, OnDestroy, AfterViewInit {

  @ViewChild('progressChart')
  progressChartRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild('skillsChart')
  skillsChartRef!: ElementRef<HTMLCanvasElement>;

  private patientService = inject(PatientService);
  private authService    = inject(AuthService);
  private router         = inject(Router);

  dashboard = signal<DashboardPatientResponse | null>(null);
  isLoading = signal<boolean>(false);
  errorMsg  = signal<string>('');

  private progressChart: Chart | null = null;
  private skillsChart: Chart | null = null;

  get patientName(): string {
    return this.authService.getFullName() || 'Patient';
  }

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.progressChart?.destroy();
    this.skillsChart?.destroy();
  }

  loadDashboard(retry = true): void {
    this.isLoading.set(true);
    this.errorMsg.set('');

    this.patientService.getMyDashboard().subscribe({
      next: (data: DashboardPatientResponse) => {
        // ✅ Le backend répond parfois 200 avec un corps
        // vide juste après la complétion d'une séance
        // (recalcul des stats pas encore disponible) —
        // on retente une fois avant d'abandonner.
        if (!data) {
          if (retry) {
            setTimeout(() => this.loadDashboard(false), 600);
            return;
          }
          this.errorMsg.set(
            'Impossible de charger vos statistiques.'
            + ' Veuillez réessayer dans quelques instants.');
          this.isLoading.set(false);
          return;
        }
        this.dashboard.set(data);
        this.isLoading.set(false);
        setTimeout(() => {
          this.initProgressChart();
          this.initSkillsChart();
        }, 100);
      },
      error: (err: { message: string }) => {
        this.errorMsg.set(err.message || 'Erreur');
        this.isLoading.set(false);
      }
    });
  }

  // ── Graphique progression — 7 derniers jours ──
 private initProgressChart(): void {
  if (!this.progressChartRef?.nativeElement) return;
  this.progressChart?.destroy();

  const sessions = (this.dashboard()
    ?.recentSessions ?? [])
    .filter(s => s.status === 'COMPLETED')
    .sort((a, b) =>
      new Date(a.startTime).getTime()
      - new Date(b.startTime).getTime());

  // ✅ Affiche les VRAIES séances complétées,
  // pas une grille de 7 jours civils dont la
  // majorité serait vide par construction
  const labels = sessions.map(s =>
    new Date(s.startTime).toLocaleDateString(
      'fr-FR', { day: '2-digit', month: '2-digit' }));
  const scores = sessions.map(s =>
    Number(s.score ?? 0));

  if (sessions.length === 0) {
    // Pas de séance du tout — on ne dessine rien,
    // un message dédié prend le relais (voir HTML)
    return;
  }

  this.progressChart = new Chart(
    this.progressChartRef.nativeElement, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: scores,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          min: 0, max: 100,
          grid: { color: '#f3f4f6' },
          ticks: { color: '#9ca3af', font: { size: 11 } }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af', font: { size: 11 } }
        }
      }
    }
  });
}

  // ── Donut répartition zones travaillées ────────
  private initSkillsChart(): void {
    if (!this.skillsChartRef?.nativeElement) return;
    this.skillsChart?.destroy();

    const avg = this.dashboard()?.averageScore ?? 0;

    this.skillsChart = new Chart(
      this.skillsChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Mobilité', 'Force', 'Endurance',
          'Précision'],
        datasets: [{
          data: [90, 80, 85, 85],
          backgroundColor: [
            'rgba(59, 130, 246, 0.9)',
            'rgba(34, 197, 94, 0.9)',
            'rgba(245, 158, 11, 0.9)',
            'rgba(168, 85, 247, 0.9)'
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        cutout: '72%'
      }
    });
  }

  getPathologyLabel(p: string): string {
    const labels: Record<string, string> = {
      'GENOU': 'Genou', 'EPAULE': 'Épaule',
      'DOS': 'Dos', 'HANCHE': 'Hanche', 'COUDE': 'Coude'
    };
    return labels[p] || p;
  }

  getLevelLabel(l: string): string {
    const labels: Record<string, string> = {
      'DEBUTANT': 'Débutant',
      'INTERMEDIAIRE': 'Intermédiaire',
      'AVANCE': 'Avancé'
    };
    return labels[l] || l;
  }

  getStatusLabel(s: string): string {
    const labels: Record<string, string> = {
      'COMPLETED': 'Terminée',
      'INTERRUPTED': 'Interrompue',
      'IN_PROGRESS': 'En cours'
    };
    return labels[s] || s;
  }

  startSession(): void {
    this.router.navigate(['/patient/session']);
  }
}