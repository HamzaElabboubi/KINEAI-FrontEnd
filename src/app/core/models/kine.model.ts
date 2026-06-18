import { PatientResponse } from './patient.model';

export interface AlertResponse {
  id: string;
  patientId: string;
  patientName: string;
  type: 'INACTIVITY' | 'SCORE';
  message: string;
  sentAt: string;
  resolved: boolean;
}

export interface DashboardKineResponse {
  totalPatients: number;
  pendingAlerts: number;
  patients: PatientResponse[];
  recentAlerts: AlertResponse[];
}
