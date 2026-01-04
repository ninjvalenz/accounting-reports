import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

function ComparisonSales({ availableMonths }) {
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get unique years from available months
  const years = [...new Set(availableMonths.map(m => m.year))];
  
  // Get months for selected year
  const monthsForYear = availableMonths.filter(m => m.year === selectedYear);

  // Set default year and month when availableMonths changes
  useEffect(() => {
    if (availableMonths && availableMonths.length > 0) {
      // Default to first year (most recent)
      if (!selectedYear) {
        setSelectedYear(availableMonths[0].year);
      }
    }
  }, [availableMonths, selectedYear]);

  // Set default month when year changes
  useEffect(() => {
    if (selectedYear && monthsForYear.length > 0) {
      // Default to July if available, otherwise first month
      const july = monthsForYear.find(m => m.month === 'July');
      setSelectedMonth(july ? july.month : monthsForYear[0].month);
    }
  }, [selectedYear, monthsForYear]);

  const fetchData = useCallback(async () => {
    if (!selectedYear || !selectedMonth) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_BASE_URL}/comparison-sales`, {
        params: { 
          year: selectedYear,
          month: selectedMonth 
        }
      });
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleYearChange = (e) => {
    setSelectedYear(parseInt(e.target.value));
    setSelectedMonth(null); // Reset month when year changes
  };

  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
  };

  const formatNumber = (value, isPercentage = false) => {
    if (value === null || value === undefined) return '-';
    if (isPercentage) return `${value.toFixed(2)}%`;
    return value.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const getVarianceClass = (value) => {
    if (value === null || value === undefined) return 'neutral';
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return 'neutral';
  };

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2>Comparison - Sales (Budget vs Actual)</h2>
        <div className="card-filters">
          <div className="filter-group">
            <label htmlFor="year-select">Year:</label>
            <select 
              id="year-select"
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
          <div className="filter-group">
            <label htmlFor="month-select">Month:</label>
            <select 
              id="month-select"
              value={selectedMonth || ''} 
              onChange={handleMonthChange}
            >
              {monthsForYear.map((m) => (
                <option key={m.month} value={m.month}>
                  {m.month}
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
              Year: <strong>{data.year}</strong> | Month: <strong>{data.month}</strong> | Days in Month: <strong>{data.days_in_month}</strong>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th style={{ textAlign: 'right' }}>Budget</th>
                  <th style={{ textAlign: 'right' }}>Actual</th>
                  <th style={{ textAlign: 'right' }}>Variance</th>
                </tr>
              </thead>
              <tbody>
                {data.metrics.map((metric, index) => (
                  <tr key={index}>
                    <td className="metric-name">{metric.name}</td>
                    <td className="number">
                      {metric.name.includes('%') 
                        ? formatNumber(metric.budget, true)
                        : formatNumber(metric.budget)}
                    </td>
                    <td className="number">
                      {metric.name.includes('%') 
                        ? formatNumber(metric.actual, true)
                        : formatNumber(metric.actual)}
                    </td>
                    <td className={`number ${getVarianceClass(metric.variance)}`}>
                      {metric.name.includes('%') 
                        ? formatNumber(metric.variance, true)
                        : formatNumber(metric.variance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

export default ComparisonSales;
