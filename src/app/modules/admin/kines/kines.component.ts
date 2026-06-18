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
  confirmDeleteId = signal<string | null>(null);

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
      error: (err: { message: string }) => {
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

  validateKine(id: string, name: string): void {
    this.adminService.validateKine(id).subscribe({
      next: () => {
        this.successMsg.set(
          `Dr. ${name} validé avec succès`);
        this.allKines.update(list =>
          list.map(k => k.id === id
            ? { ...k, validated: true } : k));
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
        this.allKines.update(list =>
          list.filter(k => k.id !== id));
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err: { message: string }) => {
        this.errorMsg.set(
          err.message || 'Erreur lors du rejet');
      }
    });
  }

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
          `Dr. ${name} supprimé définitivement`);
        this.allKines.update(list =>
          list.filter(k => k.id !== id));
        this.confirmDeleteId.set(null);
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err: { message: string }) => {
        this.errorMsg.set(
          err.message
          || 'Impossible de supprimer ce kiné');
        this.confirmDeleteId.set(null);
      }
    });
  }
}