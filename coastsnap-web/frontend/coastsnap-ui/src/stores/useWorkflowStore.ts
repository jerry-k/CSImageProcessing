import { create } from 'zustand';

interface WorkflowState {
  // Setup state
  setupComplete: boolean;
  checkingSetup: boolean;
  setupFlags: {
    complete: boolean;
    database: boolean;
    transects: boolean;
  } | null;

  // Workflow visibility state
  showControlImageSelector: boolean;
  showGcpSelector: boolean;
  showMaskCreator: boolean;
  showProcessingButton: boolean;
  showRectifiedMaskCreator: boolean;
  showShorelineEditor: boolean;
  showRegistered: boolean;

  // Actions
  setSetupComplete: (complete: boolean) => void;
  setCheckingSetup: (checking: boolean) => void;
  setSetupFlags: (flags: WorkflowState['setupFlags']) => void;
  setWorkflowVisibility: (updates: Partial<Omit<WorkflowState, 'setupComplete' | 'checkingSetup' | 'setupFlags' | 'setSetupComplete' | 'setCheckingSetup' | 'setSetupFlags' | 'setWorkflowVisibility' | 'resetWorkflow'>>) => void;
  resetWorkflow: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  // Initial state
  setupComplete: false,
  checkingSetup: false,
  setupFlags: null,
  showControlImageSelector: false,
  showGcpSelector: false,
  showMaskCreator: false,
  showProcessingButton: false,
  showRectifiedMaskCreator: false,
  showShorelineEditor: false,
  showRegistered: false,

  // Actions
  setSetupComplete: (complete) => set({ setupComplete: complete }),
  setCheckingSetup: (checking) => set({ checkingSetup: checking }),
  setSetupFlags: (flags) => set({ setupFlags: flags }),
  
  setWorkflowVisibility: (updates) => set(updates),
  
  resetWorkflow: () => set({
    showControlImageSelector: false,
    showGcpSelector: false,
    showMaskCreator: false,
    showProcessingButton: false,
    showRectifiedMaskCreator: false,
    showShorelineEditor: false,
    showRegistered: false
  })
}));