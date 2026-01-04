import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

function SalesByLocationSalesman({ availableMonths }) {
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get unique years from available months
  const years = [...new Set(availableMonths.map(m => m.year))].sort((a, b) => b - a);
  
  // Get months for selected year
  const monthsForYear = availableMonths.filter(m => m.year === selectedYear);

  // Set default year and month when availableMonths changes
  useEffect(() => {
    if (availableMonths && availableMonths.length > 0 && !selectedYear) {
      setSelectedYear(availableMonths[0].year);
    }
  }, [availableMonths]);

  // Set default month when year changes or initially
  useEffect(() => {
    if (selectedYear && monthsForYear.length > 0) {
      const isCurrentMonthValid = monthsForYear.some(m => m.month === selectedMonth);
      if (!selectedMonth || !isCurrentMonthValid) {
        const july = monthsForYear.find(m => m.month === 'July');
        setSelectedMonth(july ? july.month : monthsForYear[0].month);
      }
    }
  }, [selectedYear, monthsForYear]);

  const fetchData = useCallback(async () => {
    if (!selectedYear || !selectedMonth) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_BASE_URL}/sales-by-location-salesman`, {
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
    const newYear = parseInt(e.target.value);
    setSelectedYear(newYear);
  };

  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2>Sales by Location by Salesman</h2>
        <div className="card-filters">
          <div className="filter-group">
            <label htmlFor="loc-year-select">Year:</label>
            <select 
              id="loc-year-select"
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
            <label htmlFor="loc-month-select">Month:</label>
            <select 
              id="loc-month-select"
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
              Year: <strong>{data.year}</strong> | Month: <strong>{data.month}</strong>
            </div>
            
            <div className="sales-location-grid">
              {/* Sales by Salesman */}
              <div className="sales-table-container">
                <h4>Sales by Sales Person</h4>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th style={{ textAlign: 'right' }}>Sum of Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_salesman.data.map((item, index) => (
                      <tr key={index}>
                        <td>{item.name}</td>
                        <td className="number">{formatNumber(item.amount)}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td><strong>Grand Total</strong></td>
                      <td className="number"><strong>{formatNumber(data.by_salesman.total)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Sales by Location */}
              <div className="sales-table-container">
                <h4>Sales by Location</h4>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Location</th>
                      <th style={{ textAlign: 'right' }}>Sum of Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_location.data.map((item, index) => (
                      <tr key={index}>
                        <td>{item.name}</td>
                        <td className="number">{formatNumber(item.amount)}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td><strong>Grand Total</strong></td>
                      <td className="number"><strong>{formatNumber(data.by_location.total)}</strong></td>
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

export default SalesByLocationSalesman;
