import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSiteStore } from '../stores/useSiteStore';
import { useStatusStore } from '../stores/useStatusStore';
import { SiteCard } from '../components/dashboard/SiteCard';
import { MetricsOverview } from '../components/dashboard/MetricsOverview';
import api from '../services/api';

interface SiteMetrics {
  site_name: string;
  last_processed?: string;
  image_count: number;
  pending_count: number;
  beach_width_trend?: 'increasing' | 'decreasing' | 'stable';
  last_width?: number;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { siteList, setSiteList, setSelectedSite, setSiteConfirmed } = useSiteStore();
  const { setStatusMessage, setErrorMessage } = useStatusStore();
  const [siteMetrics, setSiteMetrics] = useState<SiteMetrics[]>([]);

  useEffect(() => {
    // Reload sites when component mounts to catch any new sites
    loadSites();
  }, []);
  
  useEffect(() => {
    if (siteList && siteList.length >= 0) {
      loadDashboardData();
    }
  }, [siteList]);
  
  const loadSites = async () => {
    try {
      const sites = await api.listSites();
      setSiteList(sites);
    } catch (error) {
      // Error loading sites
    }
  };

  const loadDashboardData = async () => {
    try {
      // Get real metrics from API
      const metricsData = await api.getAllSiteMetrics();
      
      // Filter to only show completed sites
      const completedMetrics = metricsData.filter(site => site.setup_complete !== false);
      
      // Transform API data to match our SiteMetrics interface
      const metrics: SiteMetrics[] = completedMetrics.map(site => ({
        site_name: site.site_name,
        image_count: site.image_count || 0,
        pending_count: site.pending_count || 0,
        last_processed: site.last_processed ? new Date(site.last_processed * 1000).toISOString() : undefined,
        // These fields would need to be calculated from shoreline data in a real implementation
        beach_width_trend: 'stable' as const,
        last_width: undefined
      }));
      
      setSiteMetrics(metrics);
    } catch (error) {
      // Dashboard error
      setErrorMessage('Failed to load dashboard data');
    }
  };

  const handleSiteClick = (siteName: string) => {
    setSelectedSite(siteName);
    setSiteConfirmed(true);
    navigate(`/site/${siteName}/analysis`);
  };

  const handleNewSite = () => {
    navigate('/setup');
  };


  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">CoastSnap Dashboard</h1>
      </div>

      {/* Metrics Overview */}
      <MetricsOverview sites={siteMetrics} />

      {/* Sites Grid */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Sites</h2>
        {siteMetrics.length === 0 && !siteList.some(site => site && site.setup_complete === false) ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500 mb-4">No sites configured yet.</p>
            <button
              onClick={handleNewSite}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Create Your First Site
            </button>
          </div>
        ) : (
          <div>
            {/* Show completed sites if any */}
            {siteMetrics.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {siteMetrics.map((site) => (
                  <SiteCard
                    key={site.site_name}
                    site={site}
                    onClick={() => handleSiteClick(site.site_name)}
                  />
                ))}
              </div>
            )}
            
            {/* Show incomplete sites */}
            {siteList.some(site => site && site.setup_complete === false) && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Incomplete Site Setups</h3>
                <div className="space-y-3">
                  {siteList.filter(site => site && site.setup_complete === false).map(site => (
                    <div key={site.site_name} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <span className="font-medium capitalize">{site.site_name}</span>
                      <div>
                        <button
                          onClick={() => {
                            setSelectedSite(site.site_name);
                            setSiteConfirmed(true);
                            navigate('/setup');
                          }}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                        >
                          Resume Setup
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm(`Delete incomplete site "${site.site_name}"?`)) {
                              try {
                                await api.deleteSite(site.site_name);
                                const sites = await api.listSites();
                                setSiteList(sites);
                                setStatusMessage(`Deleted incomplete site "${site.site_name}"`);
                              } catch (error) {
                                setErrorMessage((error instanceof Error ? error.message : '') || `Failed to delete site "${site.site_name}"`);
                              }
                            }
                          }}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}