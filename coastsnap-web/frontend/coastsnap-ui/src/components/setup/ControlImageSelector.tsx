import { useState, useEffect } from 'react';
import { useSiteStore } from '../../stores/useSiteStore';
import { useStatusStore } from '../../stores/useStatusStore';
import api from '../../services/api';
import { LoadingSpinner } from '../common/LoadingSpinner';

export function ControlImageSelector() {
  const [selectedImage, setSelectedImage] = useState(0);
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { selectedSite } = useSiteStore();
  const { setStatusMessage, setErrorMessage } = useStatusStore();
  
  useEffect(() => {
    loadImages();
  }, [selectedSite]);

  const loadImages = async () => {
    if (!selectedSite) return;
    
    try {
      setLoading(true);
      const rawImages = await api.getRawImages();
      setImages(rawImages);
      if (rawImages.length === 0) {
        setErrorMessage('No images found. Please download images first.');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectImage = async () => {
    if (!images[selectedImage]) return;
    
    try {
      setLoading(true);
      const response = await api.selectControlImage(images[selectedImage]);
      setStatusMessage(response.message);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to select control image');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadCustom = async () => {
    if (!customFile) return;
    
    try {
      setUploading(true);
      const response = await api.uploadControlImage(customFile);
      setStatusMessage(response.message);
      setCustomFile(null);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to upload control image');
    } finally {
      setUploading(false);
    }
  };

  if (loading && images.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-medium mb-4">Option A: Choose from Downloaded Images</h4>
        {images.length > 0 ? (
          <div className="bg-gray-100 p-4 rounded-lg">
            <p className="text-center mb-4">Image {selectedImage + 1} of {images.length}</p>
            <p className="text-center text-sm text-gray-600 mb-4">{images[selectedImage]}</p>
            
            {/* Image preview */}
            <div className="mb-4">
              <img 
                src={api.getRawImageUrl(images[selectedImage])}
                alt={`Raw image ${selectedImage + 1}`}
                className="w-full object-contain border border-gray-300 rounded"
              />
            </div>
            
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setSelectedImage(Math.max(0, selectedImage - 1))}
                disabled={selectedImage === 0 || loading}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400"
              >
                ← Previous
              </button>
              <button
                onClick={handleSelectImage}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Selecting...' : 'Select This Image'}
              </button>
              <button
                onClick={() => setSelectedImage(Math.min(images.length - 1, selectedImage + 1))}
                disabled={selectedImage === images.length - 1 || loading}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400"
              >
                Next →
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">No images available. Please download images first.</p>
          </div>
        )}
      </div>

      <div className="border-t pt-6">
        <h4 className="font-medium mb-4">Option B: Upload Custom Control Image</h4>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setCustomFile(e.target.files?.[0] || null)}
          className="mb-4"
          disabled={uploading}
        />
        {customFile && (
          <div>
            <p className="text-sm text-gray-600 mb-2">Selected: {customFile.name}</p>
            <button
              onClick={handleUploadCustom}
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {uploading ? 'Uploading...' : 'Upload and Use This Image'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}