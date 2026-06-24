import {
  Component, inject, OnInit, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AdminService, KineResponse
} from '../../../core/services/admin.service';
import { AdminSidebarComponent }
  from '../../../shared/components/admin-sidebar/admin-sidebar.component';

type FilterTab = 'ALL' | 'VALIDATED' | 'PENDING';

@Component({
  selector: 'app-kines',
  standalone: true,
  imports: [CommonModule, AdminSidebarComponent],
  templateUrl: './kines.component.html',
  styleUrl: './kines.component.scss'
})
export class KinesComponent implements OnInit {

  private adminService = inject(AdminService);

  allKines    = signal<KineResponse[]>([]);
  isLoading   = signal<boolean>(false);
  successMsg  = signal<string>('');
  errorMsg    = signal<string>('');
  searchQuery = signal<string>('');
  activeTab   = signal<FilterTab>('ALL');

  // ── Modale suppression ────────────────────
  confirmDeleteId = signal<string | null>(null);

  // ── Modale désactivation ──────────────────
  confirmDeactivateId   = signal<string | null>(null);
  confirmDeactivateName = signal<string>('');

  get pendingCount(): number {
    return this.allKines().filter(k => !k.validated).length;
  }

  filteredKines = computed(() => {
    let list = this.allKines();

    if (this.activeTab() === 'VALIDATED') {
      list = list.filter(k => k.validated);
    } else if (this.activeTab() === 'PENDING') {
      list = list.filter(k => !k.validated);
    }

    const q = this.searchQuery().toLowerCase();
    if (q) {
      list = list.filter(k =>
        k.fullName.toLowerCase().includes(q)
        || k.email.toLowerCase().includes(q)
        || k.speciality.toLowerCase().includes(q));
    }

    return list;
  });

  ngOnInit(): void {
    this.loadKines();
  }

  loadKines(): void {
    this.isLoading.set(true);
    this.errorMsg.set('');

    this.adminService.getAllKines().subscribe({
      next: (kines: KineResponse[]) => {
        this.allKines.set(kines);
        this.isLoading.set(false);
      },
      error: (err: { message?: string }) => {
        this.errorMsg.set(err.message || 'Erreur');
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

  // ══════════════════════════════════════════
  // VALIDATION / REJET (kinés en attente)
  // ══════════════════════════════════════════
  validateKine(id: string, name: string): void {
    this.adminService.validateKine(id).subscribe({
      next: () => {
        this.successMsg.set(
          `Dr. ${name} validé avec succès`);
        this.allKines.update(list =>
          list.map(k => k.id === id
            ? { ...k, validated: true, active: true }
            : k));
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err: { message?: string }) => {
        this.errorMsg.set(
          err.message || 'Erreur lors de la validation');
      }
    });
  }

  rejectKine(id: string, name: string): void {
    this.adminService.rejectKine(id).subscribe({
      next: () => {
        this.successMsg.set(`Dr. ${name} rejeté`);
        this.allKines.update(list =>
          list.filter(k => k.id !== id));
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err: { message?: string }) => {
        this.errorMsg.set(
          err.message || 'Erreur lors du rejet');
      }
    });
  }

  // ══════════════════════════════════════════
  // DÉSACTIVATION / RÉACTIVATION (kinés validés)
  // ══════════════════════════════════════════
  askDeactivate(id: string, name: string): void {
    this.confirmDeactivateId.set(id);
    this.confirmDeactivateName.set(name);
  }

  cancelDeactivate(): void {
    this.confirmDeactivateId.set(null);
    this.confirmDeactivateName.set('');
  }

  confirmDeactivate(): void {
    const id = this.confirmDeactivateId();
    const name = this.confirmDeactivateName();
    if (!id) return;

    this.adminService.deactivateKine(id).subscribe({
      next: () => {
        this.successMsg.set(
          `Dr. ${name} désactivé`);
        this.allKines.update(list =>
          list.map(k => k.id === id
            ? { ...k, active: false } : k));
        this.confirmDeactivateId.set(null);
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err: { message?: string }) => {
        this.errorMsg.set(
          err.message
          || 'Erreur lors de la désactivation');
        this.confirmDeactivateId.set(null);
      }
    });
  }

  activateKine(id: string, name: string): void {
    this.adminService.activateKine(id).subscribe({
      next: () => {
        this.successMsg.set(`Dr. ${name} réactivé`);
        this.allKines.update(list =>
          list.map(k => k.id === id
            ? { ...k, active: true } : k));
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err: { message?: string }) => {
        this.errorMsg.set(
          err.message
          || 'Erreur lors de la réactivation');
      }
    });
  }

  // ══════════════════════════════════════════
  // SUPPRESSION DÉFINITIVE
  // ══════════════════════════════════════════
  askDelete(id: string): void {
    this.confirmDeleteId.set(id);
  }

  cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  confirmDelete(name: string): void {
    const id = this.confirmDeleteId();
    if (!id) return;

    this.adminService.deleteKine(id).subscribe({
      next: () => {
        this.successMsg.set(
          `${name} supprimé définitivement`);
        this.allKines.update(list =>
          list.filter(k => k.id !== id));
        this.confirmDeleteId.set(null);
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err: { message?: string }) => {
        this.errorMsg.set(
          err.message
          || 'Impossible de supprimer ce kiné');
        this.confirmDeleteId.set(null);
      }
    });
  }
}