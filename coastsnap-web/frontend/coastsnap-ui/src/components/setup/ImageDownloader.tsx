import { useState } from 'react';
import { useSiteStore } from '../../stores/useSiteStore';
import { useStatusStore } from '../../stores/useStatusStore';
import api from '../../services/api';

export function ImageDownloader() {
  const [numImages, setNumImages] = useState('10');
  const [downloading, setDownloading] = useState(false);
  const { selectedSite } = useSiteStore();
  const { setStatusMessage, setErrorMessage } = useStatusStore();

  const handleDownload = async () => {
    if (!selectedSite) {
      setErrorMessage('No site selected');
      return;
    }

    setDownloading(true);
    try {
      const num = Number(numImages) || -1;
      setStatusMessage(`Downloading ${num === -1 ? 'all' : num} images...`);
      
      // Call the actual API
      const response = await api.downloadImages(selectedSite, num);
      
      setStatusMessage(response.message);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to download images');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-gray-600">
        Download raw images from the CoastSnap database for {selectedSite || 'your site'}.
      </p>
      
      <div>
        <label htmlFor="numImages" className="block text-sm font-medium text-gray-700 mb-1">
          Number of images to download
        </label>
        <input
          id="numImages"
          type="number"
          value={numImages}
          onChange={(e) => setNumImages(e.target.value)}
          placeholder="-1 for all"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={downloading}
        />
        <p className="text-xs text-gray-500 mt-1">Enter -1 to download all available images</p>
      </div>
      
      <button 
        onClick={handleDownload} 
        disabled={downloading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {downloading ? 'Downloading...' : 'Start Download'}
      </button>
    </div>
  );
}