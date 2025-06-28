import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';
import { approvalCache } from '../../services/approvalCache';
import { logger } from '../../utils/logger';

interface GridViewProps {
  images: string[];
  onImageSelect: (index: number) => void;
  selectedIndex: number | null;
}

export function GridView({ images, onImageSelect, selectedIndex }: GridViewProps) {
  const [rawImages, setRawImages] = useState<string[]>([]);
  const [approvalStatus, setApprovalStatus] = useState<Record<number, boolean>>({});
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'unapproved'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'status'>('date');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(false);
  const imagesPerPage = 20;

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

  // Fetch all approval statuses using batch endpoint
  const fetchAllApprovalStatuses = useCallback(async () => {
    if (images.length === 0 || approvalCache.isLoading()) return;
    
    setIsLoadingStatuses(true);
    approvalCache.setLoading(true);
    
    try {
      const data = await api.getAllShorelineStatuses();
      approvalCache.setAllStatuses(data.statuses);
    } catch (error) {
      logger.error('Failed to fetch approval statuses:', error);
      // Fallback: set all to false if batch endpoint fails
      const fallbackStatuses: Record<number, boolean> = {};
      images.forEach((_, i) => {
        fallbackStatuses[i] = false;
      });
      approvalCache.setAllStatuses(fallbackStatuses);
    } finally {
      setIsLoadingStatuses(false);
      approvalCache.setLoading(false);
    }
  }, [images]);

  // Initial load of approval statuses - ALWAYS fetch fresh data on mount
  useEffect(() => {
    // Clear cache and fetch fresh data when component mounts or images change
    if (images.length > 0) {
      approvalCache.clear();
      fetchAllApprovalStatuses();
    }
  }, [images, fetchAllApprovalStatuses]);


  // Extract date from filename
  const getImageDate = useCallback((index: number): Date | null => {
    if (rawImages[index]) {
      const dateMatch = rawImages[index].match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        return new Date(dateMatch[0]);
      }
    }
    return null;
  }, [rawImages]);

  // Filter and sort images with memoization
  const filteredAndSortedImages = useMemo(() => {
    return images
      .map((img, index) => ({
        image: img,
        index,
        date: getImageDate(index),
        approved: approvalStatus[index] || false
      }))
      .filter(item => {
        // Filter by approval status
        if (filterStatus === 'approved' && !item.approved) return false;
        if (filterStatus === 'unapproved' && item.approved) return false;

        // Filter by date range
        if (item.date && (dateRange.start || dateRange.end)) {
          const itemDate = item.date.getTime();
          if (dateRange.start && itemDate < new Date(dateRange.start).getTime()) return false;
          if (dateRange.end && itemDate > new Date(dateRange.end).getTime()) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date') {
          return (b.date?.getTime() || 0) - (a.date?.getTime() || 0);
        } else {
          // Sort by status (unapproved first)
          return a.approved === b.approved ? 0 : a.approved ? 1 : -1;
        }
      });
  }, [images, approvalStatus, filterStatus, sortBy, dateRange, getImageDate]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedImages.length / imagesPerPage);
  const startIndex = (currentPage - 1) * imagesPerPage;
  const paginatedImages = filteredAndSortedImages.slice(startIndex, startIndex + imagesPerPage);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, sortBy, dateRange]);

  // Lazy load approval statuses for visible images only
  useEffect(() => {
    const loadVisibleStatuses = async () => {
      if (paginatedImages.length === 0) return;

      // Get indices of visible images
      const visibleIndices = paginatedImages.map(item => item.index);
      const missingIndices: number[] = [];

      // Check which statuses we don't have in cache
      visibleIndices.forEach(index => {
        if (approvalCache.getStatus(index) === undefined) {
          missingIndices.push(index);
        }
      });

      // If we have missing statuses, fetch them individually
      if (missingIndices.length > 0) {
        const promises = missingIndices.map(async (index) => {
          try {
            const data = await api.getShorelineData(index);
            return { index, approved: data.approved || false };
          } catch (error) {
            return { index, approved: false };
          }
        });

        const results = await Promise.all(promises);
        results.forEach(({ index, approved }) => {
          approvalCache.updateStatus(index, approved);
        });
      }
    };

    loadVisibleStatuses();
  }, [paginatedImages]);

  const formatDate = (date: Date | null) => {
    if (!date) return 'Unknown';
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Filters and Controls */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Images</option>
              <option value="approved">Approved Only</option>
              <option value="unapproved">Needs Review</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">Date (Newest First)</option>
              <option value="status">Status (Needs Review First)</option>
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Start"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="End"
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>
            Showing {paginatedImages.length} of {filteredAndSortedImages.length} images
            {filteredAndSortedImages.length < images.length && ` (${images.length} total)`}
          </span>
          <span>
            {isLoadingStatuses ? (
              <span className="text-blue-600">Loading approval statuses...</span>
            ) : (
              <>
                {filteredAndSortedImages.filter(img => img.approved).length} approved, 
                {' '}{filteredAndSortedImages.filter(img => !img.approved).length} need review
              </>
            )}
          </span>
        </div>
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {paginatedImages.map((item) => (
          <div
            key={item.index}
            onClick={() => onImageSelect(item.index)}
            className={`relative cursor-pointer ${
              selectedIndex === item.index ? 'ring-4 ring-blue-600 rounded-lg' : ''
            }`}
          >
            {/* Image Thumbnail */}
            <div 
              className="aspect-video bg-gray-100 rounded-lg overflow-hidden"
              style={{
                transform: 'scale(1)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <img
                src={api.getRectifiedImageUrl(item.index)}
                alt={`Image ${item.index + 1}`}
                className="w-full h-full object-cover"
              />
              
              {/* Approval Status Badge */}
              <div className="absolute top-2 right-2">
                {item.approved ? (
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white" title="Approved">
                    <span className="text-white text-base font-bold">✓</span>
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white" title="Needs Review">
                    <span className="text-white text-base font-bold">✕</span>
                  </div>
                )}
              </div>

            </div>

            {/* Image Info */}
            <div className="mt-2 space-y-1">
              <p className="text-sm font-medium">#{item.index + 1}</p>
              <p className="text-xs text-gray-600">{formatDate(item.date)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className={`px-3 py-1 rounded ${
              currentPage === 1
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            Previous
          </button>

          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (currentPage <= 4) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = currentPage - 3 + i;
              }

              if (pageNum < 1 || pageNum > totalPages) return null;

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-1 rounded ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className={`px-3 py-1 rounded ${
              currentPage === totalPages
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
          >
            Next
          </button>
        </div>
      )}

      {/* No Results */}
      {filteredAndSortedImages.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No images match your filters.
        </div>
      )}
    </div>
  );
}