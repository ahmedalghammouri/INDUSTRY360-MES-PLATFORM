'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Factory,
  ShieldCheck,
  Wrench,
  BarChart3,
  Radio,
  GitBranch,
  Bell,
  Settings,
  Users,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Bot,
  Package,
  ClipboardList,
  TrendingUp,
  Gauge,
  AlertTriangle,
  Calendar,
  Boxes,
  Network,
  FileText,
  Cpu,
  Activity,
  Map,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/store/ui-store';
import { useAuthStore } from '@/store/auth-store';
import { useFactoryStore } from '@/store/factory-store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  badge?: string | number;
  badgeVariant?: 'default' | 'destructive' | 'secondary' | 'outline';
  children?: NavItem[];
  permission?: string;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Production',
    icon: Factory,
    children: [
      { label: 'Overview', href: '/production', icon: Gauge },
      { label: 'Work Orders', href: '/production/orders', icon: ClipboardList },
      { label: 'Batches', href: '/production/batches', icon: Boxes },
      { label: 'OEE Analytics', href: '/production/oee', icon: TrendingUp },
      { label: 'Scheduling', href: '/production/scheduling', icon: Calendar },
      { label: 'Recipes', href: '/production/recipes', icon: FileText },
    ],
  },
  {
    label: 'Quality',
    icon: ShieldCheck,
    children: [
      { label: 'Overview', href: '/quality', icon: Activity },
      { label: 'Inspections', href: '/quality/inspections', icon: ClipboardList },
      { label: 'NCR Management', href: '/quality/ncr', icon: AlertTriangle, badge: 3, badgeVariant: 'destructive' },
      { label: 'CAPA', href: '/quality/capa', icon: ShieldCheck },
      { label: 'SPC Charts', href: '/quality/spc', icon: TrendingUp },
    ],
  },
  {
    label: 'Maintenance',
    icon: Wrench,
    children: [
      { label: 'Overview', href: '/maintenance', icon: Activity },
      { label: 'Work Orders', href: '/maintenance/work-orders', icon: ClipboardList },
      { label: 'Assets', href: '/maintenance/assets', icon: Cpu },
      { label: 'Preventive PM', href: '/maintenance/preventive', icon: Calendar },
      { label: 'Spare Parts', href: '/maintenance/spare-parts', icon: Package },
    ],
  },
  {
    label: 'Reports',
    icon: BarChart3,
    children: [
      { label: 'Report Builder', href: '/reports', icon: FileText },
      { label: 'Production Reports', href: '/reports/production', icon: Factory },
      { label: 'Quality Reports', href: '/reports/quality', icon: ShieldCheck },
      { label: 'Maintenance Reports', href: '/reports/maintenance', icon: Wrench },
    ],
  },
  {
    label: 'IIoT & Connectivity',
    icon: Radio,
    children: [
      { label: 'Devices', href: '/iot/devices', icon: Cpu },
      { label: 'Tag Browser', href: '/iot/tags', icon: Network },
      { label: 'Drivers', href: '/iot/drivers', icon: Radio },
      { label: 'Data Streams', href: '/iot/streams', icon: Activity },
    ],
  },
  {
    label: 'Plant Hierarchy',
    href: '/hierarchy',
    icon: GitBranch,
  },
  {
    label: 'AI Intelligence',
    href: '/ai',
    icon: Bot,
    badge: 'New',
  },
  {
    label: 'Notifications',
    href: '/notifications',
    icon: Bell,
    badge: 7,
    badgeVariant: 'destructive',
  },
];

