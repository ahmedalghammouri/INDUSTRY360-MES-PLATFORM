'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users, UserPlus, Search, Shield, Mail, MoreHorizontal,
  CheckCircle, XCircle, ChevronDown, Pencil, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { FormDialog } from '@/components/ui/form-dialog';
import { DeleteDialog } from '@/components/ui/delete-dialog';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/services/api.client';
import { cn, timeAgo } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  isActive: boolean;
  lastLoginAt?: string;
  factory?: { code: string; name: string };
}

const roleColors: Record<string, string> = {
  SUPER_ADMIN:            'text-red-400 bg-red-500/20 border-red-500/30',
  FACTORY_ADMIN:          'text-purple-400 bg-purple-500/20 border-purple-500/30',
  PLANT_MANAGER:          'text-purple-400 bg-purple-500/20 border-purple-500/30',
  PRODUCTION_SUPERVISOR:  'text-blue-400 bg-blue-500/20 border-blue-500/30',
  SHIFT_SUPERVISOR:       'text-blue-400 bg-blue-500/20 border-blue-500/30',
  QUALITY_ENGINEER:       'text-green-400 bg-green-500/20 border-green-500/30',
  MAINTENANCE_TECHNICIAN: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
  OPERATOR:               'text-cyan-400 bg-cyan-500/20 border-cyan-500/30',
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
}

const ROLE_FILTERS = ['All Roles', 'FACTORY_ADMIN', 'PLANT_MANAGER', 'PRODUCTION_SUPERVISOR', 'QUALITY_ENGINEER', 'MAINTENANCE_TECHNICIAN', 'OPERATOR'];

const ROLES = ['FACTORY_ADMIN', 'PLANT_MANAGER', 'PRODUCTION_SUPERVISOR', 'SHIFT_SUPERVISOR', 'QUALITY_ENGINEER', 'MAINTENANCE_TECHNICIAN', 'OPERATOR'];

