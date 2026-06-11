'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Settings,
  User,
  Shield,
  Bell,
  Globe,
  Database,
  Palette,
  Key,
  CheckCircle,
  QrCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectMenu } from '@/components/ui/select-menu';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/auth-store';
import { authService } from '@/services/auth.service';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z.string().min(8, 'Minimum 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'language', label: 'Language & Region', icon: Globe },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'integrations', label: 'Integrations', icon: Database },
];

export function SettingsView() {
  const { user } = useAuthStore();
  const [activeSection, setActiveSection] = useState('profile');
  const [language, setLanguage] = useState('en');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [timeZone, setTimeZone] = useState('Asia/Riyadh (UTC+3)');
  const [numberFormat, setNumberFormat] = useState('1,234.56');
  const [mfaSetupData, setMfaSetupData] = useState<{ qrCode: string; secret: string } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormData>({ resolver: zodResolver(passwordSchema) });

  const handlePasswordChange = async (data: PasswordFormData) => {
    try {
      await authService.changePassword(data.currentPassword, data.newPassword);
      toast({ title: 'Password changed', description: 'Your password has been updated successfully.' });
      reset();
      setChangingPassword(false);
    } catch {
      toast({ title: 'Error', description: 'Current password is incorrect.', variant: 'destructive' });
    }
  };

  // MFA enrollment endpoint is not implemented on the backend yet —
  // the button stays visible but disabled until /auth/mfa/setup exists.
  const handleSetupMFA = () => {
    toast({ title: 'Coming soon', description: 'MFA enrollment is not available yet.' });
  };

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account and platform preferences</p>
      </div>

      <div className="flex gap-6">
        <div className="w-48 shrink-0">
          <nav className="space-y-1">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                    activeSection === section.id
                      ? 'bg-brand-600/20 text-brand-300'
                      : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 glass-card rounded-xl p-6">
          {activeSection === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Profile Information</h2>
                <p className="text-sm text-muted-foreground">Update your personal details</p>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input defaultValue={user?.name?.split(' ')[0] || ''} />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input defaultValue={user?.name?.split(' ')[1] || ''} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Email Address</Label>
                  <Input defaultValue={user?.email || ''} disabled />
                  <p className="text-xs text-muted-foreground">Email cannot be changed. Contact admin.</p>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input defaultValue={user?.role || ''} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input defaultValue="Operations" />
                </div>
              </div>
              <Button>Save Changes</Button>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Security Settings</h2>
                <p className="text-sm text-muted-foreground">Manage your password and two-factor authentication</p>
              </div>
              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Change Password</h3>
                {!changingPassword ? (
                  <Button variant="outline" onClick={() => setChangingPassword(true)}>
                    <Key className="w-4 h-4 mr-2" />
                    Change Password
                  </Button>
                ) : (
                  <form onSubmit={handleSubmit(handlePasswordChange)} className="space-y-3 max-w-sm">
                    <div className="space-y-2">
                      <Label>Current Password</Label>
                      <Input type="password" {...register('currentPassword')} />
                      {errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>New Password</Label>
                      <Input type="password" {...register('newPassword')} />
                      {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Confirm New Password</Label>
                      <Input type="password" {...register('confirmPassword')} />
                      {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Updating...' : 'Update Password'}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => { setChangingPassword(false); reset(); }}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">Two-Factor Authentication</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Add an extra layer of security using an authenticator app
                    </p>
                  </div>
                  {user?.mfaEnabled ? (
                    <div className="flex items-center gap-2 text-green-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Enabled
                    </div>
                  ) : (
                    <Button size="sm" onClick={handleSetupMFA}>
                      <QrCode className="w-4 h-4 mr-2" />
                      Setup MFA
                    </Button>
                  )}
                </div>

                {mfaSetupData && (
                  <div className="bg-foreground/5 rounded-lg p-4 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                    </p>
                    <div className="w-48 h-48 bg-white rounded-lg flex items-center justify-center">
                      <img src={mfaSetupData.qrCode} alt="MFA QR Code" className="w-44 h-44" />
                    </div>
                    <div>
                      <Label className="text-xs">Manual Entry Key</Label>
                      <Input value={mfaSetupData.secret} readOnly className="font-mono text-xs mt-1" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Notification Preferences</h2>
                <p className="text-sm text-muted-foreground">Configure how and when you receive alerts</p>
              </div>
              <Separator />
              <div className="space-y-4">
                {[
                  { label: 'Critical Alarms', desc: 'Immediate notification for CRITICAL severity alarms', enabled: true },
                  { label: 'Work Order Updates', desc: 'When work orders are assigned, started, or completed', enabled: true },
                  { label: 'Quality NCR Created', desc: 'When a new non-conformance report is opened', enabled: true },
                  { label: 'Maintenance Due', desc: '48h advance notice for scheduled maintenance', enabled: false },
                  { label: 'Daily OEE Summary', desc: 'Morning digest of previous day OEE performance', enabled: false },
                  { label: 'System Health', desc: 'Infrastructure and connectivity alerts', enabled: true },
                ].map((pref) => (
                  <div key={pref.label} className="flex items-center justify-between py-2">
                    <div>
                      <div className="text-sm font-medium">{pref.label}</div>
                      <div className="text-xs text-muted-foreground">{pref.desc}</div>
                    </div>
                    <button
                      className={cn(
                        'relative w-10 h-5 rounded-full transition-colors',
                        pref.enabled ? 'bg-brand-600' : 'bg-foreground/20',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                          pref.enabled ? 'translate-x-5' : 'translate-x-0.5',
                        )}
                      />
                    </button>
                  </div>
                ))}
              </div>
              <Button>Save Preferences</Button>
            </div>
          )}

          {activeSection === 'language' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Language & Region</h2>
                <p className="text-sm text-muted-foreground">Configure display language and regional settings</p>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <div className="space-y-2">
                  <Label>Interface Language</Label>
                  <SelectMenu
                    size="md"
                    fullWidth
                    value={language}
                    onValueChange={setLanguage}
                    options={[
                      { value: 'en', label: 'English' },
                      { value: 'ar', label: 'العربية (Arabic)' },
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date Format</Label>
                  <SelectMenu
                    size="md"
                    fullWidth
                    value={dateFormat}
                    onValueChange={setDateFormat}
                    options={[
                      { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                      { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                      { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time Zone</Label>
                  <SelectMenu
                    size="md"
                    fullWidth
                    value={timeZone}
                    onValueChange={setTimeZone}
                    options={[
                      { value: 'Asia/Riyadh (UTC+3)', label: 'Asia/Riyadh (UTC+3)' },
                      { value: 'UTC', label: 'UTC' },
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Number Format</Label>
                  <SelectMenu
                    size="md"
                    fullWidth
                    value={numberFormat}
                    onValueChange={setNumberFormat}
                    options={[
                      { value: '1,234.56', label: '1,234.56' },
                      { value: '1.234,56', label: '1.234,56' },
                    ]}
                  />
                </div>
              </div>
              <Button>Save Settings</Button>
            </div>
          )}

          {(activeSection === 'appearance' || activeSection === 'integrations') && (
            <div className="py-12 text-center text-muted-foreground">
              <Settings className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <div className="font-medium">Coming soon</div>
              <div className="text-sm mt-1">This settings section is under development</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
