export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterPatientRequest {
  email: string;
  password: string;
  fullName: string;
  age: number;
  phone: string;
  pathology: string;
  kineId: string;
}

export interface RegisterKineRequest {
  email: string;
  password: string;
  fullName: string;
  speciality: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  userId: string;
  email: string;
  role: string;
  fullName: string;
}

export interface ApiError {
  message: string;
  status: number;
  timestamp: string;
}