const bottomNavItems: NavItem[] = [
  { label: 'Users & Roles', href: '/users', icon: Users },
  { label: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarItemProps {
  item: NavItem;
  isCollapsed: boolean;
  depth?: number;
}

function SidebarItem({ item, isCollapsed, depth = 0 }: SidebarItemProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(() => {
    if (!item.children) return false;
    return item.children.some((c) => c.href && pathname.startsWith(c.href));
  });

  const isActive = item.href
    ? pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
    : item.children?.some((c) => c.href && pathname.startsWith(c.href));

  const Icon = item.icon;

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
            isActive
              ? 'bg-sidebar-accent text-sidebar-primary'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
            isCollapsed && 'justify-center px-2',
          )}
        >
          <Icon className={cn('shrink-0 w-4.5 h-4.5', isActive && 'text-sidebar-primary')} size={18} />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex-1 text-left overflow-hidden whitespace-nowrap"
              >
                {item.label}
              </motion.span>
            )}
          </AnimatePresence>
          {!isCollapsed && (
            <ChevronDown
              size={14}
              className={cn('shrink-0 transition-transform duration-200', isOpen && 'rotate-180')}
            />
          )}
        </button>

        <AnimatePresence>
          {isOpen && !isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden ml-3 mt-0.5 pl-4 border-l border-sidebar-border/50"
            >
              {item.children.map((child) => (
                <SidebarItem key={child.href || child.label} item={child} isCollapsed={false} depth={depth + 1} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const content = (
    <Link
      href={item.href!}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
        isActive
          ? 'bg-sidebar-primary/15 text-sidebar-primary shadow-sm'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
        isCollapsed && 'justify-center px-2',
        depth > 0 && 'py-2 text-xs',
      )}
    >
      <Icon
        size={depth > 0 ? 15 : 18}
        className={cn('shrink-0', isActive && 'text-sidebar-primary')}
      />
      <AnimatePresence>
        {!isCollapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-hidden whitespace-nowrap"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      {!isCollapsed && item.badge && (
        <Badge
          variant={item.badgeVariant || 'secondary'}
          className="ml-auto text-[10px] h-4 min-w-4 px-1"
        >
          {item.badge}
        </Badge>
      )}
    </Link>
  );

  if (isCollapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.label}
            {item.badge && (
              <Badge variant={item.badgeVariant || 'secondary'} className="ml-2 text-[10px]">
                {item.badge}
              </Badge>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

function BackToMapButton({ isCollapsed }: { isCollapsed: boolean }) {
  const router = useRouter();
  const { selectedFactory, clearFactory } = useFactoryStore();
  const { logout } = useAuthStore();

  function handleBackToMap() {
    logout();
    clearFactory();
    router.push('/');
  }

  const btn = (
    <button
      onClick={handleBackToMap}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 group relative overflow-hidden',
        'border border-cyan-500/20 hover:border-cyan-500/50',
        'bg-gradient-to-r from-cyan-500/5 to-blue-500/5 hover:from-cyan-500/15 hover:to-blue-500/10',
        'text-cyan-400/70 hover:text-cyan-300',
        isCollapsed && 'justify-center px-2',
      )}
    >
      {/* Animated left border accent */}
      <span className="absolute left-0 top-0 h-full w-0.5 bg-cyan-400/50 group-hover:bg-cyan-400 transition-colors" />

      <Map size={15} className="shrink-0 text-cyan-400 group-hover:text-cyan-300 transition-colors" />

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            className="flex-1 min-w-0 overflow-hidden"
          >
            <div className="whitespace-nowrap leading-tight">
              {selectedFactory ? (
                <>
                  <span className="text-[10px] text-cyan-400/50 block font-mono tracking-wider uppercase">
                    {selectedFactory.code}
                  </span>
                  <span className="text-[11px] truncate block">Switch Factory</span>
                </>
              ) : (
                <span className="text-[11px]">Back to Map</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isCollapsed && (
        <LogOut size={12} className="shrink-0 opacity-40 group-hover:opacity-80 transition-opacity" />
      )}
    </button>
  );

  if (isCollapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>{btn}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium text-xs">
            {selectedFactory ? `Switch Factory (${selectedFactory.code})` : 'Back to Map'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return btn;
}

export function Sidebar() {
  const { isCollapsed, toggle } = useSidebarStore();
  const { user } = useAuthStore();

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 64 : 260 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-full z-50 flex flex-col bg-sidebar border-r border-sidebar-border overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-3 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-glow-brand">
            <Factory className="w-4.5 h-4.5 text-white" size={18} />
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden"
              >
                <div className="text-sidebar-foreground font-bold text-sm whitespace-nowrap">
                  INDUSTRY360
                </div>
                <div className="text-sidebar-foreground/40 text-[10px] font-medium tracking-widest uppercase whitespace-nowrap">
                  MES Platform
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          className={cn(
            'ml-auto p-1.5 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors',
            isCollapsed && 'mx-auto',
          )}
        >
          {isCollapsed ? (
            <ChevronRight size={14} />
          ) : (
            <ChevronLeft size={14} />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5 no-scrollbar">
        {navItems.map((item) => (
          <SidebarItem key={item.href || item.label} item={item} isCollapsed={isCollapsed} />
        ))}
      </nav>

      {/* Back to Map */}
      <div className="px-2 py-2 border-t border-sidebar-border">
        <BackToMapButton isCollapsed={isCollapsed} />
      </div>

      {/* Bottom nav */}
      <div className="px-2 py-2 border-t border-sidebar-border space-y-0.5">
        {bottomNavItems.map((item) => (
          <SidebarItem key={item.href} item={item} isCollapsed={isCollapsed} />
        ))}
      </div>

      {/* User profile */}
      <div className={cn(
        'flex items-center gap-3 p-3 border-t border-sidebar-border bg-sidebar-accent/30',
        isCollapsed && 'justify-center',
      )}>
        <Avatar className="w-8 h-8 shrink-0">
          <AvatarImage src={user?.avatar} />
          <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
            {user?.name?.substring(0, 2).toUpperCase() || 'US'}
          </AvatarFallback>
        </Avatar>
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 min-w-0"
            >
              <div className="text-sidebar-foreground text-xs font-semibold truncate">
                {user?.name || 'User'}
              </div>
              <div className="text-sidebar-foreground/40 text-[10px] truncate">
                {user?.role || 'Operator'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
