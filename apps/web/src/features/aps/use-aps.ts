'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apsService } from '@/services/aps.service';
import { toast } from '@/components/ui/use-toast';

export function useApsPlan() {
  return useQuery({
    queryKey: ['aps', 'plan'],
    queryFn: () => apsService.getPlan(),
    staleTime: 15_000,
  });
}

export function useApsMrp() {
  return useQuery({
    queryKey: ['aps', 'mrp'],
    queryFn: () => apsService.getMrp(),
    staleTime: 30_000,
  });
}

export function useRunSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { startFrom?: string } = {}) => apsService.runSchedule(body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['aps'] });
      toast({
        title: `Plan recalculated — ${res.scheduled} operations scheduled`,
        description: `Makespan ${res.makespanHours}h · ${res.onTimePct}% on-time · ${res.utilizationPct}% utilization`,
      });
    },
    onError: (e: unknown) => toast({
      title: 'Could not recalculate the plan',
      description: (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Please try again',
      variant: 'destructive',
    }),
  });
}

export function useRescheduleJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { jobId: string; machineId?: string; start: string; end?: string }) =>
      apsService.rescheduleJob(body),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['aps'] });
      if (res.rippledSuccessors > 0) {
        toast({ title: 'Operation rescheduled', description: `${res.rippledSuccessors} downstream step(s) shifted` });
      }
    },
    onError: (e: unknown) => toast({
      title: 'Reschedule failed',
      description: (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Please try again',
      variant: 'destructive',
    }),
  });
}

export function useCtp() {
  return useMutation({
    mutationFn: (body: { skuId: string; quantity: number; dueDate?: string }) => apsService.ctp(body),
  });
}
