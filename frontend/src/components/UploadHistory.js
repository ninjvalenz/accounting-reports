import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

function UploadHistory({ onBack, onDataChange }) {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUploads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/uploads`);
      setUploads(response.data.uploads || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch uploads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  const handleDelete = async (uploadId) => {
    setDeleting(true);
    try {
      await axios.delete(`${API_BASE_URL}/uploads/${uploadId}`);
      setDeleteConfirm(null);
      await fetchUploads(); // Refresh list
      
      // Notify parent to refresh dashboard
      if (onDataChange) {
        onDataChange();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete upload');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="upload-history">
      <div className="history-header">
        <h2>📁 Upload History</h2>
        <button className="back-btn" onClick={onBack}>
          ← Back to Dashboard
        </button>
      </div>

      {error && (
        <div className="error-message" style={{ margin: '16px 24px' }}>{error}</div>
      )}

      {loading && (
        <div className="loading">Loading uploads</div>
      )}

      {!loading && uploads.length === 0 && (
        <div className="empty-state">
          <p>No uploads yet. Upload an Excel file to get started.</p>
        </div>
      )}

      {!loading && uploads.length > 0 && (
        <div className="uploads-table-container">
          <table className="uploads-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Filename</th>
                <th>Upload Date</th>
                <th>Status</th>
                <th>Sheets Processed</th>
                <th>Periods</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((upload, index) => (
                <tr key={upload.id} className={`${upload.is_successful ? '' : 'error-row'} ${index === 0 ? 'latest-row' : ''}`}>
                  <td>
                    {upload.id}
                    {index === 0 && <span className="latest-badge">Latest</span>}
                  </td>
                  <td className="filename">{upload.filename}</td>
                  <td>{formatDate(upload.uploaded_date)}</td>
                  <td>
                    <span className={`status-badge ${upload.is_successful ? 'success' : 'error'}`}>
                      {upload.is_successful ? '✅ Success' : '❌ Failed'}
                    </span>
                  </td>
                  <td>
                    {upload.sheets_processed && upload.sheets_processed.length > 0 ? (
                      <ul className="sheets-list">
                        {upload.sheets_processed.map((sheet, idx) => (
                          <li key={idx}>{sheet}</li>
                        ))}
                      </ul>
                    ) : '-'}
                  </td>
                  <td>
                    {upload.months_years_processed && upload.months_years_processed.length > 0 ? (
                      <span className="periods-count">
                        {upload.months_years_processed.length} periods
                        <span className="periods-tooltip">
                          {upload.months_years_processed.join(', ')}
                        </span>
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    {deleteConfirm === upload.id ? (
                      <div className="confirm-delete">
                        <span>Are you sure?</span>
                        <button 
                          className="confirm-yes"
                          onClick={() => handleDelete(upload.id)}
                          disabled={deleting}
                        >
                          {deleting ? '...' : 'Yes'}
                        </button>
                        <button 
                          className="confirm-no"
                          onClick={() => setDeleteConfirm(null)}
                          disabled={deleting}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button 
                        className="delete-btn"
                        onClick={() => setDeleteConfirm(upload.id)}
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Show error details if any upload failed */}
      {uploads.some(u => !u.is_successful && u.error_message) && (
        <div className="error-details">
          <h3>Error Details</h3>
          {uploads.filter(u => !u.is_successful && u.error_message).map(upload => (
            <div key={upload.id} className="error-item">
              <strong>Upload #{upload.id} ({upload.filename}):</strong>
              <pre>{upload.error_message}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default UploadHistory;
