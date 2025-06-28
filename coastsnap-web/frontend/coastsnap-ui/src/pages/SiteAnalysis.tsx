import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSiteStore } from '../stores/useSiteStore';
import { useProcessingStore } from '../stores/useProcessingStore';
import { useStatusStore } from '../stores/useStatusStore';
import { GridView } from '../components/analysis/GridView';
import { OverlaysView } from '../components/analysis/OverlaysView';
import { ShorelineEditor } from '../components/editing/ShorelineEditor';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import api from '../services/api';
import { approvalCache } from '../services/approvalCache';

type ViewMode = 'timeline' | 'overlays' | 'trends';

export function SiteAnalysis() {
  const { siteName } = useParams<{ siteName: string }>();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const { setSelectedSite, setSiteConfirmed } = useSiteStore();
  const { rectifiedImages, setRectifiedImages } = useProcessingStore();
  const { setStatusMessage, setErrorMessage } = useStatusStore();

  useEffect(() => {
    if (siteName) {
      loadSiteData(siteName);
    }
  }, [siteName]);

  // Clear approval cache when leaving the page
  useEffect(() => {
    return () => {
      approvalCache.clear();
    };
  }, []);

  const loadSiteData = async (site: string) => {
    try {
      setLoading(true);
      // Set the site
      await api.setSite(site);
      setSelectedSite(site);
      setSiteConfirmed(true);

      // Load rectified images
      const images = await api.getRectifiedImages();
      if (images) {
        setRectifiedImages(images);
      }
    } catch (error) {
      setErrorMessage(`Failed to load site data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (index: number) => {
    setSelectedImageIndex(index);
    setShowEditor(true);
  };

  const handleRunProcessing = async () => {
    try {
      setStatusMessage('Starting registration and rectification...');
      await api.runProcessing(true); // skip_shoreline_mapping = true
      setStatusMessage('Images rectified! You can now detect and edit shorelines.');
      // Reload images
      const images = await api.getRectifiedImages();
      if (images) {
        setRectifiedImages(images);
      }
    } catch (error: any) {
      setErrorMessage(`Processing failed: ${error.message}`);
    }
  };

  const handleRunShorelineDetection = async () => {
    try {
      setStatusMessage('Running shoreline detection on all images...');
      await api.runShorelineMapping();
      setStatusMessage('Shoreline detection complete! Click on images to review and edit.');
    } catch (error: any) {
      setErrorMessage(`Shoreline detection failed: ${error.message}`);
    }
  };

  const handleGenerateOverlays = async () => {
    try {
      setStatusMessage('Generating overlays...');
      await api.downloadRegisteredOverlays();
      setStatusMessage('Overlays generated successfully!');
    } catch (error: any) {
      setErrorMessage(`Failed to generate overlays: ${error.message}`);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{siteName} Shorelines</h1>
          <p className="text-gray-600">{rectifiedImages.length} processed images</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleRunProcessing}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            title="Register and rectify raw images"
          >
            Process Images
          </button>
          <button
            onClick={handleRunShorelineDetection}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#4F46E5',
              color: 'white',
              borderRadius: '0.25rem',
              border: 'none',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4338CA'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4F46E5'}
            title="Auto-detect shorelines on rectified images"
          >
            Detect Shorelines
          </button>
          <button
            onClick={handleGenerateOverlays}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            title="Generate overlay images with shorelines"
          >
            Generate Overlays
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="border-b mb-6">
        <div className="flex gap-6">
          <button
            onClick={() => setViewMode('timeline')}
            style={{
              paddingBottom: '0.5rem',
              paddingLeft: '0.25rem',
              paddingRight: '0.25rem',
              borderBottom: viewMode === 'timeline' ? '2px solid #2563EB' : 'none',
              color: viewMode === 'timeline' ? '#2563EB' : '#4B5563',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: viewMode === 'timeline' ? '600' : '400'
            }}
            onMouseEnter={(e) => { if (viewMode !== 'timeline') e.currentTarget.style.color = '#1F2937' }}
            onMouseLeave={(e) => { if (viewMode !== 'timeline') e.currentTarget.style.color = '#4B5563' }}
          >
            Timeline View
          </button>
          <button
            onClick={() => setViewMode('overlays')}
            style={{
              paddingBottom: '0.5rem',
              paddingLeft: '0.25rem',
              paddingRight: '0.25rem',
              marginLeft: '1.5rem',
              borderBottom: viewMode === 'overlays' ? '2px solid #2563EB' : 'none',
              color: viewMode === 'overlays' ? '#2563EB' : '#4B5563',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: viewMode === 'overlays' ? '600' : '400'
            }}
            onMouseEnter={(e) => { if (viewMode !== 'overlays') e.currentTarget.style.color = '#1F2937' }}
            onMouseLeave={(e) => { if (viewMode !== 'overlays') e.currentTarget.style.color = '#4B5563' }}
          >
            Overlays
          </button>
          <button
            onClick={() => setViewMode('trends')}
            style={{
              paddingBottom: '0.5rem',
              paddingLeft: '0.25rem',
              paddingRight: '0.25rem',
              marginLeft: '1.5rem',
              borderBottom: viewMode === 'trends' ? '2px solid #2563EB' : 'none',
              color: viewMode === 'trends' ? '#2563EB' : '#4B5563',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontWeight: viewMode === 'trends' ? '600' : '400'
            }}
            onMouseEnter={(e) => { if (viewMode !== 'trends') e.currentTarget.style.color = '#1F2937' }}
            onMouseLeave={(e) => { if (viewMode !== 'trends') e.currentTarget.style.color = '#4B5563' }}
          >
            Trends
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {viewMode === 'timeline' && (
          <GridView
            images={rectifiedImages}
            onImageSelect={handleImageSelect}
            selectedIndex={selectedImageIndex}
          />
        )}
        {viewMode === 'overlays' && (
          <OverlaysView
            images={rectifiedImages}
          />
        )}
        {viewMode === 'trends' && (
          <div className="text-center py-12">
            <p className="text-gray-500">Trends analysis coming soon...</p>
          </div>
        )}
      </div>

      {/* Shoreline Editor Modal */}
      {showEditor && selectedImageIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                Edit Shoreline - Image {selectedImageIndex + 1}
              </h2>
              <button
                onClick={() => setShowEditor(false)}
                className="text-gray-600 hover:text-gray-800"
              >
                ✕
              </button>
            </div>
            <ShorelineEditor
              imageIndex={selectedImageIndex}
              onSave={async (updatedPoints) => {
                try {
                  await api.saveShorelineData(selectedImageIndex, updatedPoints);
                  // Don't close the editor after saving
                  // Status is now shown in the editor itself
                } catch (error: any) {
                  setErrorMessage(error.message || 'Failed to save shoreline');
                }
              }}
              onApprove={() => {
                // No need to trigger refresh anymore
                // The approval cache handles updates automatically
              }}
              onNext={() => {
                const nextIndex = selectedImageIndex + 1;
                if (nextIndex < rectifiedImages.length) {
                  setSelectedImageIndex(nextIndex);
                }
              }}
              onPrevious={() => {
                const prevIndex = selectedImageIndex - 1;
                if (prevIndex >= 0) {
                  setSelectedImageIndex(prevIndex);
                }
              }}
              canGoNext={selectedImageIndex < rectifiedImages.length - 1}
              canGoPrevious={selectedImageIndex > 0}
            />
          </div>
        </div>
      )}
    </div>
  );
}