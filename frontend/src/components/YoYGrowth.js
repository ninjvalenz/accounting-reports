import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

function YoYGrowth({ availableMonths }) {
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get unique months across all years
  const allMonths = [...new Set(availableMonths.map(m => m.month))];
  
  // Order months properly
  const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const sortedMonths = allMonths.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

  // Set default selections when availableMonths changes
  useEffect(() => {
    if (availableMonths && availableMonths.length > 0 && selectedMonths.length === 0) {
      // Default to July if available, otherwise first month
      const defaultMonth = sortedMonths.includes('July') ? 'July' : sortedMonths[0];
      setSelectedMonths([defaultMonth]);
    }
  }, [availableMonths, sortedMonths]);

  const fetchData = useCallback(async () => {
    if (selectedMonths.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_BASE_URL}/yoy-growth`, {
        params: { 
          months: selectedMonths.join(',')
        }
      });
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [selectedMonths]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const selectAllMonths = () => setSelectedMonths([...sortedMonths]);

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

  const formatSelectionSummary = (items, type) => {
    if (items.length === 0) return `No ${type} selected`;
    if (items.length === 1) return items[0];
    if (items.length === 2) return items.join(', ');
    return `${items.length} ${type} selected`;
  };

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2>YoY Growth</h2>
      </div>

      <div className="card-body">
        {/* Multi-select filters - only months since we're comparing years */}
        <div className="multi-select-filters">
          <div className="multi-select-group">
            <div className="multi-select-label">
              <span>Months (to compare across years):</span>
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
              Comparing Years: <strong>{data.years.join(' vs ')}</strong> | 
              Months: <strong>{formatSelectionSummary(data.months, 'months')}</strong>
            </div>
            
            <div className="yoy-tables">
              {/* Qty Table */}
              <div className="yoy-table-container">
                <h4>Sum of Qty-Actual</h4>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product Category</th>
                      {data.years.map(year => (
                        <th key={year} style={{ textAlign: 'right' }}>{year}</th>
                      ))}
                      {/* {data.years.length >= 2 && (
                        <th style={{ textAlign: 'right' }}>Growth %</th>
                      )} */}
                    </tr>
                  </thead>
                  <tbody>
                    {data.categories.map((cat, index) => (
                      <tr key={index}>
                        <td>{cat.category}</td>
                        {data.years.map(year => (
                          <td key={year} className="number">
                            {formatNumber(cat.qty_by_year[year])}
                          </td>
                        ))}
                        {/* {data.years.length >= 2 && (
                          <td className={`number ${getGrowthClass(cat.qty_growth_pct)}`}>
                            {formatGrowth(cat.qty_growth_pct)}
                          </td>
                        )} */}
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td><strong>Grand Total</strong></td>
                      {data.years.map(year => (
                        <td key={year} className="number">
                          <strong>{formatNumber(data.totals.qty_by_year[year])}</strong>
                        </td>
                      ))}
                      {/* {data.years.length >= 2 && (
                        <td className={`number ${getGrowthClass(data.totals.qty_growth_pct)}`}>
                          <strong>{formatGrowth(data.totals.qty_growth_pct)}</strong>
                        </td>
                      )} */}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Amount Table */}
              <div className="yoy-table-container">
                <h4>Sum of Amount (US$)</h4>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product Category</th>
                      {data.years.map(year => (
                        <th key={year} style={{ textAlign: 'right' }}>{year}</th>
                      ))}
                      {/* {data.years.length >= 2 && (
                        <th style={{ textAlign: 'right' }}>Growth %</th>
                      )} */}
                    </tr>
                  </thead>
                  <tbody>
                    {data.categories.map((cat, index) => (
                      <tr key={index}>
                        <td>{cat.category}</td>
                        {data.years.map(year => (
                          <td key={year} className="number">
                            {formatNumber(cat.amount_by_year[year])}
                          </td>
                        ))}
                        {/* {data.years.length >= 2 && (
                          <td className={`number ${getGrowthClass(cat.amount_growth_pct)}`}>
                            {formatGrowth(cat.amount_growth_pct)}
                          </td>
                        )} */}
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td><strong>Grand Total</strong></td>
                      {data.years.map(year => (
                        <td key={year} className="number">
                          <strong>{formatNumber(data.totals.amount_by_year[year])}</strong>
                        </td>
                      ))}
                      {/* {data.years.length >= 2 && (
                        <td className={`number ${getGrowthClass(data.totals.amount_growth_pct)}`}>
                          <strong>{formatGrowth(data.totals.amount_growth_pct)}</strong>
                        </td>
                      )} */}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default YoYGrowth;
