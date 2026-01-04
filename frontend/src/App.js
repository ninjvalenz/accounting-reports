import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import FileUpload from './components/FileUpload';
import ComparisonSales from './components/ComparisonSales';
import ComparisonProduction from './components/ComparisonProduction';
import UploadHistory from './components/UploadHistory';

const API_BASE_URL = 'http://localhost:5001/api';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0); // Used to trigger refresh

  // Function to load available months/years from API
  const loadDashboardData = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/months`);
      const months = response.data.months || [];
      
      if (months.length > 0) {
        setAvailableMonths(months);
        const years = [...new Set(months.map(m => m.year))];
        setAvailableYears(years);
        setIsDataLoaded(true);
        setError(null);
      } else {
        setIsDataLoaded(false);
        setAvailableMonths([]);
        setAvailableYears([]);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setIsDataLoaded(false);
    }
  }, []);

  // Load data on initial mount
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Refresh dashboard data
  const refreshDashboard = useCallback(() => {
    loadDashboardData();
    setRefreshKey(prev => prev + 1); // Trigger child component refresh
  }, [loadDashboardData]);

  const handleUploadSuccess = useCallback((data) => {
    setAvailableMonths(data.months || []);
    setAvailableYears(data.years || []);
    setIsDataLoaded(true);
    setError(null);
    setRefreshKey(prev => prev + 1); // Trigger refresh
  }, []);

  const handleUploadError = useCallback((errorMessage) => {
    setError(errorMessage);
  }, []);

  const handleHistoryChange = useCallback(() => {
    // Called when something changes in history (e.g., delete)
    refreshDashboard();
  }, [refreshDashboard]);

  const goToHistory = () => setCurrentPage('history');
  const goToDashboard = () => setCurrentPage('dashboard');

  return (
    <div className="app">
      <header className="app-header">
        <h1>Sales Performance Dashboard 2025</h1>
        <nav className="app-nav">
          <button 
            className={`nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={goToDashboard}
          >
            📊 Dashboard
          </button>
          <button 
            className={`nav-btn ${currentPage === 'history' ? 'active' : ''}`}
            onClick={goToHistory}
          >
            📁 Upload History
          </button>
        </nav>
      </header>

      <main className="app-main">
        {currentPage === 'dashboard' && (
          <>
            <FileUpload 
              onUploadSuccess={handleUploadSuccess}
              onUploadError={handleUploadError}
            />

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {isDataLoaded && (
              <div className="dashboard-grid">
                <ComparisonSales 
                  key={`sales-${refreshKey}`}
                  availableMonths={availableMonths} 
                />
                <ComparisonProduction 
                  key={`production-${refreshKey}`}
                  availableMonths={availableMonths} 
                />
              </div>
            )}

            {!isDataLoaded && !error && (
              <div className="placeholder">
                <p>Upload an Excel file to view the dashboard</p>
              </div>
            )}
          </>
        )}

        {currentPage === 'history' && (
          <UploadHistory 
            onBack={goToDashboard} 
            onDataChange={handleHistoryChange}
          />
        )}
      </main>
    </div>
  );
}

export default App;
