import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

function CostAnalysis({ availableMonths, refreshKey }) {
  const [selectedYear, setSelectedYear] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // Get unique years from available months
  const years = [...new Set(availableMonths.map(m => m.year))].sort((a, b) => b - a);

  // Set default year when availableMonths changes
  useEffect(() => {
    if (availableMonths && availableMonths.length > 0 && !selectedYear) {
      setSelectedYear(availableMonths[0].year);
    }
  }, [availableMonths, selectedYear]);

  const fetchData = useCallback(async () => {
    if (!selectedYear) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${API_BASE_URL}/cost-analysis`, {
        params: { year: selectedYear }
      });
      setData(response.data);
      // Initialize edited data with current values
      const initialEdited = {};
      response.data.data.forEach(row => {
        initialEdited[row.month] = {
          fuel: row.fuel,
          lec: row.lec
        };
      });
      setEditedData(initialEdited);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  const handleYearChange = (e) => {
    setSelectedYear(parseInt(e.target.value));
    setEditMode(false);
    setSaveMessage(null);
  };

  const handleInputChange = (month, field, value) => {
    // Allow empty string or valid number
    const numValue = value === '' ? '' : parseFloat(value);
    setEditedData(prev => ({
      ...prev,
      [month]: {
        ...prev[month],
        [field]: numValue
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      // Find changed rows and save them
      const savePromises = [];
      
      data.data.forEach(row => {
        const edited = editedData[row.month];
        if (edited) {
          const fuelChanged = edited.fuel !== row.fuel;
          const lecChanged = edited.lec !== row.lec;
          
          if (fuelChanged || lecChanged) {
            savePromises.push(
              axios.put(`${API_BASE_URL}/cost-analysis`, {
                year: selectedYear,
                month: row.month,
                fuel: edited.fuel === '' ? 0 : edited.fuel,
                lec: edited.lec === '' ? 0 : edited.lec
              })
            );
          }
        }
      });

      if (savePromises.length === 0) {
        setSaveMessage({ type: 'info', text: 'No changes to save' });
        setSaving(false);
        return;
      }

      await Promise.all(savePromises);
      setSaveMessage({ type: 'success', text: `Saved ${savePromises.length} change(s) successfully` });
      
      // Refresh data
      await fetchData();
      setEditMode(false);
    } catch (err) {
      setSaveMessage({ 
        type: 'error', 
        text: err.response?.data?.error || 'Failed to save changes' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset edited data to original values
    if (data) {
      const resetEdited = {};
      data.data.forEach(row => {
        resetEdited[row.month] = {
          fuel: row.fuel,
          lec: row.lec
        };
      });
      setEditedData(resetEdited);
    }
    setEditMode(false);
    setSaveMessage(null);
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  // Calculate totals for a row with edited values
  const getCalculatedValues = (row) => {
    const edited = editedData[row.month] || {};
    const fuel = edited.fuel === '' ? 0 : (edited.fuel ?? row.fuel);
    const lec = edited.lec === '' ? 0 : (edited.lec ?? row.lec);
    const total = fuel + lec;
    
    // We need the original row's sales data for calculations
    const totalQty = row.total_qty || 0;
    const totalAmount = row.sales_amount || 0;
    
    // Use original calculations if we don't have the underlying data
    // The API returns pre-calculated values based on sales_data
    const cost_per_ctn = total / (row.total_qty_raw || (row.cost_per_ctn > 0 ? total / row.cost_per_ctn : 1));
    const pct_of_revenue = row.pct_of_revenue > 0 
      ? (total / (row.total * 100 / row.pct_of_revenue)) * 100 
      : 0;
    
    return {
      fuel,
      lec,
      total,
      // For display, just recalculate proportionally if values changed
      cost_per_ctn: row.cost_per_ctn > 0 ? (total / row.total) * row.cost_per_ctn : 0,
      pct_of_revenue: row.pct_of_revenue > 0 ? (total / row.total) * row.pct_of_revenue : 0
    };
  };

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2>Cost Analysis (Fuel & LEC)</h2>
        <div className="card-filters">
          <div className="filter-group">
            <label htmlFor="cost-year-select">Year:</label>
            <select 
              id="cost-year-select"
              value={selectedYear || ''} 
              onChange={handleYearChange}
              disabled={editMode}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          
          {!editMode ? (
            <button 
              className="edit-btn"
              onClick={() => setEditMode(true)}
              disabled={loading || !data || data.data.length === 0}
            >
              ✏️ Edit
            </button>
          ) : (
            <div className="edit-actions">
              <button 
                className="save-btn"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? '⏳ Saving...' : '💾 Save'}
              </button>
              <button 
                className="cancel-btn"
                onClick={handleCancel}
                disabled={saving}
              >
                ✖️ Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {saveMessage && (
        <div className={`save-message ${saveMessage.type}`}>
          {saveMessage.text}
        </div>
      )}

      <div className="card-body">
        {loading && (
          <div className="loading">Loading data</div>
        )}

        {error && (
          <div className="error-message">{error}</div>
        )}

        {!loading && !error && data && (
          <div className="cost-table-container">
            {editMode && (
              <div className="edit-hint">
                💡 Click on Fuel or LEC values to edit. Changes will be saved when you click Save.
              </div>
            )}
            <table className="data-table cost-table">
              <thead>
                <tr>
                  <th></th>
                  <th style={{ textAlign: 'right' }}>
                    Fuel
                    {editMode && <span className="editable-indicator">✏️</span>}
                  </th>
                  <th style={{ textAlign: 'right' }}>
                    LEC
                    {editMode && <span className="editable-indicator">✏️</span>}
                  </th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th style={{ textAlign: 'right' }}>Cost Per Ctn</th>
                  <th style={{ textAlign: 'right' }}>% Of Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((row, index) => {
                  const edited = editedData[row.month] || {};
                  const displayFuel = edited.fuel ?? row.fuel;
                  const displayLec = edited.lec ?? row.lec;
                  const displayTotal = (displayFuel === '' ? 0 : displayFuel) + (displayLec === '' ? 0 : displayLec);
                  
                  // Recalculate derived values proportionally
                  const totalRatio = row.total > 0 ? displayTotal / row.total : 0;
                  const displayCostPerCtn = row.cost_per_ctn * totalRatio;
                  const displayPctRevenue = row.pct_of_revenue * totalRatio;
                  
                  const fuelChanged = edited.fuel !== undefined && edited.fuel !== row.fuel;
                  const lecChanged = edited.lec !== undefined && edited.lec !== row.lec;
                  
                  return (
                    <tr key={index}>
                      <td>{row.month_short}</td>
                      <td className={`number ${editMode ? 'editable-cell' : ''} ${fuelChanged ? 'changed' : ''}`}>
                        {editMode ? (
                          <div className="input-wrapper">
                            <span className="currency-prefix">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={displayFuel}
                              onChange={(e) => handleInputChange(row.month, 'fuel', e.target.value)}
                              className="cost-input"
                            />
                          </div>
                        ) : (
                          `$ ${formatCurrency(row.fuel)}`
                        )}
                      </td>
                      <td className={`number ${editMode ? 'editable-cell' : ''} ${lecChanged ? 'changed' : ''}`}>
                        {editMode ? (
                          <div className="input-wrapper">
                            <span className="currency-prefix">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={displayLec}
                              onChange={(e) => handleInputChange(row.month, 'lec', e.target.value)}
                              className="cost-input"
                            />
                          </div>
                        ) : (
                          `$ ${formatCurrency(row.lec)}`
                        )}
                      </td>
                      <td className={`number total-cell ${(fuelChanged || lecChanged) ? 'changed' : ''}`}>
                        $ {formatCurrency(displayTotal)}
                      </td>
                      <td className={`number ${(fuelChanged || lecChanged) ? 'changed' : ''}`}>
                        $ {formatCurrency(displayCostPerCtn)}
                      </td>
                      <td className={`number ${(fuelChanged || lecChanged) ? 'changed' : ''}`}>
                        {Math.round(displayPctRevenue)}%
                      </td>
                    </tr>
                  );
                })}
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: '#718096' }}>
                      No cost data available for {selectedYear}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default CostAnalysis;
