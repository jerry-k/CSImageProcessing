import { useState, useEffect } from 'react';
import { useStatusStore } from '../../stores/useStatusStore';
import { GCPSelector } from './GCPSelector';
import api from '../../services/api';
import { LoadingSpinner } from '../common/LoadingSpinner';
import type { GCP } from '../../types';

export function InteractiveGCPSelector() {
  const [gcps, setGCPs] = useState<GCP[]>([]);
  const [loading, setLoading] = useState(true);
  const [databaseFile, setDatabaseFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { setStatusMessage, setErrorMessage } = useStatusStore();

  useEffect(() => {
    loadGCPs();
  }, []);

  const loadGCPs = async () => {
    try {
      setLoading(true);
      // Try to get GCPs from database
      try {
        const gcpData = await api.getGCPs();
        setGCPs(gcpData);
      } catch (error) {
        // No database uploaded yet, which is expected
        setGCPs([]);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load GCPs');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDatabase = async () => {
    if (!databaseFile) return;
    
    try {
      setUploading(true);
      await api.uploadDatabase(databaseFile);
      setStatusMessage('Database uploaded successfully');
      
      // Reload GCPs after upload
      await loadGCPs();
      setDatabaseFile(null);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to upload database');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveGCPs = async (gcpsWithPixels: GCP[]) => {
    try {
      await api.saveGCPPixels(gcpsWithPixels);
      setStatusMessage('GCPs saved successfully');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to save GCPs');
    }
  };

  const handleReset = () => {
    // Reset the GCP pixels in the backend
    api.resetGCPPixels()
      .then(() => {
        setStatusMessage('GCP selections cleared');
      })
      .catch((error: any) => {
        setErrorMessage(error.message || 'Failed to reset GCPs');
      });
    
    // Return nothing - the GCPSelector component will handle resetting its own state
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  // If no GCPs, show database upload
  if (gcps.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-gray-600">
          Ground Control Points (GCPs) help with accurate image registration. 
          GCPs are loaded from the Excel database file.
        </p>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium mb-2">Database Required</h4>
          <p className="text-sm text-yellow-800 mb-4">
            Please upload the Excel database file (.xlsx) that contains the GCP information for your site.
          </p>
          
          <div>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setDatabaseFile(e.target.files?.[0] || null)}
              disabled={uploading}
              className="mb-2"
            />
            {databaseFile && (
              <div className="mt-2">
                <p className="text-sm text-gray-600 mb-2">Selected: {databaseFile.name}</p>
                <button
                  onClick={handleUploadDatabase}
                  disabled={uploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {uploading ? 'Uploading...' : 'Upload Database'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show the interactive GCP selector
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h4 className="font-medium mb-2">Instructions</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Scroll to zoom in/out</li>
          <li>• Click and drag to pan the image</li>
          <li>• Double-click to mark the current GCP location</li>
          <li>• Click "Skip" if a GCP is not visible</li>
        </ul>
      </div>

      <GCPSelector
        gcpList={gcps}
        onSaveGCPs={handleSaveGCPs}
        onReset={handleReset}
        apiBaseUrl={api.baseUrl}
      />
    </div>
  );
}