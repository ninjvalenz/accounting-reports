import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

function MoMGrowth({ availableMonths }) {
  const [selectedYear, setSelectedYear] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get unique years from available months
  const years = [...new Set(availableMonths.map(m => m.year))].sort((a, b) => b - a);

  // Set default year when availableMonths changes
  useEffect(() => {
    if (availableMonths && availableMonths.length > 0 && !selectedYear) {
      // Default to most recent year
      const mostRecentYear = Math.max(...years);
      setSelectedYear(mostRecentYear);
    }
  }, [availableMonths, years]);

  const fetchData = useCallback(async () => {
    if (!selectedYear) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_BASE_URL}/mom-growth`, {
        params: { year: selectedYear }
      });
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleYearChange = (e) => {
    setSelectedYear(parseInt(e.target.value));
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined || value === 0) return '-';
    return value.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const formatGrowth = (value) => {
    if (value === null || value === undefined) return '-';
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${value.toFixed(2)}%`;
  };

  const getGrowthClass = (value) => {
    if (value === null || value === undefined) return 'neutral';
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return 'neutral';
  };

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2>MoM Growth</h2>
        <div className="card-filters">
          <div className="filter-group">
            <label htmlFor="mom-year-select">Year:</label>
            <select 
              id="mom-year-select"
              value={selectedYear || ''} 
              onChange={handleYearChange}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card-body">
        {loading && (
          <div className="loading">Loading data</div>
        )}

        {error && (
          <div className="error-message">{error}</div>
        )}

        {!loading && !error && data && (
          <>
            <div style={{ marginBottom: '12px', color: '#718096', fontSize: '14px' }}>
              Year: <strong>{data.year}</strong>
            </div>
            
            <div className="mom-table-container">
              <table className="data-table mom-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th colSpan={data.categories.length} style={{ textAlign: 'center', background: '#e2e8f0' }}>
                      Quantity by Category
                    </th>
                    <th style={{ textAlign: 'right' }}>Total Qty</th>
                    <th style={{ textAlign: 'right' }}>Sales in $</th>
                    <th style={{ textAlign: 'right' }}>MoM Growth %</th>
                  </tr>
                  <tr>
                    <th></th>
                    {data.categories.map((cat, idx) => (
                      <th key={idx} style={{ textAlign: 'right', fontSize: '11px', fontWeight: 500 }}>
                        {cat}
                      </th>
                    ))}
                    <th></th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.months.map((month, index) => (
                    <tr key={index}>
                      <td><strong>{month.month_short}</strong></td>
                      {data.categories.map((cat, idx) => (
                        <td key={idx} className="number" style={{ fontSize: '12px' }}>
                          {formatNumber(month.qty_by_category[cat])}
                        </td>
                      ))}
                      <td className="number"><strong>{formatNumber(month.total_qty)}</strong></td>
                      <td className="number">{formatNumber(month.sales_amount)}</td>
                      <td className={`number ${getGrowthClass(month.mom_growth_pct)}`}>
                        {formatGrowth(month.mom_growth_pct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default MoMGrowth;
