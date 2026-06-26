import {
  Component, inject, OnInit, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  BadgeService, BadgeResponse
} from '../../../core/services/badge.service';
import { PatientSidebarComponent }
  from '../../../shared/components/patient-sidebar/patient-sidebar.component';

interface BadgeDefinition {
  type: string;
  icon: string;
  label: string;
  description: string;
}

@Component({
  selector: 'app-badges',
  standalone: true,
  imports: [CommonModule, PatientSidebarComponent],
  templateUrl: './badges.component.html',
  styleUrl: './badges.component.scss'
})
export class BadgesComponent implements OnInit {

  private badgeService = inject(BadgeService);

  unlockedBadges = signal<BadgeResponse[]>([]);
  isLoading      = signal<boolean>(false);
  errorMsg       = signal<string>('');

  // ── Les 3 badges disponibles dans le système ─
  readonly allBadges: BadgeDefinition[] = [
    {
      type: 'FIRST_SESSION',
      icon: '🎯',
      label: 'Première séance',
      description: 'Complétez votre première séance'
        + ' de rééducation'
    },
    {
    type: 'SEVEN_DAYS',
    icon: '🔥',
    label: '7 séances consécutives',
    description: 'Complétez 7 séances à la suite'
      + ' sans en abandonner aucune'
  },
    {
      type: 'PERFECT_SCORE',
      icon: '⭐',
      label: 'Score parfait',
      description: 'Obtenez un score de conformité'
        + ' supérieur à 95% sur une séance'
    }
  ];

  ngOnInit(): void {
    this.loadBadges();
  }

  loadBadges(): void {
    this.isLoading.set(true);
    this.errorMsg.set('');

    this.badgeService.getMyBadges().subscribe({
      next: (badges: BadgeResponse[]) => {
        this.unlockedBadges.set(badges);
        this.isLoading.set(false);
      },
      error: (err: { message?: string }) => {
        this.errorMsg.set(
          err.message || 'Erreur de chargement');
        this.isLoading.set(false);
      }
    });
  }

  isUnlocked(badgeType: string): boolean {
    return this.unlockedBadges()
      .some(b => b.badgeType === badgeType);
  }

  getUnlockedDate(badgeType: string): string | null {
    const badge = this.unlockedBadges()
      .find(b => b.badgeType === badgeType);
    return badge?.unlockedAt ?? null;
  }

  get unlockedCount(): number {
    return this.unlockedBadges().length;
  }
}