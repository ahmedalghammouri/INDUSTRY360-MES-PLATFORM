'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitPullRequest,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  Eye,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { cn, generateId, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';

// ── Types ────────────────────────────────────────────────────────

interface ChangeRequest {
  id: string;
  crNumber: string;
  title: string;
  description: string;
  type: 'BOM_CHANGE' | 'RECIPE_CHANGE' | 'PROCESS_CHANGE' | 'DESIGN_CHANGE';
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'IMPLEMENTED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedProduct: string;
  requestedBy: string;
  reviewedBy?: string;
  createdAt: string;
  targetDate: string;
  reason: string;
}

// ── Mock Data ────────────────────────────────────────────────────

const MOCK_CRS: ChangeRequest[] = [
  {
    id: '1',
    crNumber: 'ECR-2026-001',
    title: 'Update BOM for Orange Juice 1L — new cap supplier',
    description: 'Supplier A discontinuing plastic cap SKU-CAP-22. Switch to SKU-CAP-24 from Supplier B with identical spec.',
    type: 'BOM_CHANGE',
    status: 'APPROVED',
    priority: 'HIGH',
    affectedProduct: 'SKU-001 Orange Juice 1L',
    requestedBy: 'Ahmed Al-Rashid',
    reviewedBy: 'Sara Khalid',
    createdAt: '2026-05-10T08:00:00Z',
    targetDate: '2026-06-15',
    reason: 'Supplier change requires BOM update to maintain production continuity',
  },
  {
    id: '2',
    crNumber: 'ECR-2026-002',
    title: 'Reduce pasteurization temp in Mango Juice recipe',
    description: 'Quality team recommends reducing pasteurization from 85°C to 82°C to preserve vitamin C content by ~12%.',
    type: 'RECIPE_CHANGE',
    status: 'UNDER_REVIEW',
    priority: 'MEDIUM',
    affectedProduct: 'SKU-007 Mango Juice 500ml',
    requestedBy: 'Fatima Hussain',
    reviewedBy: 'Dr. Youssef Nasser',
    createdAt: '2026-05-18T10:30:00Z',
    targetDate: '2026-06-20',
    reason: 'Nutritional improvement based on R&D lab findings — vitamin C degradation at 85°C exceeds spec',
  },
  {
    id: '3',
    crNumber: 'ECR-2026-003',
    title: 'Add inline weight check to Bottling Line 3',
    description: 'Insert automatic checkweigher station between filler and capper on Line 3 to catch underfills in real time.',
    type: 'PROCESS_CHANGE',
    status: 'SUBMITTED',
    priority: 'HIGH',
    affectedProduct: 'All 1L PET Bottled Products',
    requestedBy: 'Khalid Al-Mansouri',
    createdAt: '2026-05-22T09:15:00Z',
    targetDate: '2026-07-01',
    reason: 'Three customer complaints for underfill in Q1 2026; ISO 9001 corrective action required',
  },
  {
    id: '4',
    crNumber: 'ECR-2026-004',
    title: 'Redesign label artwork for Apple Juice export pack',
    description: 'EU regulation update requires allergen info in 12pt minimum font. Current artwork uses 9pt.',
    type: 'DESIGN_CHANGE',
    status: 'APPROVED',
    priority: 'CRITICAL',
    affectedProduct: 'SKU-012 Apple Juice 330ml Export',
    requestedBy: 'Laila Al-Zahrani',
    reviewedBy: 'Omar Bakr',
    createdAt: '2026-04-30T07:45:00Z',
    targetDate: '2026-05-30',
    reason: 'EU 1169/2011 amendment — non-compliance risks product recall and export ban from June 2026',
  },
  {
    id: '5',
    crNumber: 'ECR-2026-005',
    title: 'Replace preservative E211 with E202 in Guava Nectar',
    description: 'Marketing-driven reformulation to achieve "clean label" positioning. Shelf-life impact assessment in progress.',
    type: 'RECIPE_CHANGE',
    status: 'DRAFT',
    priority: 'MEDIUM',
    affectedProduct: 'SKU-019 Guava Nectar 1L',
    requestedBy: 'Nour Al-Qasim',
    createdAt: '2026-06-01T11:00:00Z',
    targetDate: '2026-08-01',
    reason: 'Clean-label product strategy — consumer research shows 67% preference for E202 over E211',
  },
  {
    id: '6',
    crNumber: 'ECR-2026-006',
    title: 'Update mixing sequence for Tomato Paste concentrate',
    description: 'Engineering proposes reversing salt-addition order to prevent caking on agitator blades.',
    type: 'PROCESS_CHANGE',
    status: 'IMPLEMENTED',
    priority: 'LOW',
    affectedProduct: 'SKU-031 Tomato Paste 800g',
    requestedBy: 'Hassan Al-Farsi',
    reviewedBy: 'Ibrahim Saleh',
    createdAt: '2026-03-12T14:00:00Z',
    targetDate: '2026-04-01',
    reason: 'Reduce agitator maintenance frequency from weekly to monthly; current caking adds 45 min/week downtime',
  },
  {
    id: '7',
    crNumber: 'ECR-2026-007',
    title: 'BOM revision — substitute glass bottles with PET for Mineral Water 500ml',
    description: 'Phase-out glass packaging on Line 1 to reduce breakage waste and freight cost.',
    type: 'BOM_CHANGE',
    status: 'REJECTED',
    priority: 'HIGH',
    affectedProduct: 'SKU-045 Mineral Water 500ml Glass',
    requestedBy: 'Aisha Al-Otaibi',
    reviewedBy: 'Tariq Hamdan',
    createdAt: '2026-04-05T09:00:00Z',
    targetDate: '2026-06-01',
    reason: 'Cost reduction initiative — PET substitution saves SAR 0.18/unit; annual saving ~SAR 540K',
  },
  {
    id: '8',
    crNumber: 'ECR-2026-008',
    title: 'Adjust fill volume tolerance for Lemonade 250ml can',
    description: 'Tighten fill tolerance from ±3ml to ±1.5ml to reduce overfill giveaway.',
    type: 'PROCESS_CHANGE',
    status: 'UNDER_REVIEW',
    priority: 'MEDIUM',
    affectedProduct: 'SKU-052 Lemonade Can 250ml',
    requestedBy: 'Reem Al-Harbi',
    reviewedBy: 'Walid Nassar',
    createdAt: '2026-05-28T08:30:00Z',
    targetDate: '2026-06-30',
    reason: 'Overfill giveaway costing SAR 0.04/can; line produces 120K cans/day; annual impact SAR 1.75M',
  },
  {
    id: '9',
    crNumber: 'ECR-2026-009',
    title: 'New outer carton design for Dairy Line gift packs',
    description: 'Seasonal Ramadan packaging redesign — gold foil embossed carton replacing standard brown kraft.',
    type: 'DESIGN_CHANGE',
    status: 'DRAFT',
    priority: 'LOW',
    affectedProduct: 'SKU-060 Dairy Gift Pack Assorted',
    requestedBy: 'Mona Al-Rasheed',
    createdAt: '2026-06-03T13:00:00Z',
    targetDate: '2026-12-01',
    reason: 'Annual seasonal packaging programme — Q4 2026 Ramadan campaign launch',
  },
  {
    id: '10',
    crNumber: 'ECR-2026-010',
    title: 'Increase sterilization dwell time for canned vegetables',
    description: 'SFDA advisory recommends F0 value increase from 6 to 8 minutes for low-acid canned goods following industry alert.',
    type: 'RECIPE_CHANGE',
    status: 'SUBMITTED',
    priority: 'CRITICAL',
    affectedProduct: 'All Canned Vegetable SKUs (18 products)',
    requestedBy: 'Dr. Sameer Al-Khatib',
    createdAt: '2026-06-05T07:00:00Z',
    targetDate: '2026-06-12',
    reason: 'SFDA Circular 2026-F-041: mandatory F0 uplift for Clostridium botulinum risk mitigation',
  },
];

