import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_BASE_URL = 'http://localhost:5001/api';

// Colors for the pie chart (matching Excel style)
const COLORS = ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#9e480e', '#636363'];

function SalesByType({ availableMonths }) {
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
      const response = await axios.get(`${API_BASE_URL}/sales-by-type`, {
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
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    });
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    return '$' + value.toLocaleString('en-US', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    });
  };

  // Custom label for pie chart - inside the slice
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value, percent }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // Only show label if percent is >= 3%
    if (percent < 0.03) return null;

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor="middle" 
        dominantBaseline="central"
        style={{ fontSize: '12px', fontWeight: 600, textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}
      >
        {`${formatCurrency(value)}, ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Custom tooltip for pie chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      return (
        <div style={{
          background: 'white',
          padding: '10px 14px',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: 0, fontWeight: 600, color: item.payload.fill }}>
            {item.name}
          </p>
          <p style={{ margin: '4px 0 0 0', color: '#4a5568' }}>
            Amount: <strong>{formatCurrency(item.value)}</strong>
          </p>
          <p style={{ margin: '4px 0 0 0', color: '#718096' }}>
            Share: <strong>{(item.payload.percent * 100).toFixed(1)}%</strong>
          </p>
        </div>
      );
    }
    return null;
  };

  // Prepare chart data
  const getChartData = () => {
    if (!data) return [];
    const total = data.total;
    return data.data.map((item, index) => ({
      name: item.name,
      value: item.amount,
      percent: total > 0 ? item.amount / total : 0,
      fill: COLORS[index % COLORS.length]
    }));
  };

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2>Sales by Type of Sales</h2>
        <div className="card-filters">
          <div className="filter-group">
            <label htmlFor="type-year-select">Year:</label>
            <select 
              id="type-year-select"
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
            <label htmlFor="type-month-select">Month:</label>
            <select 
              id="type-month-select"
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
          <div className="sales-type-layout">
            {/* Table */}
            <div className="sales-type-table">
              <div style={{ marginBottom: '8px', color: '#718096', fontSize: '13px' }}>
                Month: <strong>{data.month}</strong>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th></th>
                    <th style={{ textAlign: 'right' }}>Sum of Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <span 
                          style={{ 
                            display: 'inline-block',
                            width: '12px',
                            height: '12px',
                            backgroundColor: COLORS[index % COLORS.length],
                            marginRight: '8px',
                            borderRadius: '2px'
                          }}
                        />
                        {item.name}
                      </td>
                      <td className="number">$ {formatNumber(item.amount)}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td><strong>Grand Total</strong></td>
                    <td className="number"><strong>$ {formatNumber(data.total)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Pie Chart */}
            <div className="sales-type-chart">
              <div className="chart-container">
                <h4 style={{ textAlign: 'center', margin: '0 0 8px 0', color: '#2d3748' }}>Total</h4>
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={getChartData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomLabel}
                      outerRadius={120}
                      dataKey="value"
                    >
                      {getChartData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      formatter={(value, entry) => (
                        <span style={{ color: '#4a5568', fontSize: '13px' }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SalesByType;
