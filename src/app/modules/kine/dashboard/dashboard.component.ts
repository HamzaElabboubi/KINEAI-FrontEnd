import { Component, inject, OnInit, OnDestroy,
         signal, AfterViewInit, ElementRef,
         ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { KineService }
  from '../../../core/services/kine.service';
import { AuthService }
  from '../../../core/services/auth.service';
import { DashboardKineResponse, AlertResponse }
  from '../../../core/models/kine.model';
import { PatientResponse }
  from '../../../core/models/patient.model';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent
  implements OnInit, OnDestroy, AfterViewInit {

  @ViewChild('alertsChart')
  alertsChartRef!: ElementRef<HTMLCanvasElement>;

  private kineService = inject(KineService);
  private authService = inject(AuthService);
  private router      = inject(Router);

  dashboard   = signal<DashboardKineResponse | null>(null);
  isLoading   = signal<boolean>(false);
  errorMsg    = signal<string>('');
  successMsg  = signal<string>('');
  activeTab   = signal<'patients' | 'alerts'>('patients');
  searchQuery = signal<string>('');

  private chart: Chart | null = null;

  get kineName(): string {
    return this.authService.getFullName()
      || 'Kinésithérapeute';
  }

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  loadDashboard(): void {
    this.isLoading.set(true);
    this.errorMsg.set('');

    this.kineService.getMyDashboard().subscribe({
      next: (data: DashboardKineResponse) => {
        this.dashboard.set(data);
        this.isLoading.set(false);
        setTimeout(() => this.initChart(), 100);
      },
      error: (err: { message: string; status: number }) => {
        this.errorMsg.set(err.message || 'Erreur');
        this.isLoading.set(false);
      }
    });
  }

  private initChart(): void {
    if (!this.alertsChartRef?.nativeElement) return;
    this.chart?.destroy();

    const inactivity = this.dashboard()
      ?.recentAlerts
      .filter(a => a.type === 'INACTIVITY').length ?? 0;
    const score = this.dashboard()
      ?.recentAlerts
      .filter(a => a.type === 'SCORE').length ?? 0;
    const resolved = this.dashboard()
      ?.recentAlerts
      .filter(a => a.resolved).length ?? 0;

    this.chart = new Chart(
      this.alertsChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Inactivité', 'Score faible', 'Résolues'],
        datasets: [{
          data: [inactivity, score, resolved],
          backgroundColor: [
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(34, 197, 94, 0.8)'
          ],
          borderColor: [
            'rgba(245, 158, 11, 1)',
            'rgba(239, 68, 68, 1)',
            'rgba(34, 197, 94, 1)'
          ],
          borderWidth: 1,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { size: 11 },
              padding: 12,
              color: '#94a3b8'
            }
          }
        },
        cutout: '70%'
      }
    });
  }

  resolveAlert(id: string): void {
    this.kineService.resolveAlert(id).subscribe({
      next: () => {
        this.successMsg.set('Alerte résolue');
        const d = this.dashboard();
        if (d) {
          this.dashboard.set({
            ...d,
            pendingAlerts: d.pendingAlerts - 1,
            recentAlerts: d.recentAlerts.map(a =>
              a.id === id ? { ...a, resolved: true } : a)
          });
          setTimeout(() => this.initChart(), 100);
        }
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err: { message: string; status: number }) => {
        this.errorMsg.set(err.message || 'Erreur');
      }
    });
  }

  viewPatient(patientId: string): void {
    this.router.navigate(['/kine/patients', patientId]);
  }

  get filteredPatients(): PatientResponse[] {
    const patients = this.dashboard()?.patients ?? [];
    const q = this.searchQuery().toLowerCase();
    if (!q) return patients;
    return patients.filter(p =>
      p.fullName.toLowerCase().includes(q));
  }

  get unresolvedAlerts(): AlertResponse[] {
    return this.dashboard()?.recentAlerts
      .filter(a => !a.resolved) ?? [];
  }

  getLevelLabel(level: string): string {
    const labels: Record<string, string> = {
      'DEBUTANT':      'Débutant',
      'INTERMEDIAIRE': 'Intermédiaire',
      'AVANCE':        'Avancé'
    };
    return labels[level] || level;
  }

  getLevelColor(level: string): string {
    const colors: Record<string, string> = {
      'DEBUTANT':      'text-green-700 bg-green-50 dark:bg-green-950/40 dark:text-green-400',
      'INTERMEDIAIRE': 'text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400',
      'AVANCE':        'text-purple-700 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-400'
    };
    return colors[level] || '';
  }

  getAlertTypeLabel(type: string): string {
    return type === 'INACTIVITY'
      ? 'Inactivité' : 'Score faible';
  }

  getAlertTypeColor(type: string): string {
    return type === 'INACTIVITY'
      ? 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900'
      : 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900';
  }

  getProgressColor(value: number): string {
    if (value >= 80) return 'bg-green-500';
    if (value >= 60) return 'bg-blue-500';
    if (value >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  }

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  logout(): void {
    this.authService.logout();
  }
}