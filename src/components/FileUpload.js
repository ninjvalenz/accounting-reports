import React, { useCallback } from 'react';
import { Upload, FileSpreadsheet } from 'lucide-react';

const FileUpload = ({ onFileSelect, loading, error, requiredSheets }) => {
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-3">Sales Performance Dashboard</h1>
          <p className="text-blue-200">Upload your Excel file to generate insights</p>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="bg-white/10 backdrop-blur-lg border-2 border-dashed border-blue-400/50 rounded-2xl p-12 text-center hover:border-blue-400 hover:bg-white/20 transition-all cursor-pointer"
        >
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileInput}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="mx-auto w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-6">
              <Upload size={36} className="text-blue-400" />
            </div>
            <p className="text-xl font-semibold text-white mb-2">Drop your Excel file here</p>
            <p className="text-blue-200 mb-4">or click to browse</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">
              <FileSpreadsheet size={18} />
              <span>Select File</span>
            </div>
          </label>
        </div>

        {loading && (
          <div className="mt-6 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/10 rounded-full">
              <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-white">Processing file...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-center">
            {error}
          </div>
        )}

        <div className="mt-8 p-6 bg-white/5 rounded-xl border border-white/10">
          <h3 className="text-white font-semibold mb-3">Required Sheets:</h3>
          <ul className="grid grid-cols-2 gap-2 text-blue-200 text-sm">
            {requiredSheets.map(sheet => (
              <li key={sheet} className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                {sheet}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
