import { useNavigate } from 'react-router-dom';
import { useSiteStore } from '../../stores/useSiteStore';

interface MetricsOverviewProps {
  sites: Array<{
    site_name: string;
    image_count: number;
    pending_count: number;
  }>;
}

export function MetricsOverview({ sites }: MetricsOverviewProps) {
  const navigate = useNavigate();
  const { setSelectedSite, setSiteConfirmed } = useSiteStore();
  
  if (!sites || !Array.isArray(sites)) {
    sites = [];
  }
  
  const totalImages = sites.reduce((sum, site) => sum + (site?.image_count || 0), 0);
  const totalPending = sites.reduce((sum, site) => sum + (site?.pending_count || 0), 0);

  const metrics = [
    {
      label: 'Total Sites',
      value: sites.length,
      icon: '🏖️',
      color: 'bg-blue-100 text-blue-800'
    },
    {
      label: 'Total Images',
      value: totalImages,
      icon: '📸',
      color: 'bg-purple-100 text-purple-800'
    },
    {
      label: 'Pending Approval',
      value: totalPending,
      icon: '⏳',
      color: 'bg-orange-100 text-orange-800'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex gap-4 justify-end">
        <button
          onClick={() => {
            // Clear any existing site selection to ensure we start fresh
            setSelectedSite('');
            setSiteConfirmed(false);
            navigate('/setup');
          }}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          + New Site
        </button>
      </div>

      {/* Metrics cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-2xl p-2 rounded ${metric.color}`}>
                {metric.icon}
              </span>
              <span className="text-3xl font-bold">{metric.value}</span>
            </div>
            <p className="text-gray-600 text-sm">{metric.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}