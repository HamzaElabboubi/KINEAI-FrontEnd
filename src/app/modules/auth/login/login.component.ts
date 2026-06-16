import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder,
         FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService }
  from '../../../core/services/auth.service';
import { AuthResponse }
  from '../../../core/models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router      = inject(Router);
  private fb          = inject(FormBuilder);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required,
                    Validators.minLength(8)]]
  });

  isLoading    = false;
  errorMessage = '';
  showPassword = false;

  get email()    { return this.loginForm.get('email');    }
  get password() { return this.loginForm.get('password'); }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.isLoading    = true;
    this.errorMessage = '';

    this.authService.login(this.loginForm.value).subscribe({
      next: (response: AuthResponse) => {
        this.isLoading = false;
        this.redirectByRole(response.role);
      },
      error: (err: { message: string; status: number }) => {
        this.isLoading = false;
        this.errorMessage = err.message;
      }
    });
  }

  private redirectByRole(role: string): void {
    switch (role) {
      case 'PATIENT':
        this.router.navigate(['/patient/dashboard']);
        break;
      case 'KINE':
        this.router.navigate(['/kine/dashboard']);
        break;
      case 'ADMIN':
        this.router.navigate(['/admin/dashboard']);
        break;
      default:
        this.router.navigate(['/auth/login']);
    }
  }
}