import {
  Component, inject, OnInit, OnDestroy,
  signal, computed, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionService }
  from '../../../core/services/session.service';
import { SessionResponse }
  from '../../../core/models/session.model';
import { PatientSidebarComponent }
  from '../../../shared/components/patient-sidebar/patient-sidebar.component';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [CommonModule, PatientSidebarComponent],
  templateUrl: './progress.component.html',
  styleUrl: './progress.component.scss'
})
export class ProgressComponent
  implements OnInit, OnDestroy {

  @ViewChild('scoreChart')
  scoreChartRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild('exerciseChart')
  exerciseChartRef!: ElementRef<HTMLCanvasElement>;

  private sessionService = inject(SessionService);

  allSessions = signal<SessionResponse[]>([]);
  isLoading   = signal<boolean>(false);
  errorMsg    = signal<string>('');
  periodFilter = signal<'7' | '30' | 'all'>('30');

  private scoreChart: Chart | null = null;
  private exerciseChart: Chart | null = null;

  // ── Sessions filtrées par période ──────────
  filteredSessions = computed(() => {
    const sessions = this.allSessions()
      .filter(s => s.status === 'COMPLETED')
      .sort((a, b) =>
        new Date(a.startTime).getTime()
        - new Date(b.startTime).getTime());

    const period = this.periodFilter();
    if (period === 'all') return sessions;

    const days = period === '7' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return sessions.filter(s =>
      new Date(s.startTime) >= cutoff);
  });

  // ── KPIs calculés ───────────────────────────
  get totalSessions(): number {
    return this.filteredSessions().length;
  }

  get averageScore(): number {
    const sessions = this.filteredSessions();
    if (sessions.length === 0) return 0;
    const sum = sessions.reduce(
      (acc, s) => acc + Number(s.score ?? 0), 0);
    return Math.round(sum / sessions.length);
  }

  get totalXp(): number {
    return this.filteredSessions().reduce(
      (acc, s) => acc + (s.xpEarned ?? 0), 0);
  }

  get totalReps(): number {
    return this.filteredSessions().reduce(
      (acc, s) => acc + (s.repsCompleted ?? 0), 0);
  }

  // ── Répartition par exercice ────────────────
  get exerciseBreakdown(): Map<string, number> {
    const map = new Map<string, number>();
    this.filteredSessions().forEach(s => {
      const name = s.exerciseName || 'Inconnu';
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return map;
  }

  ngOnInit(): void {
    this.loadHistory();
  }

  ngOnDestroy(): void {
    this.scoreChart?.destroy();
    this.exerciseChart?.destroy();
  }

  loadHistory(): void {
    this.isLoading.set(true);
    this.errorMsg.set('');

    this.sessionService.getMyHistory().subscribe({
      next: (sessions: SessionResponse[]) => {
        this.allSessions.set(sessions);
        this.isLoading.set(false);
        setTimeout(() => {
          this.initScoreChart();
          this.initExerciseChart();
        }, 100);
      },
      error: (err: { message: string }) => {
        this.errorMsg.set(
          err.message || 'Erreur de chargement');
        this.isLoading.set(false);
      }
    });
  }

  setPeriod(period: '7' | '30' | 'all'): void {
    this.periodFilter.set(period);
    setTimeout(() => {
      this.initScoreChart();
      this.initExerciseChart();
    }, 50);
  }

  // ── Courbe de progression du score ──────────
  private initScoreChart(): void {
    if (!this.scoreChartRef?.nativeElement) return;
    this.scoreChart?.destroy();

    const sessions = this.filteredSessions();
    if (sessions.length === 0) return;

    const labels = sessions.map(s =>
      new Date(s.startTime).toLocaleDateString(
        'fr-FR', { day: '2-digit', month: '2-digit' }));
    const scores = sessions.map(s => Number(s.score ?? 0));

    this.scoreChart = new Chart(
      this.scoreChartRef.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Score',
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
            ticks: {
              color: '#9ca3af', font: { size: 11 }
            }
          },
          x: {
            grid: { display: false },
            ticks: {
              color: '#9ca3af', font: { size: 11 },
              maxRotation: 0
            }
          }
        }
      }
    });
  }

  // ── Répartition par exercice (barres) ───────
  private initExerciseChart(): void {
    if (!this.exerciseChartRef?.nativeElement) return;
    this.exerciseChart?.destroy();

    const breakdown = this.exerciseBreakdown;
    if (breakdown.size === 0) return;

    const labels = Array.from(breakdown.keys());
    const values = Array.from(breakdown.values());

    this.exerciseChart = new Chart(
      this.exerciseChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: 'rgba(99, 102, 241, 0.8)',
          borderRadius: 6,
          barThickness: 18
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { stepSize: 1, color: '#9ca3af' },
            grid: { color: '#f3f4f6' }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#6b7280', font: { size: 11 } }
          }
        }
      }
    });
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'COMPLETED': 'Terminée',
      'INTERRUPTED': 'Interrompue',
      'IN_PROGRESS': 'En cours'
    };
    return labels[status] || status;
  }
}