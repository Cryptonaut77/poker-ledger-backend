import { create } from 'zustand';

interface TableStore {
  selectedTableId: string | null;
  setSelectedTableId: (id: string) => void;
}

export const useTableStore = create<TableStore>((set) => ({
  selectedTableId: null,
  setSelectedTableId: (id: string) => set({ selectedTableId: id }),
}));
