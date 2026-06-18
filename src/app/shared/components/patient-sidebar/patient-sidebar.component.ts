import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-patient-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './patient-sidebar.component.html'
})
export class PatientSidebarComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  logout(): void {
    this.authService.logout();
  }
}