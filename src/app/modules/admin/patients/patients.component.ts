import {
  Component, inject, OnInit, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, KineResponse }
  from '../../../core/services/admin.service';
import { PatientResponse }
  from '../../../core/models/patient.model';
import { AdminSidebarComponent }
  from '../../../shared/components/admin-sidebar/admin-sidebar.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [CommonModule, AdminSidebarComponent,FormsModule],
  templateUrl: './patients.component.html',
  styleUrl: './patients.component.scss'
})
export class PatientsComponent implements OnInit {

  private adminService = inject(AdminService);

  allPatients = signal<PatientResponse[]>([]);
  isLoading   = signal<boolean>(false);
  successMsg  = signal<string>('');
  errorMsg    = signal<string>('');
  searchQuery = signal<string>('');
  filterLevel = signal<string>('ALL');

  confirmArchiveId   = signal<string | null>(null);
  confirmArchiveName = signal<string>('');

  filteredPatients = computed(() => {
    let list = this.allPatients();

    if (this.filterLevel() !== 'ALL') {
      list = list.filter(p =>
        p.level === this.filterLevel());
    }

    const q = this.searchQuery().toLowerCase();
    if (q) {
      list = list.filter(p =>
        p.fullName.toLowerCase().includes(q)
        || (p.kineName ?? '')
            .toLowerCase().includes(q));
    }

    return list;
  });

  ngOnInit(): void {
    this.loadPatients();
  }

  loadPatients(): void {
    this.isLoading.set(true);
    this.errorMsg.set('');

    this.adminService.getAllPatients().subscribe({
      next: (patients: PatientResponse[]) => {
        this.allPatients.set(patients);
        this.isLoading.set(false);
      },
      error: (err: { message: string }) => {
        this.errorMsg.set(err.message || 'Erreur');
        this.isLoading.set(false);
      }
    });
  }

  setLevelFilter(level: string): void {
    this.filterLevel.set(level);
  }

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  askArchive(id: string, name: string): void {
    this.confirmArchiveId.set(id);
    this.confirmArchiveName.set(name);
  }

  cancelArchive(): void {
    this.confirmArchiveId.set(null);
    this.confirmArchiveName.set('');
  }

  confirmArchive(): void {
    const id = this.confirmArchiveId();
    const name = this.confirmArchiveName();
    if (!id) return;

    this.adminService.archivePatient(id).subscribe({
      next: () => {
        this.successMsg.set(
          `${name} archivé avec succès`);
        this.allPatients.update(list =>
          list.map(p => p.id === id
            ? { ...p, isActive: false } : p));
        this.confirmArchiveId.set(null);
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err: { message: string }) => {
        this.errorMsg.set(
          err.message
          || 'Erreur lors de l\'archivage');
        this.confirmArchiveId.set(null);
      }
    });
  }

  reactivate(id: string, name: string): void {
    this.adminService.reactivatePatient(id).subscribe({
      next: () => {
        this.successMsg.set(
          `${name} réactivé avec succès`);
        this.allPatients.update(list =>
          list.map(p => p.id === id
            ? { ...p, isActive: true } : p));
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err: { message: string }) => {
        this.errorMsg.set(
          err.message
          || 'Erreur lors de la réactivation');
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

  getPathologyLabel(p: string): string {
    const labels: Record<string, string> = {
      'GENOU': 'Genou', 'EPAULE': 'Épaule',
      'DOS': 'Dos', 'HANCHE': 'Hanche',
      'COUDE': 'Coude'
    };
    return labels[p] || p;
  }

  // Nouveaux signals
reassignTarget = signal<PatientResponse | null>(null);
availableKines = signal<KineResponse[]>([]);
selectedKineId = signal<string>('');

openReassign(patient: PatientResponse): void {
  this.reassignTarget.set(patient);
  this.selectedKineId.set('');

  // Charger les kinés validés disponibles
  this.adminService.getAllKines().subscribe({
    next: (kines: KineResponse[]) => {
      this.availableKines.set(
        kines.filter(k => k.validated
          && k.id !== patient.kineId));
    }
  });
}

cancelReassign(): void {
  this.reassignTarget.set(null);
}

confirmReassign(): void {
  const patient = this.reassignTarget();
  const newKineId = this.selectedKineId();
  if (!patient || !newKineId) return;

  this.adminService.reassignKine(
    patient.id, newKineId
  ).subscribe({
    next: (updated: PatientResponse) => {
      this.allPatients.update(list =>
        list.map(p => p.id === patient.id
          ? updated : p));
      this.successMsg.set(
        `${patient.fullName} réaffecté avec succès`);
      this.reassignTarget.set(null);
      setTimeout(() => this.successMsg.set(''), 3000);
    },
    error: (err: { error?: { message?: string } }) => {
      this.errorMsg.set(
        err.error?.message
        || 'Erreur lors de la réaffectation');
      this.reassignTarget.set(null);
    }
  });
}
}