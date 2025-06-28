import { useState } from 'react';
import { useStatusStore } from '../../stores/useStatusStore';
import { useSiteStore } from '../../stores/useSiteStore';
import api from '../../services/api';

interface SiteCardProps {
  site: {
    site_name: string;
    last_processed?: string;
    image_count: number;
    pending_count: number;
    beach_width_trend?: 'increasing' | 'decreasing' | 'stable';
    last_width?: number;
  };
  onClick: () => void;
}

export function SiteCard({ site, onClick }: SiteCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { setStatusMessage, setErrorMessage } = useStatusStore();
  const { setSiteList } = useSiteStore();
  if (!site) {
    return null;
  }
  const getTrendIcon = () => {
    switch (site.beach_width_trend) {
      case 'increasing': return '📈';
      case 'decreasing': return '📉';
      case 'stable': return '➡️';
      default: return '❓';
    }
  };

  const getTrendColor = () => {
    switch (site.beach_width_trend) {
      case 'increasing': return 'text-green-600';
      case 'decreasing': return 'text-red-600';
      case 'stable': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 168) return `${Math.floor(diffHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteSite(site.site_name);
      setStatusMessage(`Successfully deleted site "${site.site_name}"`);
      
      // Refresh site list
      const sites = await api.listSites();
      setSiteList(sites);
    } catch (error: any) {
      setErrorMessage(error.message || `Failed to delete site "${site.site_name}"`);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent card click when clicking on buttons
    if ((e.target as HTMLElement).tagName === 'BUTTON') {
      e.stopPropagation();
      return;
    }
    onClick();
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
      >
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold capitalize">{site.site_name}</h3>
          {site.pending_count > 0 && (
            <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">
              {site.pending_count} pending
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Images:</span>
            <span className="font-medium">{site.image_count}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-600">Last processed:</span>
            <span className="text-sm">{formatDate(site.last_processed)}</span>
          </div>

          {site.last_width && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Beach width:</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{site.last_width.toFixed(1)}m</span>
                <span className={`text-lg ${getTrendColor()}`}>
                  {getTrendIcon()}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t flex justify-between">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View Shorelines →
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(true);
            }}
            className="text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Delete Site
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-bold mb-4">Delete Site</h2>
            <p className="mb-6">
              Are you sure you want to delete "{site.site_name}"? This will permanently remove:
            </p>
            <ul className="list-disc list-inside mb-6 text-sm text-gray-600">
              <li>All images (raw, registered, and rectified)</li>
              <li>All shoreline mappings</li>
              <li>Site configuration and settings</li>
              <li>Processing history and analytics</li>
            </ul>
            <p className="mb-6 font-semibold text-red-600">
              This action cannot be undone!
            </p>
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Site'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}