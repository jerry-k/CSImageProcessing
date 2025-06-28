import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSiteStore } from '../stores/useSiteStore';
import { useStatusStore } from '../stores/useStatusStore';
import { AddSiteForm } from '../components/setup/AddSiteForm';
import { ImageDownloader } from '../components/setup/ImageDownloader';
import { ControlImageSelector } from '../components/setup/ControlImageSelector';
import { InteractiveGCPSelector as GCPSelector } from '../components/setup/InteractiveGCPSelector';
import { MaskCreatorWrapper as MaskCreator } from '../components/setup/MaskCreatorWrapper';
import { AssetUploaderWrapper as AssetUploader } from '../components/setup/AssetUploaderWrapper';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import api from '../services/api';

type SetupStep = 'site-info' | 'download-images' | 'control-image' | 'gcps' | 'mask' | 'assets' | 'complete';

export function SiteSetup() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<SetupStep>('site-info');
  const [checkingSetup, setCheckingSetup] = useState(true);
  const { selectedSite, siteConfirmed } = useSiteStore();
  const { setStatusMessage, setErrorMessage } = useStatusStore();

  const steps: { id: SetupStep; label: string; description: string }[] = [
    { id: 'site-info', label: 'Site Information', description: 'Create or select a site' },
    { id: 'download-images', label: 'Download Images', description: 'Download raw images from CoastSnap' },
    { id: 'control-image', label: 'Control Image', description: 'Select the reference image' },
    { id: 'gcps', label: 'Ground Control Points', description: 'Mark GCPs on the control image' },
    { id: 'mask', label: 'ROI Mask', description: 'Define the region of interest' },
    { id: 'assets', label: 'Additional Assets', description: 'Upload database and transects' },
    { id: 'complete', label: 'Complete', description: 'Setup complete!' }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  useEffect(() => {
    // Check setup progress when resuming an existing site
    if (selectedSite && siteConfirmed) {
      checkSetupProgress();
    } else {
      setCheckingSetup(false);
    }
  }, [selectedSite, siteConfirmed]);

  const checkSetupProgress = async () => {
    try {
      setCheckingSetup(true);
      // Check which files exist to determine progress
      const setupStatus = await api.checkSetup();
      
      // Determine the appropriate step based on what's completed
      if (setupStatus.mask && setupStatus.gcps) {
        setCurrentStep('assets'); // Everything done, just need assets
      } else if (setupStatus.gcps) {
        setCurrentStep('mask'); // GCPs done, need mask
      } else if (setupStatus.control_image) {
        setCurrentStep('gcps'); // Control image selected, need GCPs
      } else {
        setCurrentStep('download-images'); // Need to download images or select control
      }
      
      const resumeStep = 
        (setupStatus.mask && setupStatus.gcps) ? 'assets' :
        setupStatus.gcps ? 'mask' :
        setupStatus.control_image ? 'gcps' :
        'download-images';
      
      // Check if this is a new site
      const isNew = sessionStorage.getItem('isNewSite') === 'true';
      if (isNew) {
        sessionStorage.removeItem('isNewSite'); // Clear the flag
        // Don't show resuming message for new sites
      } else if (resumeStep !== 'download-images') {
        // Only show "Resuming" message if we're actually resuming
        setStatusMessage(`Resuming setup at: ${steps.find(s => s.id === resumeStep)?.label}`);
      }
    } catch (error) {
      // If we can't check, start from the beginning
      setCurrentStep('site-info');
    } finally {
      setCheckingSetup(false);
    }
  };

  const handleStepComplete = () => {
    const stepIndex = steps.findIndex(s => s.id === currentStep);
    if (stepIndex < steps.length - 1) {
      setCurrentStep(steps[stepIndex + 1].id);
    }
  };

  const handlePreviousStep = () => {
    const stepIndex = steps.findIndex(s => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1].id);
    }
  };

  const handleComplete = async () => {
    try {
      // Mark setup as complete in backend
      await api.completeSiteSetup(selectedSite);
      setStatusMessage('Site setup complete!');
      
      // Refresh site list to get updated status
      const sites = await api.listSites();
      useSiteStore.getState().setSiteList(sites);
      
      navigate(`/site/${selectedSite}/analysis`);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to complete setup');
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'site-info':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Site Information</h3>
            <AddSiteForm onSuccess={handleStepComplete} />
          </div>
        );

      case 'download-images':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Download Images</h3>
            <ImageDownloader />
            <button
              onClick={handleStepComplete}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Continue
            </button>
          </div>
        );

      case 'control-image':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Select Control Image</h3>
            <ControlImageSelector />
            <button
              onClick={handleStepComplete}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Continue
            </button>
          </div>
        );

      case 'gcps':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Mark Ground Control Points</h3>
            <GCPSelector />
            <button
              onClick={handleStepComplete}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Continue
            </button>
          </div>
        );

      case 'mask':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Create ROI Mask</h3>
            <MaskCreator />
            <button
              onClick={handleStepComplete}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Continue
            </button>
          </div>
        );

      case 'assets':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Upload Additional Assets</h3>
            <AssetUploader />
            <button
              onClick={handleStepComplete}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Complete Setup
            </button>
          </div>
        );

      case 'complete':
        return (
          <div className="space-y-6 text-center">
            <h3 className="text-2xl font-semibold text-green-600">Setup Complete!</h3>
            <p>Your site is ready for processing.</p>
            <button
              onClick={handleComplete}
              className="px-6 py-3 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Go to Analysis
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  if (checkingSetup) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Site Setup</h1>
        </div>
        <div className="flex justify-center items-center py-16">
          <div className="text-center">
            <LoadingSpinner />
            <p className="mt-4 text-gray-600">Checking setup progress...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Site Setup</h1>
      </div>

      {/* Progress Steps */}
      <div className="mb-12">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center ${index < steps.length - 1 ? 'flex-1' : ''}`}
            >
              <div className="relative">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold ${
                    index <= currentStepIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {index + 1}
                </div>
                <div className="absolute top-16 -left-10 w-28 text-center">
                  <p className="text-xs font-medium">{step.label}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-2 mx-3 ${
                    index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-md p-8 mb-6">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      {currentStepIndex > 0 && (
        <div className="flex justify-between">
          <button
            onClick={handlePreviousStep}
            className="text-blue-600 hover:text-blue-800"
          >
            ← Previous
          </button>
        </div>
      )}
    </div>
  );
}