import { create } from 'zustand';

interface StatusState {
  // General status
  statusMessage: string;
  errorMessage: string;
  isLoading: boolean;
  initialLoading: boolean;

  // Component-specific statuses
  siteStatus: string;
  selectorStatus: string;
  gcpStatus: string;
  maskStatus: string;
  processingStatus: string;
  shorelineStatus: string;
  rectifiedMaskStatus: string;

  // Component-specific loading states
  isSelectorLoading: boolean;
  isProcessing: boolean;

  // Actions
  setStatusMessage: (message: string) => void;
  setErrorMessage: (message: string) => void;
  setIsLoading: (loading: boolean) => void;
  setInitialLoading: (loading: boolean) => void;
  setSiteStatus: (status: string) => void;
  setSelectorStatus: (status: string) => void;
  setGcpStatus: (status: string) => void;
  setMaskStatus: (status: string) => void;
  setProcessingStatus: (status: string) => void;
  setShorelineStatus: (status: string) => void;
  setRectifiedMaskStatus: (status: string) => void;
  setSelectorLoading: (loading: boolean) => void;
  setIsProcessing: (processing: boolean) => void;
  clearAllStatuses: () => void;
}

export const useStatusStore = create<StatusState>((set) => ({
  // Initial state
  statusMessage: '',
  errorMessage: '',
  isLoading: false,
  initialLoading: true,
  siteStatus: '',
  selectorStatus: '',
  gcpStatus: '',
  maskStatus: '',
  processingStatus: '',
  shorelineStatus: '',
  rectifiedMaskStatus: '',
  isSelectorLoading: false,
  isProcessing: false,

  // Actions
  setStatusMessage: (message) => set({ statusMessage: message }),
  setErrorMessage: (message) => set({ errorMessage: message }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setInitialLoading: (loading) => set({ initialLoading: loading }),
  setSiteStatus: (status) => set({ siteStatus: status }),
  setSelectorStatus: (status) => set({ selectorStatus: status }),
  setGcpStatus: (status) => set({ gcpStatus: status }),
  setMaskStatus: (status) => set({ maskStatus: status }),
  setProcessingStatus: (status) => set({ processingStatus: status }),
  setShorelineStatus: (status) => set({ shorelineStatus: status }),
  setRectifiedMaskStatus: (status) => set({ rectifiedMaskStatus: status }),
  setSelectorLoading: (loading) => set({ isSelectorLoading: loading }),
  setIsProcessing: (processing) => set({ isProcessing: processing }),
  
  clearAllStatuses: () => set({
    statusMessage: '',
    errorMessage: '',
    siteStatus: '',
    selectorStatus: '',
    gcpStatus: '',
    maskStatus: '',
    processingStatus: '',
    shorelineStatus: '',
    rectifiedMaskStatus: ''
  })
}));