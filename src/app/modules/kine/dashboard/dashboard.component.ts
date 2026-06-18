import {
  Component, inject, OnInit, OnDestroy,
  signal, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { KineService }
  from '../../../core/services/kine.service';
import { AlertService }
  from '../../../core/services/alert.service';
import { AuthService }
  from '../../../core/services/auth.service';
import { DashboardKineResponse }
  from '../../../core/models/kine.model';
import { KineSidebarComponent }
  from '../../../shared/components/kine-sidebar/kine-sidebar.component';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, KineSidebarComponent, RouterLink
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent
  implements OnInit, OnDestroy {

  @ViewChild('alertsChart')
  alertsChartRef!: ElementRef<HTMLCanvasElement>;

  private kineService  = inject(KineService);
  private alertService = inject(AlertService);
  private authService  = inject(AuthService);

  dashboard   = signal<DashboardKineResponse | null>(null);
  isLoading   = signal<boolean>(false);
  errorMsg    = signal<string>('');
  searchQuery = signal<string>('');
  successMsg  = signal<string>('');

  private chart: Chart | null = null;

  get kineName(): string {
    return this.authService.getFullName() || 'Kiné';
  }
  getPathologyLabel(p: string): string {
  const labels: Record<string, string> = {
    'GENOU': 'Genou', 'EPAULE': 'Épaule',
    'DOS': 'Dos', 'HANCHE': 'Hanche',
    'COUDE': 'Coude'
  };
  return labels[p] || p;
}

  get firstName(): string {
    const full = this.kineName;
    return full.split(' ')[0] || full;
  }

  get filteredPatients() {
    const list = this.dashboard()?.patients ?? [];
    const q = this.searchQuery().toLowerCase();
    if (!q) return list;
    return list.filter(p =>
      p.fullName.toLowerCase().includes(q));
  }

  ngOnInit(): void {
    this.loadDashboard();
  }

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
      error: (err: { message: string }) => {
        this.errorMsg.set(err.message || 'Erreur');
        this.isLoading.set(false);
      }
    });
  }

  // ── Graphique répartition alertes ──────────
  private initChart(): void {
    if (!this.alertsChartRef?.nativeElement) return;
    this.chart?.destroy();

    const alerts = this.dashboard()?.recentAlerts ?? [];
    if (alerts.length === 0) return;

    const inactivity = alerts.filter(
  a => a.type === 'INACTIVITY').length;   
    const lowScore = alerts.filter(
  a => a.type === 'SCORE').length;    
    const resolved = alerts.filter(
      a => a.resolved).length;

    this.chart = new Chart(
      this.alertsChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Inactivité', 'Score faible', 'Résolues'],
        datasets: [{
          data: [inactivity, lowScore, resolved],
          backgroundColor: [
            'rgba(245, 158, 11, 0.9)',
            'rgba(239, 68, 68, 0.9)',
            'rgba(34, 197, 94, 0.9)'
          ],
          borderWidth: 0,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        cutout: '70%'
      }
    });
  }

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  resolveAlert(alertId: string): void {
    this.alertService.resolve(alertId).subscribe({
      next: () => {
        this.successMsg.set('Alerte résolue');
        this.dashboard.update(d => {
          if (!d) return d;
          return {
            ...d,
            pendingAlerts: Math.max(
              0, d.pendingAlerts - 1),
            recentAlerts: d.recentAlerts.map(a =>
              a.id === alertId
                ? { ...a, resolved: true } : a)
          };
        });
        setTimeout(() => this.successMsg.set(''), 3000);
        setTimeout(() => this.initChart(), 100);
      },
      error: (err: { message: string }) => {
        this.errorMsg.set(
          err.message || 'Erreur lors de la résolution');
      }
    });
  }

  getLevelLabel(level: string): string {
    const labels: Record<string, string> = {
      'DEBUTANT': 'Débutant',
      'INTERMEDIAIRE': 'Intermédiaire',
      'AVANCE': 'Avancé'
    };
    return labels[level] || level;
  }

  getLevelColor(level: string): string {
    const colors: Record<string, string> = {
      'DEBUTANT': 'text-green-700 bg-green-50',
      'INTERMEDIAIRE': 'text-blue-700 bg-blue-50',
      'AVANCE': 'text-purple-700 bg-purple-50'
    };
    return colors[level] || '';
  }

  getAlertIcon(type: string): string {
    return type === 'INACTIVITY' ? '⏱️' : '📉';
  }

  getAlertLabel(type: string): string {
    return type === 'INACTIVITY'
      ? 'Inactivité' : 'Score faible';
  }
}