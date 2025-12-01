import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';

export const useExcelParser = () => {
  const [sheets, setSheets] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);

  const REQUIRED_SHEETS = [
    'Data',
    'Product Master',
    'Production Data',
    'Customer Master',
    'SALES BY FPR',
    'Day (in Month)',
    'Sales Projection 2025'
  ];

  const parseFile = useCallback((file) => {
    return new Promise((resolve, reject) => {
      setLoading(true);
      setError(null);
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: 'array' });
          
          const missingSheets = REQUIRED_SHEETS.filter(
            sheet => !workbook.SheetNames.includes(sheet)
          );
          
          if (missingSheets.length > 0) {
            const err = `Missing required sheets: ${missingSheets.join(', ')}`;
            setError(err);
            setLoading(false);
            reject(new Error(err));
            return;
          }

          const parsedSheets = {};
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            parsedSheets[sheetName] = XLSX.utils.sheet_to_json(sheet, {
              header: 1,
              defval: null,
              raw: true
            });
          }

          setSheets(parsedSheets);
          setLoading(false);
          resolve(parsedSheets);
        } catch (err) {
          setError(`Error parsing Excel file: ${err.message}`);
          setLoading(false);
          reject(err);
        }
      };

      reader.onerror = () => {
        setError('Error reading file');
        setLoading(false);
        reject(new Error('Error reading file'));
      };

      reader.readAsArrayBuffer(file);
    });
  }, []);

  const reset = useCallback(() => {
    setSheets(null);
    setError(null);
    setFileName(null);
  }, []);

  return { sheets, loading, error, fileName, parseFile, reset, REQUIRED_SHEETS };
};

export default useExcelParser;