// ── Config ───────────────────────────────────────────────────────

const TYPE_LABELS: Record<ChangeRequest['type'], string> = {
  BOM_CHANGE: 'BOM',
  RECIPE_CHANGE: 'Recipe',
  PROCESS_CHANGE: 'Process',
  DESIGN_CHANGE: 'Design',
};

const TYPE_COLORS: Record<ChangeRequest['type'], string> = {
  BOM_CHANGE: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  RECIPE_CHANGE: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  PROCESS_CHANGE: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  DESIGN_CHANGE: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
};

const PRIORITY_COLORS: Record<ChangeRequest['priority'], string> = {
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  LOW: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const STATUS_COLORS: Record<ChangeRequest['status'], string> = {
  DRAFT: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  SUBMITTED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  UNDER_REVIEW: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  APPROVED: 'bg-green-500/20 text-green-400 border-green-500/30',
  REJECTED: 'bg-red-500/20 text-red-400 border-red-500/30',
  IMPLEMENTED: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

const STATUS_LABELS: Record<ChangeRequest['status'], string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  IMPLEMENTED: 'Implemented',
};

const PIE_COLORS = ['#3b82f6', '#a855f7', '#f59e0b', '#ec4899'];

const WORKFLOW_STEPS = [
  { label: 'Draft', color: 'bg-gray-500' },
  { label: 'Submitted', color: 'bg-blue-500' },
  { label: 'Under Review', color: 'bg-yellow-500' },
  { label: 'Approved / Rejected', color: 'bg-green-500' },
  { label: 'Implemented', color: 'bg-purple-500' },
];

// ── Toast ─────────────────────────────────────────────────────────

interface ToastMsg {
  id: string;
  message: string;
  variant: 'success' | 'error';
}

// ── Main Component ────────────────────────────────────────────────

export default function PlmChangeRequestsView() {
  const [crs, setCrs] = useState<ChangeRequest[]>([...MOCK_CRS]);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailCr, setDetailCr] = useState<ChangeRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [crCounter, setCrCounter] = useState(11);

  // Create form state
  const [form, setForm] = useState({
    title: '',
    type: 'BOM_CHANGE' as ChangeRequest['type'],
    priority: 'MEDIUM' as ChangeRequest['priority'],
    affectedProduct: '',
    targetDate: '',
    reason: '',
  });

  // ── Toasts ──────────────────────────────────────────────────────
  const addToast = (message: string, variant: 'success' | 'error' = 'success') => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  };

  // ── Actions ─────────────────────────────────────────────────────
  const handleApprove = (cr: ChangeRequest) => {
    setCrs((prev) =>
      prev.map((c) => (c.id === cr.id ? { ...c, status: 'APPROVED', reviewedBy: 'Current User' } : c)),
    );
    addToast(`${cr.crNumber} approved successfully`, 'success');
  };

  const handleReject = (cr: ChangeRequest) => {
    setCrs((prev) =>
      prev.map((c) => (c.id === cr.id ? { ...c, status: 'REJECTED', reviewedBy: 'Current User' } : c)),
    );
    addToast(`${cr.crNumber} rejected`, 'error');
  };

  const handleCreate = () => {
    if (!form.title || !form.affectedProduct || !form.targetDate || !form.reason) return;
    const newCrNumber = `ECR-2026-${String(crCounter).padStart(3, '0')}`;
    const newCr: ChangeRequest = {
      id: generateId(),
      crNumber: newCrNumber,
      title: form.title,
      description: form.reason,
      type: form.type,
      status: 'SUBMITTED',
      priority: form.priority,
      affectedProduct: form.affectedProduct,
      requestedBy: 'Current User',
      createdAt: new Date().toISOString(),
      targetDate: form.targetDate,
      reason: form.reason,
    };
    setCrs((prev) => [newCr, ...prev]);
    setCrCounter((n) => n + 1);
    addToast(`Change request ${newCrNumber} submitted for review`, 'success');
    setForm({ title: '', type: 'BOM_CHANGE', priority: 'MEDIUM', affectedProduct: '', targetDate: '', reason: '' });
    setCreateOpen(false);
  };

  // ── KPIs ─────────────────────────────────────────────────────────
  const openCount = crs.filter((c) => ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW'].includes(c.status)).length;
  const underReviewCount = crs.filter((c) => c.status === 'UNDER_REVIEW').length;
  const approvedThisMonth = crs.filter((c) => {
    if (c.status !== 'APPROVED') return false;
    const d = new Date(c.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const rejectedCount = crs.filter((c) => c.status === 'REJECTED').length;

  // ── Filtered list ─────────────────────────────────────────────
  const filtered = crs.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      c.crNumber.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      c.affectedProduct.toLowerCase().includes(q) ||
      c.requestedBy.toLowerCase().includes(q);
    const matchType = typeFilter === 'ALL' || c.type === typeFilter;
    const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;
    const matchPriority = priorityFilter === 'ALL' || c.priority === priorityFilter;
    return matchSearch && matchType && matchStatus && matchPriority;
  });

  // ── Pie data ──────────────────────────────────────────────────
  const typeCounts = (['BOM_CHANGE', 'RECIPE_CHANGE', 'PROCESS_CHANGE', 'DESIGN_CHANGE'] as const).map((t) => ({
    name: TYPE_LABELS[t],
    value: crs.filter((c) => c.type === t).length,
  }));

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen space-y-6 p-6">
      {/* Toast container */}
      <div className="fixed right-4 top-4 z-[100] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ duration: 0.25 }}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium shadow-xl',
                t.variant === 'success'
                  ? 'border-green-500/40 bg-green-500/10 text-green-300'
                  : 'border-red-500/40 bg-red-500/10 text-red-300',
              )}
            >
              {t.variant === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/20">
            <GitPullRequest className="h-5 w-5 text-brand-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Engineering Change Requests</h1>
            <p className="text-xs text-muted-foreground">ISA-95 PLM — Manage product & process change lifecycle</p>
          </div>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Change Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Submit New Change Request</DialogTitle>
            </DialogHeader>
            <div className="mt-2 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Title *</label>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Brief description of the change"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Type *</label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ChangeRequest['type'] }))}
                  >
                    <option value="BOM_CHANGE">BOM Change</option>
                    <option value="RECIPE_CHANGE">Recipe Change</option>
                    <option value="PROCESS_CHANGE">Process Change</option>
                    <option value="DESIGN_CHANGE">Design Change</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Priority *</label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as ChangeRequest['priority'] }))}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Affected Product *</label>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g. SKU-001 Orange Juice 1L"
                  value={form.affectedProduct}
                  onChange={(e) => setForm((f) => ({ ...f, affectedProduct: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Target Date *</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={form.targetDate}
                  onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Reason / Justification *</label>
                <textarea
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
                  rows={3}
                  placeholder="Describe the reason for this change..."
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!form.title || !form.affectedProduct || !form.targetDate || !form.reason}
              >
                Submit for Review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Open CRs', value: openCount, icon: GitPullRequest, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'Under Review', value: underReviewCount, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: 'Approved This Month', value: approvedThisMonth, icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Rejected', value: rejectedCount, icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
        ].map((kpi) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
              <div className={cn('rounded-lg p-2', kpi.bg)}>
                <kpi.icon className={cn('h-4 w-4', kpi.color)} />
              </div>
            </div>
            <p className={cn('mt-2 text-3xl font-bold', kpi.color)}>{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Workflow Banner ──────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card px-6 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">CR Workflow</p>
        <div className="flex flex-wrap items-center gap-2">
          {WORKFLOW_STEPS.map((step, idx) => (
            <div key={step.label} className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <span className={cn('h-2.5 w-2.5 rounded-full', step.color)} />
                <span className="text-sm font-medium text-foreground">{step.label}</span>
              </div>
              {idx < WORKFLOW_STEPS.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Filter Bar ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="h-9 min-w-[220px] flex-1 rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Search CR#, title, product, requester..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="ALL">All Types</option>
          <option value="BOM_CHANGE">BOM Change</option>
          <option value="RECIPE_CHANGE">Recipe Change</option>
          <option value="PROCESS_CHANGE">Process Change</option>
          <option value="DESIGN_CHANGE">Design Change</option>
        </select>
        <select
          className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="IMPLEMENTED">Implemented</option>
        </select>
        <select
          className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="ALL">All Priorities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['CR #', 'Title', 'Type', 'Priority', 'Affected Product', 'Status', 'Requested By', 'Target Date', 'Actions'].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((cr, i) => (
                  <motion.tr
                    key={cr.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/50 transition-colors hover:bg-muted/20"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-400">{cr.crNumber}</td>
                    <td className="max-w-[200px] px-4 py-3">
                      <p className="truncate font-medium text-foreground" title={cr.title}>
                        {cr.title}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold',
                          TYPE_COLORS[cr.type],
                        )}
                      >
                        {TYPE_LABELS[cr.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold',
                          PRIORITY_COLORS[cr.priority],
                        )}
                      >
                        {cr.priority === 'CRITICAL' && <AlertTriangle className="h-3 w-3" />}
                        {cr.priority.charAt(0) + cr.priority.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="max-w-[180px] px-4 py-3">
                      <p className="truncate text-muted-foreground" title={cr.affectedProduct}>
                        {cr.affectedProduct}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold',
                          STATUS_COLORS[cr.status],
                        )}
                      >
                        {STATUS_LABELS[cr.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{cr.requestedBy}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(cr.targetDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => { setDetailCr(cr); setDetailOpen(true); }}
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                        {cr.status === 'UNDER_REVIEW' && (
                          <>
                            <Button
                              size="sm"
                              className="h-7 gap-1 bg-green-600 px-2 text-xs hover:bg-green-700"
                              onClick={() => handleApprove(cr)}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={() => handleReject(cr)}
                            >
                              <XCircle className="h-3 w-3" />
                              Reject
                            </Button>
                          </>
                        )}
                        {cr.status === 'SUBMITTED' && (
                          <Button
                            size="sm"
                            className="h-7 gap-1 bg-yellow-600 px-2 text-xs hover:bg-yellow-700"
                            onClick={() =>
                              setCrs((prev) =>
                                prev.map((c) => (c.id === cr.id ? { ...c, status: 'UNDER_REVIEW' } : c)),
                              )
                            }
                          >
                            <Clock className="h-3 w-3" />
                            Start Review
                          </Button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                    No change requests match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Type Distribution Chart ──────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">CR Distribution by Type</h2>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={typeCounts}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={3}
              dataKey="value"
            >
              {typeCounts.map((_, index) => (
                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* ── Detail Dialog ─────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-xl">
          {detailCr && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="font-mono text-brand-400">{detailCr.crNumber}</span>
                  <span className="text-foreground">{detailCr.title}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="mt-2 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span className={cn('inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold', STATUS_COLORS[detailCr.status])}>
                    {STATUS_LABELS[detailCr.status]}
                  </span>
                  <span className={cn('inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold', PRIORITY_COLORS[detailCr.priority])}>
                    {detailCr.priority.charAt(0) + detailCr.priority.slice(1).toLowerCase()} Priority
                  </span>
                  <span className={cn('inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold', TYPE_COLORS[detailCr.type])}>
                    {TYPE_LABELS[detailCr.type]}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</p>
                  <p className="text-sm text-foreground">{detailCr.description}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reason / Justification</p>
                  <p className="text-sm text-foreground">{detailCr.reason}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Affected Product', value: detailCr.affectedProduct },
                    { label: 'Requested By', value: detailCr.requestedBy },
                    { label: 'Reviewed By', value: detailCr.reviewedBy ?? '—' },
                    { label: 'Created', value: formatDate(detailCr.createdAt) },
                    { label: 'Target Date', value: formatDate(detailCr.targetDate) },
                  ].map((row) => (
                    <div key={row.label} className="space-y-0.5">
                      <p className="text-xs font-medium text-muted-foreground">{row.label}</p>
                      <p className="text-sm font-medium text-foreground">{row.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter className="mt-4">
                {detailCr.status === 'UNDER_REVIEW' && (
                  <>
                    <Button
                      className="gap-1 bg-green-600 hover:bg-green-700"
                      onClick={() => { handleApprove(detailCr); setDetailOpen(false); }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      className="gap-1"
                      onClick={() => { handleReject(detailCr); setDetailOpen(false); }}
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={() => setDetailOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
