import { create } from 'zustand';
import type { GCP } from '../types';

interface ProcessingState {
  // Image data
  rawImages: string[];
  currentImageIndex: number;
  rectifiedImages: string[];
  rectifiedMaskImages: string[];
  currentMaskImageIndex: number;
  
  // Shoreline editing
  currentShorelineImageIndex: number;
  totalShorelineImages: number;
  
  // GCP data
  gcpList: GCP[];

  // Actions
  setRawImages: (images: string[]) => void;
  setCurrentImageIndex: (index: number) => void;
  setRectifiedImages: (images: string[]) => void;
  setRectifiedMaskImages: (images: string[]) => void;
  setCurrentMaskImageIndex: (index: number) => void;
  setCurrentShorelineImageIndex: (index: number) => void;
  setTotalShorelineImages: (total: number) => void;
  setGcpList: (gcps: GCP[]) => void;
  resetProcessingState: () => void;
}

export const useProcessingStore = create<ProcessingState>((set) => ({
  // Initial state
  rawImages: [],
  currentImageIndex: 0,
  rectifiedImages: [],
  rectifiedMaskImages: [],
  currentMaskImageIndex: 0,
  currentShorelineImageIndex: 0,
  totalShorelineImages: 0,
  gcpList: [],

  // Actions
  setRawImages: (images) => set({ rawImages: images, currentImageIndex: 0 }),
  setCurrentImageIndex: (index) => set({ currentImageIndex: index }),
  setRectifiedImages: (images) => set({ rectifiedImages: images }),
  setRectifiedMaskImages: (images) => set({ rectifiedMaskImages: images }),
  setCurrentMaskImageIndex: (index) => set({ currentMaskImageIndex: index }),
  setCurrentShorelineImageIndex: (index) => set({ currentShorelineImageIndex: index }),
  setTotalShorelineImages: (total) => set({ totalShorelineImages: total }),
  setGcpList: (gcps) => set({ gcpList: gcps }),
  
  resetProcessingState: () => set({
    rawImages: [],
    currentImageIndex: 0,
    rectifiedImages: [],
    rectifiedMaskImages: [],
    currentMaskImageIndex: 0,
    currentShorelineImageIndex: 0,
    totalShorelineImages: 0,
    gcpList: []
  })
}));