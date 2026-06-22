import {
  Component, inject, OnInit, OnDestroy,
  AfterViewInit, signal, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AdminService, KineResponse, AdminStatsResponse
} from '../../../core/services/admin.service';
import { AuthService }
  from '../../../core/services/auth.service';
import { AdminSidebarComponent }
  from '../../../shared/components/admin-sidebar/admin-sidebar.component';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, AdminSidebarComponent, RouterLink
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent
  implements OnInit, OnDestroy, AfterViewInit {

  @ViewChild('kinesChart')
  kinesChartRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild('levelChart')
  levelChartRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild('pathologyChart')
  pathologyChartRef!: ElementRef<HTMLCanvasElement>;
  
  @ViewChild('specialityChart')
   specialityChartRef!: ElementRef<HTMLCanvasElement>;

  private specialityChart: Chart | null = null;

  private adminService = inject(AdminService);
  private authService  = inject(AuthService);

  pendingKines = signal<KineResponse[]>([]);
  stats        = signal<AdminStatsResponse | null>(null);
  isLoading    = signal<boolean>(false);
  successMsg   = signal<string>('');
  errorMsg     = signal<string>('');

  private chart: Chart | null = null;
  private levelChart: Chart | null = null;
  private pathologyChart: Chart | null = null;

  get adminName(): string {
    return this.authService.getFullName()
      || 'Administrateur';
  }

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.levelChart?.destroy();
    this.pathologyChart?.destroy();
    this.specialityChart?.destroy();
  }

  loadDashboard(): void {
    this.isLoading.set(true);
    this.errorMsg.set('');

    this.adminService.getPendingKines().subscribe({
      next: (kines: KineResponse[]) => {
        this.pendingKines.set(kines);
        this.isLoading.set(false);
      },
      error: (err: { message: string }) => {
        this.errorMsg.set(err.message || 'Erreur');
        this.isLoading.set(false);
      }
    });

    this.adminService.getStats().subscribe({
      next: (s: AdminStatsResponse) => {
        this.stats.set(s);
        setTimeout(() => {
          this.initChart();
          this.initLevelChart();
          this.initPathologyChart();
          this.initSpecialityChart();
        }, 100);
      },
      error: () => {}
    });
  }

  private initChart(): void {
    if (!this.kinesChartRef?.nativeElement) return;
    this.chart?.destroy();

    const validated = this.stats()?.validatedKines ?? 0;
    const pending = this.stats()?.pendingKines ?? 0;
    const total = validated + pending;
    if (total === 0) return;

    this.chart = new Chart(
      this.kinesChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Validés', 'En attente'],
        datasets: [{
          data: [validated, pending],
          backgroundColor: [
            'rgba(34, 197, 94, 0.85)',
            'rgba(245, 158, 11, 0.85)'
          ],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        cutout: '65%'
      }
    });
  }

  // ── Kinés par spécialité (donut) ─────────────────
private initSpecialityChart(): void {
  if (!this.specialityChartRef?.nativeElement) return;
  this.specialityChart?.destroy();

  const data = this.stats()?.kinesBySpeciality ?? {};
  const labels = Object.keys(data);
  const values = Object.values(data);

  if (labels.length === 0) return;

  this.specialityChart = new Chart(
    this.specialityChartRef.nativeElement, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: [
          'rgba(59, 130, 246, 0.85)',
          'rgba(34, 197, 94, 0.85)',
          'rgba(245, 158, 11, 0.85)',
          'rgba(168, 85, 247, 0.85)',
          'rgba(236, 72, 153, 0.85)',
          'rgba(20, 184, 166, 0.85)'
        ],
        borderWidth: 0
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
            padding: 10,
            usePointStyle: true,
            pointStyle: 'circle'
          }
        }
      },
      cutout: '65%'
    }
  });
}

  private initLevelChart(): void {
    if (!this.levelChartRef?.nativeElement) return;
    this.levelChart?.destroy();

    const data = this.stats()?.patientsByLevel ?? {};
    const labels = Object.keys(data).map(k =>
      this.getLevelLabel(k));
    const values = Object.values(data);

    this.levelChart = new Chart(
      this.levelChartRef.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: [
            'rgba(34, 197, 94, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(168, 85, 247, 0.8)'
          ],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 },
            grid: { color: '#f3f4f6' }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  private initPathologyChart(): void {
    if (!this.pathologyChartRef?.nativeElement) return;
    this.pathologyChart?.destroy();

    const data = this.stats()?.patientsByPathology ?? {};
    const labels = Object.keys(data).map(k =>
      this.getPathologyLabel(k));
    const values = Object.values(data);

    this.pathologyChart = new Chart(
      this.pathologyChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: [
            'rgba(59, 130, 246, 0.85)',
            'rgba(34, 197, 94, 0.85)',
            'rgba(245, 158, 11, 0.85)',
            'rgba(168, 85, 247, 0.85)',
            'rgba(236, 72, 153, 0.85)'
          ],
          borderWidth: 0
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
              padding: 10,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          }
        },
        cutout: '65%'
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

  getPathologyLabel(p: string): string {
    const labels: Record<string, string> = {
      'GENOU': 'Genou', 'EPAULE': 'Épaule',
      'DOS': 'Dos', 'HANCHE': 'Hanche',
      'COUDE': 'Coude'
    };
    return labels[p] || p;
  }

  validateKine(id: string, name: string): void {
    this.adminService.validateKine(id).subscribe({
      next: () => {
        this.successMsg.set(
          `Dr. ${name} validé avec succès`);
        this.pendingKines.set(
          this.pendingKines().filter(k => k.id !== id));
        this.refreshStatsOnly();
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err: { message: string }) => {
        this.errorMsg.set(
          err.message || 'Erreur lors de la validation');
      }
    });
  }

  rejectKine(id: string, name: string): void {
    this.adminService.rejectKine(id).subscribe({
      next: () => {
        this.successMsg.set(`Dr. ${name} rejeté`);
        this.pendingKines.set(
          this.pendingKines().filter(k => k.id !== id));
        this.refreshStatsOnly();
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err: { message: string }) => {
        this.errorMsg.set(
          err.message || 'Erreur lors du rejet');
      }
    });
  }

 private refreshStatsOnly(): void {
  this.adminService.getStats().subscribe({
    next: (s: AdminStatsResponse) => {
      this.stats.set(s);
      setTimeout(() => {
        this.initChart();
        this.initLevelChart();
        this.initPathologyChart();
        this.initSpecialityChart();
      }, 100);
    }
  });
 }}