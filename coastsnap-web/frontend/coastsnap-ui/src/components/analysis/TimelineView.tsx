import { useState, useRef, useEffect } from 'react';
import api from '../../services/api';
import { approvalCache } from '../../services/approvalCache';
import { logger } from '../../utils/logger';

interface TimelineViewProps {
  images: string[];
  onImageSelect: (index: number) => void;
  selectedIndex: number | null;
}

export function TimelineView({ images, onImageSelect, selectedIndex }: TimelineViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [rawImages, setRawImages] = useState<string[]>([]);
  const [approvalStatus, setApprovalStatus] = useState<Record<number, boolean>>({});

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

  // Extract dates from raw image filenames
  const imageDates = images.map((_, index) => {
    if (rawImages[index]) {
      // Extract date from filename like "000037-2025-06-21-k6ndzo32q39gmq0rvqv1e6aw3kbwppid.jpg"
      const dateMatch = rawImages[index].match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        return new Date(dateMatch[0]);
      }
    }
    // Fallback to index-based date if no raw image found
    const date = new Date();
    date.setDate(date.getDate() - (images.length - index) * 7);
    return date;
  });

  useEffect(() => {
    // Scroll to selected image
    if (selectedIndex !== null && scrollRef.current) {
      const element = scrollRef.current.children[selectedIndex] as HTMLElement;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', inline: 'center' });
      }
    }
  }, [selectedIndex]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Timeline Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Image Timeline</h3>
        <div className="text-sm text-gray-600">
          {images.length} images • 
          {imageDates.length > 0 && ` ${formatDate(imageDates[0])} - ${formatDate(imageDates[imageDates.length - 1])}`}
        </div>
      </div>


      {/* Timeline Scroll Container */}
      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute top-32 left-0 right-0 h-1 bg-gray-300" />

        {/* Images */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 scroll-smooth"
          style={{ scrollbarWidth: 'thin' }}
        >
          {images.map((_, index) => (
            <div
              key={index}
              className="flex-shrink-0 relative"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Date Label */}
              <div className="text-center mb-2">
                <p className="text-xs text-gray-600">{formatDate(imageDates[index])}</p>
              </div>

              {/* Timeline Dot */}
              <div className="absolute top-[124px] left-1/2 transform -translate-x-1/2 z-10">
                <div
                  className={`w-4 h-4 rounded-full border-2 ${
                    selectedIndex === index
                      ? 'bg-blue-600 border-blue-600'
                      : 'bg-white border-gray-400'
                  }`}
                />
              </div>

              {/* Image Thumbnail */}
              <div
                onClick={() => onImageSelect(index)}
                className={`relative cursor-pointer transition-all ${
                  selectedIndex === index
                    ? 'ring-4 ring-blue-600 transform scale-105'
                    : hoveredIndex === index
                    ? 'ring-2 ring-gray-400'
                    : ''
                }`}
              >
                <div className="w-40 h-28 overflow-hidden rounded-lg">
                  <img
                    src={api.getRectifiedImageUrl(index)}
                    alt={`Image ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Approval Status Indicator */}
                <div className="absolute top-2 right-2">
                  {approvalStatus[index] ? (
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center" title="Approved">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                  ) : (
                    <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center" title="Needs Review">
                      <span className="text-white text-xs font-bold">!</span>
                    </div>
                  )}
                </div>
                
                {/* Hover Overlay */}
                {hoveredIndex === index && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                    <p className="text-white text-sm font-medium">View Details</p>
                  </div>
                )}
              </div>

              {/* Image Number */}
              <div className="text-center mt-2">
                <p className="text-sm font-medium">#{index + 1}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      {selectedIndex !== null && (
        <div className="bg-gray-50 rounded-lg p-4 mt-6">
          <h4 className="font-medium mb-2">Selected Image Details</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Date</p>
              <p className="font-medium">{formatDate(imageDates[selectedIndex])}</p>
            </div>
            <div>
              <p className="text-gray-600">Image #</p>
              <p className="font-medium">{selectedIndex + 1}</p>
            </div>
            <div>
              <p className="text-gray-600">Approval Status</p>
              <p className={`font-medium ${approvalStatus[selectedIndex] ? 'text-green-600' : 'text-yellow-600'}`}>
                {approvalStatus[selectedIndex] ? 'Approved' : 'Needs Review'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}