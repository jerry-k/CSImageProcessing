import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Import services
import api from './services/api';

// Import stores
import { useSiteStore, useStatusStore } from './stores';

// Import pages
import { Dashboard } from './pages/Dashboard';
import { SiteSetup } from './pages/SiteSetup';
import { SiteAnalysis } from './pages/SiteAnalysis';

// Import components
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { NavBar } from './components/common/NavBar';

function App() {
  const { 
    statusMessage, errorMessage, initialLoading,
    setStatusMessage, setErrorMessage, setInitialLoading 
  } = useStatusStore();
  
  const { setSiteList } = useSiteStore();

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    try {
      const response = await api.listSites();
      setSiteList(response);
    } catch (error) {
      setErrorMessage('Failed to load sites: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setInitialLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        {/* Navigation Bar */}
        <NavBar />

        {/* Status Messages */}
        <div className="fixed top-20 right-4 z-50 space-y-2">
          {statusMessage && (
            <div className="bg-blue-600 border border-blue-700 text-white pl-4 pr-12 py-3 rounded relative shadow-lg">
              <span>{statusMessage}</span>
              <button
                className="absolute top-2 right-2 text-white hover:text-gray-200"
                onClick={() => setStatusMessage('')}
                style={{ background: 'none', border: 'none', padding: 0, fontSize: '1.5rem', lineHeight: 1, cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-600 border border-red-700 text-white pl-4 pr-12 py-3 rounded relative shadow-lg">
              <span>{errorMessage}</span>
              <button
                className="absolute top-2 right-2 text-white hover:text-gray-200"
                onClick={() => setErrorMessage('')}
                style={{ background: 'none', border: 'none', padding: 0, fontSize: '1.5rem', lineHeight: 1, cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
          )}
        </div>

        {/* Main Content */}
        <main className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/setup" element={<SiteSetup />} />
            <Route path="/site/:siteName/analysis" element={<SiteAnalysis />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;