import {
  Component, inject, OnInit, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AlertService, AlertResponse
} from '../../../core/services/alert.service';
import { PatientSidebarComponent }
  from '../../../shared/components/patient-sidebar/patient-sidebar.component';

type FilterTab = 'ALL' | 'UNRESOLVED' | 'RESOLVED';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, PatientSidebarComponent],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.scss'
})
export class MessagesComponent implements OnInit {

  private alertService = inject(AlertService);

  allAlerts = signal<AlertResponse[]>([]);
  isLoading = signal<boolean>(false);
  errorMsg  = signal<string>('');
  activeTab = signal<FilterTab>('ALL');

  get unresolvedCount(): number {
    return this.allAlerts()
      .filter(a => !a.resolved).length;
  }

  filteredAlerts = computed(() => {
    const list = this.allAlerts();
    if (this.activeTab() === 'UNRESOLVED') {
      return list.filter(a => !a.resolved);
    }
    if (this.activeTab() === 'RESOLVED') {
      return list.filter(a => a.resolved);
    }
    return list;
  });

  ngOnInit(): void {
    this.loadAlerts();
  }

  loadAlerts(): void {
  this.isLoading.set(true);
  this.errorMsg.set('');

  this.alertService.getAllMyAlerts().subscribe({
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

  getAlertIcon(type: string): string {
    return type === 'INACTIVITY' ? '⏱️' : '📉';
  }

  getAlertLabel(type: string): string {
    return type === 'INACTIVITY'
      ? 'Inactivité détectée' : 'Score faible détecté';
  }

  getAlertExplanation(type: string): string {
    return type === 'INACTIVITY'
      ? 'Votre kinésithérapeute a remarqué que vous'
        + ' n\'avez pas fait de séance récemment.'
      : 'Votre kinésithérapeute a remarqué que votre'
        + ' score de conformité était bas sur vos'
        + ' dernières séances.';
  }
}