import { useState } from 'react';
import { useStatusStore } from '../../stores/useStatusStore';
import api from '../../services/api';

export function AssetUploaderWrapper() {
  const [uploadingTransects, setUploadingTransects] = useState(false);
  const { setStatusMessage, setErrorMessage } = useStatusStore();

  const handleUploadTransects = async (file: File) => {
    try {
      setUploadingTransects(true);
      await api.uploadTransects(file);
      setStatusMessage('Transects file uploaded successfully');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to upload transects');
    } finally {
      setUploadingTransects(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-gray-600">
        Upload the transects file for shoreline analysis. This file defines the cross-shore transects 
        used for measuring beach width changes over time.
      </p>
      
      <div className="bg-gray-50 p-4 rounded-lg">
        <label htmlFor="tranUpload" className="block text-sm font-medium text-gray-700 mb-2">
          Transects File (.mat)
        </label>
        <p className="text-sm text-gray-600 mb-2">
          MATLAB file containing shoreline transect definitions for your site
        </p>
        <input
          id="tranUpload"
          type="file"
          accept=".mat"
          onChange={(e) => {
            if (e.target.files?.length) {
              handleUploadTransects(e.target.files[0]);
            }
          }}
          disabled={uploadingTransects}
          className="text-sm"
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          Note: The transects file is optional but recommended for shoreline change analysis. 
          You can skip this step if you don't have a transects file yet.
        </p>
      </div>
    </div>
  );
}