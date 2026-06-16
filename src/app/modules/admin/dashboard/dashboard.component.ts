import { Component, inject, OnInit, signal }
  from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminService, KineResponse }
  from '../../../core/services/admin.service';
import { AuthService }
  from '../../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit {

  private adminService = inject(AdminService);
  private authService  = inject(AuthService);
  private router       = inject(Router);

  // ✅ Signals au lieu de propriétés simples
  pendingKines = signal<KineResponse[]>([]);
  isLoading    = signal<boolean>(false);
  successMsg   = signal<string>('');
  errorMsg     = signal<string>('');

  get adminName(): string {
    return this.authService.getFullName()
      || 'Administrateur';
  }

  ngOnInit(): void {
    this.loadPendingKines();
  }

  loadPendingKines(): void {
    this.isLoading.set(true);
    this.errorMsg.set('');

    this.adminService.getPendingKines().subscribe({
      next: (kines: KineResponse[]) => {
        console.log('Kinés reçus:', kines);
        this.pendingKines.set(kines);
        this.isLoading.set(false);
      },
      error: (err: { message: string; status: number }) => {
        console.log('Erreur:', err);
        this.errorMsg.set(err.message || 'Erreur');
        this.isLoading.set(false);
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
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err: { message: string; status: number }) => {
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
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: (err: { message: string; status: number }) => {
        this.errorMsg.set(
          err.message || 'Erreur lors du rejet');
      }
    });
  }

  logout(): void {
    this.authService.logout();
  }
}