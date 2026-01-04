import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

function SalesCategoryWise({ availableMonths }) {
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get unique years from available months
  const years = [...new Set(availableMonths.map(m => m.year))].sort((a, b) => b - a);
  
  // Get unique months across all years
  const allMonths = [...new Set(availableMonths.map(m => m.month))];
  
  // Order months properly
  const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const sortedMonths = allMonths.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

  // Set default selections when availableMonths changes
  useEffect(() => {
    if (availableMonths && availableMonths.length > 0) {
      if (selectedYears.length === 0) {
        // Default to most recent year
        const mostRecentYear = Math.max(...years);
        setSelectedYears([mostRecentYear]);
      }
      if (selectedMonths.length === 0) {
        // Default to July if available, otherwise first month
        const defaultMonth = sortedMonths.includes('July') ? 'July' : sortedMonths[0];
        setSelectedMonths([defaultMonth]);
      }
    }
  }, [availableMonths, years, sortedMonths]);

  const fetchData = useCallback(async () => {
    if (selectedYears.length === 0 || selectedMonths.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_BASE_URL}/sales-category-wise`, {
        params: { 
          years: selectedYears.join(','),
          months: selectedMonths.join(',')
        }
      });
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [selectedYears, selectedMonths]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleYearChange = (year) => {
    setSelectedYears(prev => {
      if (prev.includes(year)) {
        // Don't allow deselecting if it's the last one
        if (prev.length === 1) return prev;
        return prev.filter(y => y !== year);
      } else {
        return [...prev, year].sort((a, b) => b - a);
      }
    });
  };

  const handleMonthChange = (month) => {
    setSelectedMonths(prev => {
      if (prev.includes(month)) {
        // Don't allow deselecting if it's the last one
        if (prev.length === 1) return prev;
        return prev.filter(m => m !== month);
      } else {
        return [...prev, month].sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
      }
    });
  };

  const selectAllYears = () => setSelectedYears([...years]);
  const selectAllMonths = () => setSelectedMonths([...sortedMonths]);

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const formatSelectionSummary = (items, type) => {
    if (items.length === 0) return `No ${type} selected`;
    if (items.length === 1) return items[0];
    if (items.length === 2) return items.join(', ');
    return `${items.length} ${type} selected`;
  };

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2>Sales Category Wise</h2>
      </div>

      <div className="card-body">
        {/* Multi-select filters */}
        <div className="multi-select-filters">
          <div className="multi-select-group">
            <div className="multi-select-label">
              <span>Years:</span>
              <button className="select-all-btn" onClick={selectAllYears}>Select All</button>
            </div>
            <div className="checkbox-group">
              {years.map((year) => (
                <label key={year} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedYears.includes(year)}
                    onChange={() => handleYearChange(year)}
                  />
                  {year}
                </label>
              ))}
            </div>
          </div>

          <div className="multi-select-group">
            <div className="multi-select-label">
              <span>Months:</span>
              <button className="select-all-btn" onClick={selectAllMonths}>Select All</button>
            </div>
            <div className="checkbox-group">
              {sortedMonths.map((month) => (
                <label key={month} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedMonths.includes(month)}
                    onChange={() => handleMonthChange(month)}
                  />
                  {month.substring(0, 3)}
                </label>
              ))}
            </div>
          </div>
        </div>

        {loading && (
          <div className="loading">Loading data</div>
        )}

        {error && (
          <div className="error-message">{error}</div>
        )}

        {!loading && !error && data && (
          <>
            <div style={{ marginBottom: '12px', color: '#718096', fontSize: '14px' }}>
              Years: <strong>{data.years.join(', ')}</strong> | 
              Months: <strong>{formatSelectionSummary(data.months, 'months')}</strong>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Qty (In Cases)</th>
                  <th style={{ textAlign: 'right' }}>Qty (In Liters)</th>
                  <th style={{ textAlign: 'right' }}>Amount (USD)</th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map((cat, index) => (
                  <tr key={index}>
                    <td>{cat.category}</td>
                    <td className="number">{formatNumber(cat.qty_cases)}</td>
                    <td className="number">{formatNumber(cat.qty_liters)}</td>
                    <td className="number">{formatNumber(cat.amount_usd)}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td><strong>Grand Total</strong></td>
                  <td className="number"><strong>{formatNumber(data.totals.qty_cases)}</strong></td>
                  <td className="number"><strong>{formatNumber(data.totals.qty_liters)}</strong></td>
                  <td className="number"><strong>{formatNumber(data.totals.amount_usd)}</strong></td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

export default SalesCategoryWise;
