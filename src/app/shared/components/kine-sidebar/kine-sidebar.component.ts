import { Component, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive }
  from '@angular/router';
import { AuthService }
  from '../../../core/services/auth.service';

@Component({
  selector: 'app-kine-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './kine-sidebar.component.html'
})
export class KineSidebarComponent {
  private authService = inject(AuthService);

  pendingCount = input<number>(0);

  logout(): void {
    this.authService.logout();
  }
}