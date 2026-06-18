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

  private adminService = inject(AdminService);
  private authService  = inject(AuthService);

  pendingKines = signal<KineResponse[]>([]);
  stats        = signal<AdminStatsResponse | null>(null);
  isLoading    = signal<boolean>(false);
  successMsg   = signal<string>('');
  errorMsg     = signal<string>('');

  private chart: Chart | null = null;

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
        setTimeout(() => this.initChart(), 100);
      },
      error: () => {
        // Dashboard reste fonctionnel sans stats
      }
    });
  }

  // ── Graphique répartition kinés ───────────
  private initChart(): void {
    if (!this.kinesChartRef?.nativeElement) return;
    this.chart?.destroy();

    const s = this.stats();
    if (!s) return;

    this.chart = new Chart(
      this.kinesChartRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: ['Validés', 'En attente'],
        datasets: [{
          data: [s.validatedKines, s.pendingKines],
          backgroundColor: [
            'rgba(34, 197, 94, 0.9)',
            'rgba(245, 158, 11, 0.9)'
          ],
          borderWidth: 0,
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
              font: { size: 12 },
              padding: 14,
              color: '#6b7280',
              usePointStyle: true,
              pointStyle: 'circle'
            }
          }
        },
        cutout: '70%'
      }
    });
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
        setTimeout(() => this.initChart(), 100);
      }
    });
  }
}