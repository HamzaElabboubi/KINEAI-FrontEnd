import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder,
         FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService }
  from '../../../core/services/auth.service';
import { AuthResponse }
  from '../../../core/models/auth.model';

interface KineOption {
  id: string;
  fullName: string;
  speciality: string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrls: ['./register.scss']
})
export class RegisterComponent implements OnInit {

  private authService = inject(AuthService);
  private router      = inject(Router);
  private fb          = inject(FormBuilder);
  private http        = inject(HttpClient);

  // ── Onglet actif ──────────────────────────
  activeTab: 'patient' | 'kine' = 'patient';

  isLoading     = false;
  errorMessage  = '';
  showPassword  = false;
  kines: KineOption[] = [];

  // ── Formulaire Patient ────────────────────
  patientForm: FormGroup = this.fb.group({
    fullName: ['', [Validators.required,
                    Validators.minLength(3)]],
    email: ['', [Validators.required,
                 Validators.email]],
    password: ['', [Validators.required,
                    Validators.minLength(8)]],
    age: [null, [Validators.required,
                 Validators.min(1),
                 Validators.max(120)]],
    phone: ['', [Validators.required,
                 Validators.pattern('^[0-9]{10}$')]],
    pathology: ['', Validators.required],
    kineId: ['', Validators.required]
  });

  // ── Formulaire Kiné ───────────────────────
  kineForm: FormGroup = this.fb.group({
    fullName: ['', [Validators.required,
                    Validators.minLength(3)]],
    email: ['', [Validators.required,
                 Validators.email]],
    password: ['', [Validators.required,
                    Validators.minLength(8)]],
    speciality: ['', Validators.required]
  });

  // ── Pathologies disponibles ───────────────
  pathologies = [
    { value: 'GENOU',   label: 'Genou' },
    { value: 'EPAULE',  label: 'Épaule' },
    { value: 'DOS',     label: 'Dos' },
    { value: 'HANCHE',  label: 'Hanche' },
    { value: 'COUDE',   label: 'Coude' }
  ];

  // ── Spécialités disponibles ───────────────
  specialities = [
    'Orthopédie',
    'Neurologie',
    'Rhumatologie',
    'Sport',
    'Pédiatrie',
    'Gériatrie'
  ];

  ngOnInit(): void {
    this.loadKines();
  }

  // ── Charger liste kinés validés ───────────
  loadKines(): void {
    this.http
      .get<KineOption[]>(
        'http://localhost:8080/api/v1/kine/validated')
      .subscribe({
        next: (kines: KineOption[]) => {
          this.kines = kines;
        },
        error: () => {
          this.kines = [];
        }
      });
  }

  // ── Changer onglet ────────────────────────
  setTab(tab: 'patient' | 'kine'): void {
    this.activeTab   = tab;
    this.errorMessage = '';
    this.showPassword = false;
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  // ── Getters Patient ───────────────────────
  get pFullName()   { return this.patientForm.get('fullName');  }
  get pEmail()      { return this.patientForm.get('email');     }
  get pPassword()   { return this.patientForm.get('password');  }
  get pAge()        { return this.patientForm.get('age');       }
  get pPhone()      { return this.patientForm.get('phone');     }
  get pPathology()  { return this.patientForm.get('pathology'); }
  get pKineId()     { return this.patientForm.get('kineId');    }

  // ── Getters Kiné ──────────────────────────
  get kFullName()    { return this.kineForm.get('fullName');   }
  get kEmail()       { return this.kineForm.get('email');      }
  get kPassword()    { return this.kineForm.get('password');   }
  get kSpeciality()  { return this.kineForm.get('speciality'); }

  // ── Soumettre ─────────────────────────────
  onSubmit(): void {
    if (this.activeTab === 'patient') {
      this.submitPatient();
    } else {
      this.submitKine();
    }
  }

  private submitPatient(): void {
    if (this.patientForm.invalid) {
      this.patientForm.markAllAsTouched();
      return;
    }
    this.isLoading   = true;
    this.errorMessage = '';

    this.authService
      .registerPatient(this.patientForm.value)
      .subscribe({
        next: (_: AuthResponse) => {
          this.isLoading = false;
          this.router.navigate(['/auth/login']);
        },
        error: (err: { message: string; status: number }) => {
          this.isLoading    = false;
          this.errorMessage = err.message;
        }
      });
  }

  private submitKine(): void {
    if (this.kineForm.invalid) {
      this.kineForm.markAllAsTouched();
      return;
    }
    this.isLoading   = true;
    this.errorMessage = '';

    this.authService
      .registerKine(this.kineForm.value)
      .subscribe({
        next: (_: AuthResponse) => {
          this.isLoading = false;
          this.router.navigate(['/auth/login']);
        },
        error: (err: { message: string; status: number }) => {
          this.isLoading    = false;
          this.errorMessage = err.message;
        }
      });
  }
}