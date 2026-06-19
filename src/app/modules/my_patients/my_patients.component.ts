import {
  Component, inject, OnInit, signal, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PatientService }
  from '../../core/services/patient.service';
import {
  RehabPlanService, RehabPlanResponse
} from '../../core/services/rehab-plan.service';
import { PatientResponse }
  from '../../core/models/patient.model';
import { KineSidebarComponent }
  from '../../shared/components/kine-sidebar/kine-sidebar.component';

@Component({
  selector: 'app-my-patients',
  standalone: true,
  imports: [CommonModule, KineSidebarComponent],
  templateUrl: './my_patients.component.html',
  styleUrl: './my_patients.component.scss'
})
export class my_PatientComponent implements OnInit {

  private patientService  = inject(PatientService);
  private rehabPlanService = inject(RehabPlanService);

  allPatients = signal<PatientResponse[]>([]);
  isLoading   = signal<boolean>(false);
  errorMsg    = signal<string>('');
  successMsg  = signal<string>('');
  searchQuery = signal<string>('');

  // Plans actifs indexés par patientId
  activePlans = signal<
    Record<string, RehabPlanResponse | null>
  >({});
  generatingFor = signal<string | null>(null);

  filteredPatients = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.allPatients();
    return this.allPatients().filter(p =>
      p.fullName.toLowerCase().includes(q));
  });

  ngOnInit(): void {
    this.loadPatients();
  }

  loadPatients(): void {
    this.isLoading.set(true);
    this.errorMsg.set('');

    this.patientService.getMyPatients().subscribe({
      next: (patients: PatientResponse[]) => {
        this.allPatients.set(patients);
        this.isLoading.set(false);
        this.loadActivePlans(patients);
      },
      error: (err: { message: string }) => {
        this.errorMsg.set(err.message || 'Erreur');
        this.isLoading.set(false);
      }
    });
  }

  // ── Vérifie pour chaque patient s'il a un plan
  // actif, pour afficher "Générer" ou "Voir le plan"
  private loadActivePlans(
  patients: PatientResponse[]
): void {
  patients.forEach(p => {
    this.rehabPlanService.getActivePlan(p.id)
      .subscribe({
        next: (plan: RehabPlanResponse) => {
          this.activePlans.update(map => ({
            ...map, [p.id]: plan
          }));
        },
        error: (err: { status: number }) => {
          if (err.status === 400 || err.status === 404) {
            // ✅ Cas normal — patient sans plan actif
            // pas une vraie erreur, on l'enregistre
            // simplement comme "null" silencieusement
            this.activePlans.update(map => ({
              ...map, [p.id]: null
            }));
          } else {
            // ✅ Vraie erreur serveur (500, réseau, etc.)
            // celle-ci doit être visible
            console.error(
              `Erreur inattendue lors du chargement`
              + ` du plan pour ${p.fullName}`, err);
            this.activePlans.update(map => ({
              ...map, [p.id]: null
            }));
          }
        }
      });
  });
}

  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  hasActivePlan(patientId: string): boolean {
    return !!this.activePlans()[patientId];
  }

  getActivePlan(
    patientId: string
  ): RehabPlanResponse | null {
    return this.activePlans()[patientId] ?? null;
  }
  
generatePlan(patientId: string, name: string): void {
  this.generatingFor.set(patientId);

  const today = new Date()
    .toISOString().split('T')[0];

  this.rehabPlanService.generatePlan({
    patientId, startDate: today
  }).subscribe({
    next: (plan: RehabPlanResponse) => {
      this.activePlans.update(map => ({
        ...map, [patientId]: plan
      }));
      this.successMsg.set(
        `Plan de rééducation généré pour ${name}`
        + ` — niveau ${this.getLevelLabel(
            plan.difficultyLevel)}`);
      this.generatingFor.set(null);
      setTimeout(() => this.successMsg.set(''), 4000);
    },
    error: (err: { error?: { message?: string } }) => {
      // ✅ err.error.message contient le texte
      // exact renvoyé par BusinessException
      this.errorMsg.set(
        err.error?.message
        || 'Erreur lors de la génération du plan');
      this.generatingFor.set(null);
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
}