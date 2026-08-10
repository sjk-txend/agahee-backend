export type ObjectId = string;

export interface PublicUser {
  id: ObjectId;
  name: string;
  email: string;
  isOnline?: boolean;
  lastSeenAt?: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: PublicUser;
}

export interface ApiError {
  error: string;
}