import { api } from './api.client';
import type { User } from '@/store/auth-store';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface FactoryInfo {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  color: string;
  glowColor: string;
  isActive: boolean;
}

export const authService = {
  // Factory selector — load all active factories from the backend
  getFactories: () => api.get<FactoryInfo[]>('/auth/factories'),

  // Factory-scoped login: pass factoryCode so JWT gets the right factoryId
  login: (email: string, password: string, factoryCode?: string) =>
    api.post<LoginResponse>('/auth/login', { email, password, factoryCode }),

  logout: () => api.post('/auth/logout').catch(() => {}),

  refreshToken: (refreshToken: string) =>
    api.post<LoginResponse & { user: User }>('/auth/refresh', { refreshToken }),

  getProfile: () => api.get<User>('/auth/me'),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch('/auth/change-password', { currentPassword, newPassword }),
};
