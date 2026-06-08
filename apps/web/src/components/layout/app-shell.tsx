'use client';

import React from 'react';

import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { useSidebarStore } from '@/store/ui-store';
import { NavigationProgress } from '@/components/ui/navigation-progress';
import { RouteLoader } from '@/components/ui/route-loader';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isCollapsed } = useSidebarStore();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <NavigationProgress />
      <Sidebar />
      <div
        className="flex flex-1 flex-col overflow-hidden transition-[margin-left] duration-300 ease-in-out"
        style={{ marginLeft: isCollapsed ? '64px' : '260px' }}
      >
        <Topbar />
        <main className="relative flex-1 overflow-auto">
          <RouteLoader />
          {children}
        </main>
      </div>
    </div>
  );
}
