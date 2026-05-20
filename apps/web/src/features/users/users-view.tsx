'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Mail,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  department: string;
  lastLogin: string;
  mfaEnabled: boolean;
}

const MOCK_USERS: User[] = [
  { id: '1', name: 'Ahmed Al-Rashid', email: 'admin@industry360.sa', role: 'SUPER_ADMIN', status: 'ACTIVE', department: 'IT', lastLogin: '2 minutes ago', mfaEnabled: true },
  { id: '2', name: 'Sarah Operations', email: 'manager@industry360.sa', role: 'PLANT_MANAGER', status: 'ACTIVE', department: 'Operations', lastLogin: '1 hour ago', mfaEnabled: true },
  { id: '3', name: 'Mohammed Al-Qahtani', email: 'supervisor@industry360.sa', role: 'SHIFT_SUPERVISOR', status: 'ACTIVE', department: 'Production', lastLogin: '3 hours ago', mfaEnabled: false },
  { id: '4', name: 'Fatima Hassan', email: 'quality@industry360.sa', role: 'QUALITY_ENGINEER', status: 'ACTIVE', department: 'Quality', lastLogin: '5 hours ago', mfaEnabled: true },
  { id: '5', name: 'Omar Maintenance', email: 'maintenance@industry360.sa', role: 'MAINTENANCE_TECH', status: 'ACTIVE', department: 'Maintenance', lastLogin: '1 day ago', mfaEnabled: false },
  { id: '6', name: 'Khalid Operator', email: 'operator@industry360.sa', role: 'OPERATOR', status: 'INACTIVE', department: 'Production', lastLogin: '3 days ago', mfaEnabled: false },
];

const roleColors: Record<string, string> = {
  SUPER_ADMIN: 'text-red-400 bg-red-500/20 border-red-500/30',
  PLANT_MANAGER: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
  SHIFT_SUPERVISOR: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
  QUALITY_ENGINEER: 'text-green-400 bg-green-500/20 border-green-500/30',
  MAINTENANCE_TECH: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
  OPERATOR: 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30',
};

const statusConfig = {
  ACTIVE: { icon: CheckCircle, color: 'text-green-400', label: 'Active' },
  INACTIVE: { icon: XCircle, color: 'text-gray-400', label: 'Inactive' },
  LOCKED: { icon: Clock, color: 'text-red-400', label: 'Locked' },
};

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
}

const ROLE_OPTIONS = ['All Roles', 'SUPER_ADMIN', 'PLANT_MANAGER', 'SHIFT_SUPERVISOR', 'QUALITY_ENGINEER', 'MAINTENANCE_TECH', 'OPERATOR'];

export function UsersView() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');

  const filtered = MOCK_USERS.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'All Roles' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const activeCount = MOCK_USERS.filter((u) => u.status === 'ACTIVE').length;
  const mfaCount = MOCK_USERS.filter((u) => u.mfaEnabled).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage platform users, roles, and permissions
          </p>
        </div>
        <Button size="sm">
          <UserPlus className="w-4 h-4 mr-2" />
          Invite User
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: MOCK_USERS.length, icon: Users, color: 'text-brand-400' },
          { label: 'Active', value: activeCount, icon: CheckCircle, color: 'text-green-400' },
          { label: 'MFA Enabled', value: mfaCount, icon: Shield, color: 'text-purple-400' },
          { label: 'Departments', value: 4, icon: Users, color: 'text-cyan-400' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass-card rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                <Icon className={cn('w-4 h-4', stat.color)} />
              </div>
              <div>
                <div className="text-xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {['All Roles', 'SUPER_ADMIN', 'PLANT_MANAGER', 'OPERATOR'].map((role) => (
            <Button
              key={role}
              variant={roleFilter === role ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRoleFilter(role)}
              className="text-xs"
            >
              {role === 'All Roles' ? role : role.replace('_', ' ')}
            </Button>
          ))}
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 text-muted-foreground font-medium">User</th>
              <th className="text-left p-4 text-muted-foreground font-medium">Role</th>
              <th className="text-left p-4 text-muted-foreground font-medium">Department</th>
              <th className="text-left p-4 text-muted-foreground font-medium">Status</th>
              <th className="text-left p-4 text-muted-foreground font-medium">MFA</th>
              <th className="text-left p-4 text-muted-foreground font-medium">Last Login</th>
              <th className="text-right p-4 text-muted-foreground font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user, i) => {
              const statusCfg = statusConfig[user.status];
              const StatusIcon = statusCfg.icon;
              return (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/50 hover:bg-white/5"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-brand-600/30 text-brand-300 text-xs">
                          {getInitials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge className={cn('text-[10px]', roleColors[user.role] || '')}>
                      {user.role.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="p-4 text-muted-foreground">{user.department}</td>
                  <td className="p-4">
                    <div className={cn('flex items-center gap-1.5 text-xs', statusCfg.color)}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {statusCfg.label}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <Shield
                        className={cn(
                          'w-3.5 h-3.5',
                          user.mfaEnabled ? 'text-green-400' : 'text-muted-foreground',
                        )}
                      />
                      <span
                        className={cn(
                          'text-xs',
                          user.mfaEnabled ? 'text-green-400' : 'text-muted-foreground',
                        )}
                      >
                        {user.mfaEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-xs text-muted-foreground">{user.lastLogin}</td>
                  <td className="p-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Edit User</DropdownMenuItem>
                        <DropdownMenuItem>Change Role</DropdownMenuItem>
                        <DropdownMenuItem>Reset Password</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          {user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
