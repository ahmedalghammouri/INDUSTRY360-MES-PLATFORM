import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { FACTORIES, Factory } from '@/features/factory-selector/factories';

interface FactoryState {
  selectedFactoryId: string | null;
  selectedFactory: Factory | null;
  setFactory: (id: string) => void;
  clearFactory: () => void;
}

export const useFactoryStore = create<FactoryState>()(
  persist(
    (set) => ({
      selectedFactoryId: null,
      selectedFactory: null,
      setFactory: (id) => {
        const factory = FACTORIES.find((f) => f.id === id) ?? null;
        set({ selectedFactoryId: id, selectedFactory: factory });
      },
      clearFactory: () => set({ selectedFactoryId: null, selectedFactory: null }),
    }),
    {
      name: 'industry360-factory',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
