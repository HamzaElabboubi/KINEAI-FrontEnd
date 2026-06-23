export interface PatientResponse {
  id: string;
  fullName: string;
  age: number;
  pathology: string;
  level: string;
  streakCount: number;
  totalXp: number;
  kineName: string;
  kineId: string;
  isActive: boolean;
}

export interface RehabPlanResponse {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  difficultyLevel: string;
  currentWeek: number;
}

export interface SessionResponse {
  id: string;
  startTime: string;
  endTime: string;
  score: number;
  repsCompleted: number;
  xpEarned: number;
  sessionStatus: string;
  status: string;
}

export interface BadgeResponse {
  id: string;
  badgeType: string;
  unlockedAt: string;
}

export interface DashboardPatientResponse {
  profile: PatientResponse;
  activePlan: RehabPlanResponse;
  totalSessions: number;
  averageScore: number;
  streakCount: number;
  totalXp: number;
  badges: BadgeResponse[];
  recentSessions: SessionResponse[];
  progressionPct: number;
}