export function UsersView() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('All Roles')
  const [formOpen, setFormOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; name: string } | null>(null)
  const [form, setForm] = useState({
    name: '', email: '', role: 'OPERATOR', department: '', jobTitle: '', phone: '', password: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['users', { search, role: roleFilter }],
    queryFn: () => api.get('/users', {
      params: {
        search: search || undefined,
        role: roleFilter === 'All Roles' ? undefined : roleFilter,
        limit: 50,
      },
    }),
    staleTime: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: (dto: any) => api.post('/users', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'User created successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to create user', variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => api.patch(`/users/${id}`, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'User updated successfully' })
      handleCloseForm()
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to update user', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'User deleted successfully' })
      setDeleteDialog(null)
    },
    onError: (e: any) => toast({ title: 'Error', description: e?.response?.data?.message ?? 'Failed to delete user', variant: 'destructive' }),
  })

  const users: User[] = (data as any)?.data ?? (data as any) ?? [];

  const handleOpenCreate = () => {
    setEditUser(null)
    setForm({ name: '', email: '', role: 'OPERATOR', department: '', jobTitle: '', phone: '', password: '' })
    setFormOpen(true)
  };

  const handleOpenEdit = (user: User) => {
    setEditUser(user)
    setForm({ name: user.name, email: user.email, role: user.role, department: user.department || '', jobTitle: '', phone: '', password: '' })
    setFormOpen(true)
  };

  const handleCloseForm = () => {
    setFormOpen(false)
    setEditUser(null)
  };

  const handleSubmit = () => {
    if (editUser) {
      updateMutation.mutate({ id: editUser.id, dto: form })
    } else {
      createMutation.mutate(form)
    }
  };

  const isValid = !!(form.name && form.email && form.role && (!editUser ? form.password.length >= 6 : true))

  const activeCount = users.filter(u => u.isActive).length;
  const deptSet = new Set(users.map(u => u.department).filter(Boolean))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage platform users, roles, and permissions</p>
        </div>
        <Button size="sm" onClick={handleOpenCreate}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users',  value: users.length,     icon: Users,        color: 'text-brand-400' },
          { label: 'Active',       value: activeCount,      icon: CheckCircle,  color: 'text-green-400' },
          { label: 'Inactive',     value: users.length - activeCount, icon: XCircle, color: 'text-gray-400' },
          { label: 'Departments',  value: deptSet.size,     icon: Users,        color: 'text-cyan-400'  },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass-card rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-foreground/5 flex items-center justify-center">
                <Icon className={cn('w-4 h-4', stat.color)} />
              </div>
              <div>
                <div className="text-xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search users..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              {roleFilter === 'All Roles' ? 'All Roles' : roleFilter.replace(/_/g, ' ')}
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {ROLE_FILTERS.map(r => (
              <DropdownMenuItem key={r} onClick={() => setRoleFilter(r)}>
                {r === 'All Roles' ? r : r.replace(/_/g, ' ')}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 text-muted-foreground font-medium">User</th>
              <th className="text-left p-4 text-muted-foreground font-medium">Role</th>
              <th className="text-left p-4 text-muted-foreground font-medium">Department</th>
              <th className="text-left p-4 text-muted-foreground font-medium">Factory</th>
              <th className="text-left p-4 text-muted-foreground font-medium">Status</th>
              <th className="text-left p-4 text-muted-foreground font-medium">Last Login</th>
              <th className="text-right p-4 text-muted-foreground font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="p-4"><div className="shimmer h-4 rounded w-24" /></td>
                  ))}
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">No users found</td>
              </tr>
            ) : (
              users.map((user, i) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/50 hover:bg-foreground/5"
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
                          <Mail className="w-3 h-3" />{user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <Badge className={cn('text-[10px]', roleColors[user.role] ?? '')}>
                      {user.role.replace(/_/g, ' ')}
                    </Badge>
                  </td>
                  <td className="p-4 text-muted-foreground text-xs">{user.department ?? '—'}</td>
                  <td className="p-4 text-muted-foreground text-xs">{user.factory?.code ?? '—'}</td>
                  <td className="p-4">
                    <div className={cn('flex items-center gap-1.5 text-xs', user.isActive ? 'text-green-400' : 'text-gray-400')}>
                      {user.isActive ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {user.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </td>
                  <td className="p-4 text-xs text-muted-foreground">
                    {user.lastLoginAt ? timeAgo(user.lastLoginAt) : 'Never'}
                  </td>
                  <td className="p-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenEdit(user)}>
                          <Pencil className="w-3.5 h-3.5 mr-2" />Edit User
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog({ id: user.id, name: user.name })}>
                          <Trash2 className="w-3.5 h-3.5 mr-2" />Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <FormDialog
        open={formOpen}
        onClose={handleCloseForm}
        title={editUser ? 'Edit User' : 'Create User'}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        isValid={isValid}
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Name *</Label>
            <Input value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={e => setForm(v => ({ ...v, email: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Role *</Label>
            <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Department</Label>
            <Input value={form.department} onChange={e => setForm(v => ({ ...v, department: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Job Title</Label>
            <Input value={form.jobTitle} onChange={e => setForm(v => ({ ...v, jobTitle: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => setForm(v => ({ ...v, phone: e.target.value }))} className="mt-1" />
          </div>
          {!editUser && (
            <div className="col-span-2">
              <Label>Password *</Label>
              <Input type="password" value={form.password} onChange={e => setForm(v => ({ ...v, password: e.target.value }))} className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Minimum 6 characters</p>
            </div>
          )}
        </div>
      </FormDialog>

      <DeleteDialog
        open={!!deleteDialog}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
        title={`Delete ${deleteDialog?.name}?`}
        description="This will permanently delete this user and all associated data."
        isDeleting={deleteMutation.isPending}
      />
    </div>
  )
}
