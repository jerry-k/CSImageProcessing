import { useState, useEffect } from 'react';
import api from '../../services/api';
import { logger } from '../../utils/logger';
import { approvalCache } from '../../services/approvalCache';

interface OverlaysViewProps {
  images: string[];
}

export function OverlaysView({ images }: OverlaysViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  // Only show registered view now
  const [rawImages, setRawImages] = useState<string[]>([]);
  const [approvalStatus, setApprovalStatus] = useState<Record<number, boolean>>({});
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'unapproved'>('all');
  const [filteredIndices, setFilteredIndices] = useState<number[]>([]);
  const [showOverlay, setShowOverlay] = useState(true);

  // Fetch raw image names to get dates
  useEffect(() => {
    const fetchRawImages = async () => {
      try {
        const data = await api.getRawImages();
        setRawImages(data);
      } catch (error) {
        logger.error('Failed to fetch raw images:', error);
      }
    };
    fetchRawImages();
  }, []);

  // Subscribe to approval cache updates
  useEffect(() => {
    const unsubscribe = approvalCache.subscribe((statuses) => {
      const statusObj: Record<number, boolean> = {};
      statuses.forEach((approved, index) => {
        statusObj[index] = approved;
      });
      setApprovalStatus(statusObj);
    });

    return unsubscribe;
  }, []);

  // Use cached approval statuses
  useEffect(() => {
    const cachedStatuses = approvalCache.getAllStatuses();
    const statusObj: Record<number, boolean> = {};
    cachedStatuses.forEach((approved, index) => {
      statusObj[index] = approved;
    });
    setApprovalStatus(statusObj);
  }, [images]);

  // Update filtered indices when filter changes
  useEffect(() => {
    const indices = images.map((_, index) => index).filter(index => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'approved') return approvalStatus[index] === true;
      if (filterStatus === 'unapproved') return approvalStatus[index] !== true;
      return true;
    });
    setFilteredIndices(indices);
    
    // Reset to first filtered image when filter changes
    if (indices.length > 0 && !indices.includes(currentIndex)) {
      setCurrentIndex(indices[0]);
    }
  }, [filterStatus, approvalStatus, images, currentIndex]);

  // Get real dates from raw image filenames
  const getImageDate = (index: number) => {
    if (rawImages[index]) {
      const dateMatch = rawImages[index].match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        return new Date(dateMatch[0]).toLocaleDateString();
      }
    }
    return `Image ${index + 1}`;
  };

  const getOverlayUrl = (index: number) => {
    return api.getRegisteredImageWithShorelineUrl(index);
  };

  const handlePrevious = () => {
    const currentFilteredIndex = filteredIndices.indexOf(currentIndex);
    if (currentFilteredIndex > 0) {
      setCurrentIndex(filteredIndices[currentFilteredIndex - 1]);
    }
  };

  const handleNext = () => {
    const currentFilteredIndex = filteredIndices.indexOf(currentIndex);
    if (currentFilteredIndex < filteredIndices.length - 1) {
      setCurrentIndex(filteredIndices[currentFilteredIndex + 1]);
    }
  };

  const handleSelectImage = (index: number) => {
    setCurrentIndex(index);
  };

  if (images.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No images processed yet. Use "Process Images" and "Detect Shorelines" first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Shoreline Overlays</h3>
          {/* Filter dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Filter:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Images</option>
              <option value="approved">Approved Only</option>
              <option value="unapproved">Needs Review</option>
            </select>
          </div>
        </div>

        {/* Navigation controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handlePrevious}
            disabled={filteredIndices.length === 0 || filteredIndices.indexOf(currentIndex) === 0}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: filteredIndices.length === 0 || filteredIndices.indexOf(currentIndex) === 0 ? '#ccc' : '#6B7280',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: filteredIndices.length === 0 || filteredIndices.indexOf(currentIndex) === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            ← Previous
          </button>

          <select
            value={currentIndex}
            onChange={(e) => handleSelectImage(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded"
          >
            {filteredIndices.map((index) => (
              <option key={index} value={index}>
                Image #{index + 1} - {getImageDate(index)} {approvalStatus[index] ? '✓' : ''}
              </option>
            ))}
          </select>

          <button
            onClick={handleNext}
            disabled={filteredIndices.length === 0 || filteredIndices.indexOf(currentIndex) === filteredIndices.length - 1}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: filteredIndices.length === 0 || filteredIndices.indexOf(currentIndex) === filteredIndices.length - 1 ? '#ccc' : '#6B7280',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: filteredIndices.length === 0 || filteredIndices.indexOf(currentIndex) === filteredIndices.length - 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Current image info */}
      <div className="text-center text-sm text-gray-600">
        {filteredIndices.length > 0 ? (
          <>
            Showing image {filteredIndices.indexOf(currentIndex) + 1} of {filteredIndices.length} filtered
            {filteredIndices.length < images.length && ` (${images.length} total)`}
            {approvalStatus[currentIndex] && <span className="ml-2 text-green-600 font-medium">✓ Approved</span>}
            {!approvalStatus[currentIndex] && <span className="ml-2 text-yellow-600 font-medium">Needs Review</span>}
          </>
        ) : (
          'No images match the selected filter'
        )}
      </div>

      {/* Main image display */}
      {filteredIndices.length > 0 ? (
        <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ minHeight: '600px' }}>
          {/* Overlay toggle button */}
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            zIndex: 10
          }}>
            <button
              onClick={() => setShowOverlay(!showOverlay)}
              style={{
                padding: '6px 12px',
                backgroundColor: showOverlay ? '#ffc107' : '#6c757d',
                color: showOverlay ? '#000' : '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span style={{ fontSize: '16px' }}>{showOverlay ? '👁️' : '👁️‍🗨️'}</span>
              {showOverlay ? 'Hide Shoreline' : 'Show Shoreline'}
            </button>
          </div>
          
          <img
            src={showOverlay ? getOverlayUrl(currentIndex) : api.getRegisteredImageUrl(currentIndex)}
            alt={showOverlay ? `Shoreline overlay ${currentIndex + 1}` : `Registered image ${currentIndex + 1}`}
            className="w-full h-full object-contain"
            onError={(e) => {
              if (showOverlay) {
                e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iI2Y1ZjVmNSIvPgogIDx0ZXh0IHg9IjUwJSIgeT0iNTAlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iIzk5OSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMjQiPk92ZXJsYXkgbm90IGdlbmVyYXRlZCwgcGxlYXNlIGNsaWNrIEdlbmVyYXRlIE92ZXJsYXlzPC90ZXh0Pgo8L3N2Zz4=';
              }
            }}
          />
        </div>
      ) : (
        <div className="bg-gray-100 rounded-lg p-12 text-center text-gray-500">
          No images match your filter criteria.
        </div>
      )}

    </div>
  );
}