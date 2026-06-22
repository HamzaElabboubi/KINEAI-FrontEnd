import {
  Component, inject, OnInit, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AlertService, AlertResponse
} from '../../../core/services/alert.service';
import { KineSidebarComponent }
  from '../../../shared/components/kine-sidebar/kine-sidebar.component';

type FilterTab = 'ALL' | 'UNRESOLVED' | 'RESOLVED';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, KineSidebarComponent],
  templateUrl: './alerts.component.html',
  styleUrl: './alerts.component.scss'
})
export class AlertsComponent implements OnInit {

  private alertService = inject(AlertService);

  allAlerts   = signal<AlertResponse[]>([]);
  isLoading   = signal<boolean>(false);
  errorMsg    = signal<string>('');
  successMsg  = signal<string>('');
  activeTab   = signal<FilterTab>('UNRESOLVED');
  searchQuery = signal<string>('');

  get unresolvedCount(): number {
    return this.allAlerts()
      .filter(a => !a.resolved).length;
  }

  filteredAlerts = computed(() => {
    let list = this.allAlerts();

    if (this.activeTab() === 'UNRESOLVED') {
      list = list.filter(a => !a.resolved);
    } else if (this.activeTab() === 'RESOLVED') {
      list = list.filter(a => a.resolved);
    }

    const q = this.searchQuery().toLowerCase();
    if (q) {
      list = list.filter(a =>
        a.patientName.toLowerCase().includes(q));
    }

    return list;
  });

  ngOnInit(): void {
    this.loadAlerts();
  }

  loadAlerts(): void {
    this.isLoading.set(true);
    this.errorMsg.set('');

    this.alertService.getMyAlerts().subscribe({
      next: (alerts: AlertResponse[]) => {
        this.allAlerts.set(alerts);
        this.isLoading.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.errorMsg.set(
          err.error?.message
          || 'Impossible de charger les alertes');
        this.isLoading.set(false);
      }
    });
  }

  setTab(tab: FilterTab): void {
    this.activeTab.set(tab);
  }

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  resolveAlert(alertId: string, patientName: string): void {
    this.alertService.resolve(alertId).subscribe({
      next: () => {
        this.allAlerts.update(list =>
          list.map(a => a.id === alertId
            ? { ...a, resolved: true } : a));
        this.successMsg.set(
          `Alerte de ${patientName} résolue`);
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err: { error?: { message?: string } }) => {
        this.errorMsg.set(
          err.error?.message
          || 'Erreur lors de la résolution');
      }
    });
  }

  getAlertIcon(type: string): string {
    return type === 'INACTIVITY' ? '⏱️' : '📉';
  }

  getAlertLabel(type: string): string {
    return type === 'INACTIVITY'
      ? 'Inactivité' : 'Score faible';
  }
}