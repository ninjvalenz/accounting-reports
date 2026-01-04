import React, { useState, useRef } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

function FileUpload({ onUploadSuccess, onUploadError }) {
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const fileInputRef = useRef(null);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files[0];
    
    if (!file) {
      setUploadStatus({ type: 'error', message: 'Please select a file first' });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setUploadStatus(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setUploadStatus({ 
          type: 'success', 
          message: 'File uploaded and saved to database! Dashboard is now ready.' 
        });
        onUploadSuccess({
          months: response.data.available_months,
          years: response.data.available_years
        });
      } else {
        throw new Error(response.data.error || 'Upload failed');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Upload failed';
      setUploadStatus({ type: 'error', message: errorMessage });
      onUploadError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="file-upload">
      <div className="file-upload-content">
        <label htmlFor="excel-file">Upload Excel File:</label>
        <input
          type="file"
          id="excel-file"
          ref={fileInputRef}
          accept=".xlsx,.xls"
          disabled={uploading}
        />
        <button 
          className="upload-btn" 
          onClick={handleUpload}
          disabled={uploading}
        >
          {uploading ? 'Processing...' : 'Upload & Process'}
        </button>
      </div>
      
      {uploadStatus && (
        <div className={`upload-status ${uploadStatus.type}`}>
          {uploadStatus.message}
        </div>
      )}
    </div>
  );
}

export default FileUpload;
