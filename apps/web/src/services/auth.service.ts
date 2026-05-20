import { api } from './api.client';
import type { User } from '@/store/auth-store';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface MFAResponse {
  mfaRequired: boolean;
  mfaToken: string;
}

export const authService = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),

  loginWithMFA: (mfaToken: string, otp: string) =>
    api.post<LoginResponse>('/auth/mfa/verify', { mfaToken, otp }),

  logout: () => api.post('/auth/logout'),

  refreshToken: (refreshToken: string) =>
    api.post<LoginResponse>('/auth/refresh', { refreshToken }),

  getProfile: () => api.get<User>('/auth/me'),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),

  setupMFA: () => api.post<{ qrCode: string; secret: string }>('/auth/mfa/setup'),

  verifyMFASetup: (otp: string) => api.post('/auth/mfa/enable', { otp }),

  disableMFA: (otp: string) => api.post('/auth/mfa/disable', { otp }),
};
