import { Component, inject, OnInit, signal }
  from '@angular/core';
import { CommonModule } from '@angular/common';
import { PatientService }
  from '../../../core/services/patient.service';
import { AuthService }
  from '../../../core/services/auth.service';
import { PatientResponse }
  from '../../../core/models/patient.model';
import { PatientSidebarComponent }
  from '../../../shared/components/patient-sidebar/patient-sidebar.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, PatientSidebarComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {

  private patientService = inject(PatientService);
  private authService    = inject(AuthService);

  profile   = signal<PatientResponse | null>(null);
  isLoading = signal<boolean>(false);
  errorMsg  = signal<string>('');

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.isLoading.set(true);
    this.patientService.getMyProfile().subscribe({
      next: (data: PatientResponse) => {
        this.profile.set(data);
        this.isLoading.set(false);
      },
      error: (err: { message: string }) => {
        this.errorMsg.set(
          err.message || 'Erreur de chargement');
        this.isLoading.set(false);
      }
    });
  }

  getPathologyLabel(p: string): string {
    const labels: Record<string, string> = {
      'GENOU': 'Genou', 'EPAULE': 'Épaule',
      'DOS': 'Dos', 'HANCHE': 'Hanche',
      'COUDE': 'Coude'
    };
    return labels[p] || p;
  }

  getLevelLabel(l: string): string {
    const labels: Record<string, string> = {
      'DEBUTANT': 'Débutant',
      'INTERMEDIAIRE': 'Intermédiaire',
      'AVANCE': 'Avancé'
    };
    return labels[l] || l;
  }

  logout(): void {
    this.authService.logout();
  }
}