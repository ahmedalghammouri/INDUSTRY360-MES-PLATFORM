'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { authService } from '@/services/auth.service';

const isPublicRoute = (pathname: string) =>
  pathname === '/' ||
  pathname.startsWith('/login') ||
  pathname.startsWith('/forgot-password') ||
  pathname.startsWith('/reset-password');

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, accessToken, setAuth, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const refreshAttempted = useRef(false);

  useEffect(() => {
    const isPublic = isPublicRoute(pathname);

    if (isAuthenticated && isPublic) {
      refreshAttempted.current = false;
      router.replace('/dashboard');
      return;
    }

    if (!isAuthenticated && !isPublic) {
      if (!refreshAttempted.current) {
        refreshAttempted.current = true;
        authService
          .refreshToken()
          .then((data) => {
            if (data) {
              setAuth(data.user, data.accessToken, data.refreshToken);
            } else {
              router.replace('/');
            }
          })
          .catch(() => {
            router.replace('/');
          });
      } else {
        // refresh already attempted or explicit logout — return to factory selector
        router.replace('/');
      }
    }
  }, [isAuthenticated, pathname, router, setAuth, logout]);

  useEffect(() => {
    if (!accessToken) return;

    const decoded = parseJwt(accessToken);
    if (!decoded) return;

    const expiresAt = decoded.exp * 1000;
    const refreshAt = expiresAt - 60 * 1000;
    const delay = refreshAt - Date.now();

    if (delay <= 0) return;

    const timer = setTimeout(() => {
      authService
        .refreshToken()
        .then((data) => {
          if (data) setAuth(data.user, data.accessToken, data.refreshToken);
          else {
            logout();
            router.replace('/');
          }
        })
        .catch(() => {
          logout();
          router.replace('/');
        });
    }, delay);

    return () => clearTimeout(timer);
  }, [accessToken, setAuth, logout]);

  return <>{children}</>;
}

function parseJwt(token: string): { exp: number } | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(window.atob(base64));
  } catch {
    return null;
  }
}
