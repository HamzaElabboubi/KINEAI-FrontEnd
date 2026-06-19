import { Component, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive }
  from '@angular/router';
import { AuthService }
  from '../../../core/services/auth.service';


@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ],
  templateUrl: './admin-sidebar.component.html'
})
export class AdminSidebarComponent {
  private authService = inject(AuthService);
  readonly logoUrl = 'assets/images/logo.png';

  // Badge sur "Validations" — passé par le parent
  pendingCount = input<number>(0);

  logout(): void {
    this.authService.logout();
  }
}