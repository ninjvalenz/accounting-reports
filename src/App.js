import React, { useState } from 'react';
import ExcelStyleDashboard from './components/ExcelStyleDashboard';
import ProductCategoryMaintenance from './components/ProductCategoryMaintenance';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const handleNavigateToMaintenance = () => {
    setCurrentPage('maintenance');
  };

  const handleNavigateToDashboard = () => {
    setCurrentPage('dashboard');
  };

  if (currentPage === 'maintenance') {
    return <ProductCategoryMaintenance onBack={handleNavigateToDashboard} />;
  }

  return <ExcelStyleDashboard onNavigateToMaintenance={handleNavigateToMaintenance} />;
}

export default App;
