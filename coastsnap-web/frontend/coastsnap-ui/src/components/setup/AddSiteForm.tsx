import { useState } from 'react';
import { useSiteStore } from '../../stores/useSiteStore';
import { useStatusStore } from '../../stores/useStatusStore';
import api from '../../services/api';

interface AddSiteFormProps {
  onSuccess: () => void;
}

export function AddSiteForm({ onSuccess }: AddSiteFormProps) {
  const [siteName, setSiteName] = useState('');
  const [rootId, setRootId] = useState('');
  const [loading, setLoading] = useState(false);
  const { siteList, setSiteList, setSelectedSite, setSiteConfirmed } = useSiteStore();
  const { setStatusMessage, setErrorMessage } = useStatusStore();

  // Check for existing site name
  const checkExistingSiteName = (name: string) => {
    const formattedName = name.trim().toLowerCase();
    return siteList.some((site: any) => site.site_name === formattedName);
  };

  // Check for existing root ID
  const checkExistingRootId = (id: string) => {
    const numId = Number(id);
    if (!numId) return false;
    return siteList.find((site: any) => site.root_id === numId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!siteName || !rootId) {
      setErrorMessage('Please fill in all fields');
      return;
    }

    const formattedName = siteName.trim().toLowerCase();
    
    // Check if site already exists
    if (checkExistingSiteName(siteName)) {
      setErrorMessage(`A site with name "${formattedName}" already exists`);
      return;
    }
    
    const existingRootIdSite = checkExistingRootId(rootId);
    if (existingRootIdSite) {
      setErrorMessage(`A site with root ID ${rootId} already exists (${existingRootIdSite.site_name})`);
      return;
    }

    setLoading(true);
    try {
      await api.addSite(formattedName, Number(rootId));
      
      // Refresh site list
      const updatedSites = await api.listSites();
      setSiteList(updatedSites);
      
      // Select the new site
      setSelectedSite(formattedName);
      setSiteConfirmed(true);
      
      setStatusMessage(`Site "${formattedName}" created successfully!`);
      
      // Mark that this is a new site to prevent "resuming" message
      sessionStorage.setItem('isNewSite', 'true');
      
      onSuccess();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to create site');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="siteName" className="block text-sm font-medium text-gray-700 mb-1">
          Site Name
        </label>
        <input
          id="siteName"
          type="text"
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          placeholder="e.g., bondi"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        {siteName && checkExistingSiteName(siteName) && (
          <p className="text-xs text-red-600 mt-1">This site name already exists</p>
        )}
      </div>
      
      <div>
        <label htmlFor="rootId" className="block text-sm font-medium text-gray-700 mb-1">
          Root ID
        </label>
        <input
          id="rootId"
          type="number"
          value={rootId}
          onChange={(e) => setRootId(e.target.value)}
          placeholder="e.g., 3342"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        {(() => {
          const existingSite = rootId ? checkExistingRootId(rootId) : false;
          return existingSite ? (
            <p className="text-xs text-red-600 mt-1">
              This root ID is already used by site: {existingSite.site_name}
            </p>
          ) : null;
        })()}
      </div>
      
      <button
        type="submit"
        disabled={loading || !!(siteName && checkExistingSiteName(siteName)) || !!(rootId && checkExistingRootId(rootId))}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? 'Creating...' : 'Add Site'}
      </button>
    </form>
  );
}