import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

function UploadedFiles({ onFileDeleted }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/uploaded-files`);
      setFiles(response.data.files || []);
      setError(null);
    } catch (err) {
      setError('Failed to fetch uploaded files');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDelete = async (fileId, filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?\n\nThis will remove all data associated with this file.`)) {
      return;
    }

    setDeleting(fileId);
    try {
      const response = await axios.delete(`${API_BASE_URL}/uploaded-files/${fileId}`);
      setFiles(response.data.files || []);
      
      // Notify parent component
      if (onFileDeleted) {
        onFileDeleted({
          months: response.data.available_months,
          years: response.data.available_years
        });
      }
    } catch (err) {
      setError('Failed to delete file');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="dashboard-card">
        <div className="card-header">
          <h2>Uploaded Files</h2>
        </div>
        <div className="card-body">
          <div className="loading">Loading files</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h2>Uploaded Files</h2>
      </div>
      <div className="card-body">
        {error && <div className="error-message">{error}</div>}
        
        {files.length === 0 ? (
          <div className="empty-state">
            <p>No files uploaded yet.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Filename</th>
                <th>Upload Date</th>
                <th>Sheets Processed</th>
                <th>Months Covered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id} className={file.is_active ? 'active-row' : ''}>
                  <td>
                    <span className={`status-badge ${file.is_active ? 'active' : 'inactive'}`}>
                      {file.is_active ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td className="filename">{file.filename}</td>
                  <td>{formatDate(file.upload_date)}</td>
                  <td>
                    <div className="sheets-list">
                      {file.sheets_processed.map((sheet, idx) => (
                        <span key={idx} className="sheet-tag">{sheet}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="months-summary">
                      {file.months_covered.length > 0 ? (
                        <>
                          <span>{file.months_covered.length} months</span>
                          <span className="months-range">
                            ({file.months_covered[0]} - {file.months_covered[file.months_covered.length - 1]})
                          </span>
                        </>
                      ) : (
                        <span>-</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(file.id, file.filename)}
                      disabled={deleting === file.id}
                    >
                      {deleting === file.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default UploadedFiles;
