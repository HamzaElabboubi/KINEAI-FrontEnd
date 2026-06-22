export interface ExerciseResponse {
  id: string;
  name: string;
  bodyZone: string;
  targetAngle: number;
  toleranceDeg: number;
  repsTarget: number;
  difficultyLevel: string;
  mediapipeJoints: string;
  description: string;
}

export interface CreateSessionRequest {
  exerciseId: string;
  planId?: string | null;
}

export interface SaveMetricsRequest {
  jointAngles: string;
  conformityPct: number;
  repsAtMoment: number;
}

export interface CompleteSessionRequest {
  finalScore: number;
  repsCompleted: number;
  jointAngles: string;
}

export interface SessionResponse {
  id: string;
  patientId: string;
  exerciseId: string;
  exerciseName: string;
  startTime: string;
  endTime: string;
  score: number | null;
  repsCompleted: number;
  xpEarned: number;
  status: string;
}