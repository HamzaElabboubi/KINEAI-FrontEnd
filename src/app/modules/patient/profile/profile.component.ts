import {
  Component, inject, OnInit, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder, ReactiveFormsModule, Validators
} from '@angular/forms';
import { PatientService }
  from '../../../core/services/patient.service';
import {
  RehabPlanService, RehabPlanResponse
} from '../../../core/services/rehab-plan.service';
import { PatientResponse }
  from '../../../core/models/patient.model';
import { PatientSidebarComponent }
  from '../../../shared/components/patient-sidebar/patient-sidebar.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    PatientSidebarComponent
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {

  protected readonly Math = Math;
  private patientService  = inject(PatientService);
  private rehabPlanService = inject(RehabPlanService);
  private fb = inject(FormBuilder);

  profile     = signal<PatientResponse | null>(null);
  activePlan  = signal<RehabPlanResponse | null>(null);
  isLoading   = signal<boolean>(false);
  isSaving    = signal<boolean>(false);
  errorMsg    = signal<string>('');
  successMsg  = signal<string>('');
  isEditing   = signal<boolean>(false);

  editForm = this.fb.group({
    fullName: ['', [
      Validators.required, Validators.minLength(2)
    ]],
    age: [0, [
      Validators.required,
      Validators.min(1), Validators.max(120)
    ]]
  });

  ngOnInit(): void {
    this.loadProfile();
    this.loadActivePlan();
  }

  loadProfile(): void {
    this.isLoading.set(true);
    this.errorMsg.set('');

    this.patientService.getMyProfile().subscribe({
      next: (data: PatientResponse) => {
        this.profile.set(data);
        this.editForm.patchValue({
          fullName: data.fullName,
          age: data.age
        });
        this.isLoading.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.errorMsg.set(
          err.error?.message
          || 'Erreur de chargement du profil');
        this.isLoading.set(false);
      }
    });
  }

  loadActivePlan(): void {
    this.rehabPlanService.getMyActivePlan().subscribe({
      next: (plan: RehabPlanResponse) => {
        this.activePlan.set(plan);
      },
      error: () => {
        // Pas de plan actif — pas une erreur bloquante
        this.activePlan.set(null);
      }
    });
  }

  startEdit(): void {
    this.isEditing.set(true);
    this.successMsg.set('');
  }

  cancelEdit(): void {
    this.isEditing.set(false);
    const p = this.profile();
    if (p) {
      this.editForm.patchValue({
        fullName: p.fullName, age: p.age
      });
    }
  }

  saveProfile(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMsg.set('');

    this.patientService.updateMyProfile(
      this.editForm.value as
        { fullName: string; age: number }
    ).subscribe({
      next: (updated: PatientResponse) => {
        this.profile.set(updated);
        this.isEditing.set(false);
        this.isSaving.set(false);
        this.successMsg.set(
          'Profil mis à jour avec succès');
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err: { error?: { message?: string } }) => {
        this.errorMsg.set(
          err.error?.message
          || 'Erreur lors de la mise à jour');
        this.isSaving.set(false);
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
}