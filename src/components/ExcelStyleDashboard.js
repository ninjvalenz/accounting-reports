import React, { useState, useCallback, useMemo } from 'react';
import { Upload, RefreshCw, Settings } from 'lucide-react';
import FileUpload from './FileUpload';
import useExcelParser from '../hooks/useExcelParser';
import { calculateDashboard } from '../utils/calculations';
import { formatNumber, formatCurrency, formatPercent } from '../utils/formatters';

const ExcelStyleDashboard = ({ onNavigateToMaintenance }) => {
  const { sheets, loading, error, parseFile, reset, REQUIRED_SHEETS } = useExcelParser();
  const [selectedMonth, setSelectedMonth] = useState("Jul'25");
  const [selectedYear, setSelectedYear] = useState(2025);
  const [collectionAmount, setCollectionAmount] = useState(null);
  const [isEditingCollection, setIsEditingCollection] = useState(false);

  const handleFileSelect = useCallback((file) => {
    parseFile(file).catch(() => {});
  }, [parseFile]);

  // Calculate dashboard data
  const dashboardData = useMemo(() => {
    if (!sheets) return null;
    const data = calculateDashboard(sheets, selectedMonth, selectedYear);
    
    // Override collection if user has set a custom value
    if (collectionAmount !== null && data) {
      const collection = parseFloat(collectionAmount) || 0;
      data.summary.collection = collection;
      data.summary.collectionEfficiency = data.summary.salesAmount.actual > 0 
        ? collection / data.summary.salesAmount.actual 
        : 0;
    }
    
    return data;
  }, [sheets, selectedMonth, selectedYear, collectionAmount]);

  const handleMonthChange = useCallback((e) => {
    setSelectedMonth(e.target.value);
    setCollectionAmount(null); // Reset custom collection when month changes
  }, []);

  const handleCollectionChange = useCallback((e) => {
    const value = e.target.value.replace(/[^0-9.]/g, ''); // Remove non-numeric characters
    setCollectionAmount(value);
  }, []);

  const handleCollectionBlur = useCallback(() => {
    setIsEditingCollection(false);
  }, []);

  const handleCollectionFocus = useCallback(() => {
    setIsEditingCollection(true);
  }, []);

  // If no data, show upload screen
  if (!sheets) {
    return (
      <FileUpload
        onFileSelect={handleFileSelect}
        loading={loading}
        error={error}
        requiredSheets={REQUIRED_SHEETS}
        onNavigateToMaintenance={onNavigateToMaintenance}
      />
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Processing data...</p>
        </div>
      </div>
    );
  }

  const displayCollection = collectionAmount !== null ? parseFloat(collectionAmount) || 0 : dashboardData.summary.collection;

  return (
    <div className="min-h-screen bg-white p-6">
      {/* Header Controls */}
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">Sales Performance Dashboard 2025</h1>
          <select
            value={selectedMonth}
            onChange={handleMonthChange}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm"
          >
            {dashboardData.filters.months.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded cursor-pointer text-sm hover:bg-blue-600">
            <Upload size={16} />
            <span>New File</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])}
              className="hidden"
            />
          </label>
          <button
            onClick={reset}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
          >
            <RefreshCw size={16} />
            <span>Reset</span>
          </button>
          {onNavigateToMaintenance && (
            <button
              onClick={onNavigateToMaintenance}
              className="flex items-center gap-2 px-3 py-1.5 bg-purple-500 text-white rounded text-sm hover:bg-purple-600"
              title="Manage Product Categories"
            >
              <Settings size={16} />
              <span>Maintenance</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="space-y-6">
        {/* Top KPI Section - Two Column Layout */}
        <div className="grid grid-cols-2 gap-6">
          {/* Sales Comparison */}
          <div>
            <h2 className="text-sm font-bold mb-3 bg-blue-600 text-white p-2">
              Comparison - Sales (Budget vs Actual)
            </h2>
            <div className="mb-2">
              <span className="font-semibold text-sm">Months: </span>
              <span className="text-sm">{selectedMonth}</span>
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">{selectedYear}</th>
                  <th className="border border-gray-300 p-2 text-right">Budget</th>
                  <th className="border border-gray-300 p-2 text-right">Actual</th>
                  <th className="border border-gray-300 p-2 text-right">Variance</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 p-2 font-semibold">Sales Cases</td>
                  <td className="border border-gray-300 p-2 text-right">{formatNumber(dashboardData.summary.salesCases.budget)}</td>
                  <td className="border border-gray-300 p-2 text-right">{formatNumber(dashboardData.summary.salesCases.actual)}</td>
                  <td className={`border border-gray-300 p-2 text-right ${dashboardData.summary.salesCases.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(dashboardData.summary.salesCases.variance)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-2 font-semibold">Daily Case Avg</td>
                  <td className="border border-gray-300 p-2 text-right">{formatNumber(dashboardData.summary.dailyCaseAvg.budget, 2)}</td>
                  <td className="border border-gray-300 p-2 text-right">{formatNumber(dashboardData.summary.dailyCaseAvg.actual, 2)}</td>
                  <td className={`border border-gray-300 p-2 text-right ${dashboardData.summary.dailyCaseAvg.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(dashboardData.summary.dailyCaseAvg.variance, 2)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-2 font-semibold">Sales Amount (US$)</td>
                  <td className="border border-gray-300 p-2 text-right">{formatCurrency(dashboardData.summary.salesAmount.budget)}</td>
                  <td className="border border-gray-300 p-2 text-right">{formatCurrency(dashboardData.summary.salesAmount.actual)}</td>
                  <td className={`border border-gray-300 p-2 text-right ${dashboardData.summary.salesAmount.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(dashboardData.summary.salesAmount.variance)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-2 font-semibold">Collection (US$)</td>
                  <td className="border border-gray-300 p-2 text-right">-</td>
                  <td className="border border-gray-300 p-2 text-right">
                    {isEditingCollection ? (
                      <input
                        type="text"
                        value={collectionAmount || ''}
                        onChange={handleCollectionChange}
                        onBlur={handleCollectionBlur}
                        placeholder={formatNumber(displayCollection, 2)}
                        className="w-full text-right px-1 border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <span 
                        onClick={handleCollectionFocus}
                        className="cursor-pointer hover:bg-blue-50 block px-1 rounded"
                        title="Click to edit"
                      >
                        {formatCurrency(displayCollection)}
                      </span>
                    )}
                  </td>
                  <td className="border border-gray-300 p-2 text-right">-</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-2 font-semibold">Collection Efficiency Ratio (% of Sales)</td>
                  <td className="border border-gray-300 p-2 text-right">-</td>
                  <td className="border border-gray-300 p-2 text-right">{formatPercent(dashboardData.summary.collectionEfficiency)}</td>
                  <td className="border border-gray-300 p-2 text-right">-</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Production Comparison */}
          <div>
            <h2 className="text-sm font-bold mb-3 bg-green-600 text-white p-2">
              Comparison - Production (Budgeted vs Actual)
            </h2>
            <div className="mb-2">
              <span className="font-semibold text-sm">Months: </span>
              <span className="text-sm">{selectedMonth}</span>
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">{selectedYear}</th>
                  <th className="border border-gray-300 p-2 text-right">Budget</th>
                  <th className="border border-gray-300 p-2 text-right">Actual</th>
                  <th className="border border-gray-300 p-2 text-right">Variance</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 p-2 font-semibold">Production Cases</td>
                  <td className="border border-gray-300 p-2 text-right">{formatNumber(dashboardData.summary.productionCases.budget)}</td>
                  <td className="border border-gray-300 p-2 text-right">{formatNumber(dashboardData.summary.productionCases.actual)}</td>
                  <td className={`border border-gray-300 p-2 text-right ${dashboardData.summary.productionCases.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(dashboardData.summary.productionCases.variance)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-2 font-semibold">Daily Case Avg</td>
                  <td className="border border-gray-300 p-2 text-right">{formatNumber(dashboardData.summary.dailyCaseAvg.budget, 2)}</td>
                  <td className="border border-gray-300 p-2 text-right">{formatNumber(dashboardData.summary.dailyCaseAvg.actual, 2)}</td>
                  <td className={`border border-gray-300 p-2 text-right ${dashboardData.summary.dailyCaseAvg.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatNumber(dashboardData.summary.dailyCaseAvg.variance, 2)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-2 font-semibold">Production Ltrs</td>
                  <td className="border border-gray-300 p-2 text-right">-</td>
                  <td className="border border-gray-300 p-2 text-right">{formatNumber(dashboardData.summary.productionLiters, 2)}</td>
                  <td className="border border-gray-300 p-2 text-right">-</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-2 font-semibold">Daily Liter Avg</td>
                  <td className="border border-gray-300 p-2 text-right">-</td>
                  <td className="border border-gray-300 p-2 text-right">{formatNumber(dashboardData.summary.productionLiters / dashboardData.workingDays, 2)}</td>
                  <td className="border border-gray-300 p-2 text-right">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Category-wise Tables */}
        <div className="grid grid-cols-2 gap-6">
          {/* Sales Category Wise */}
          <div>
            <h2 className="text-sm font-bold mb-3 bg-blue-600 text-white p-2">
              Sales Category Wise
            </h2>
            <div className="mb-2 text-sm">
              <span className="font-semibold">Year: </span>{selectedYear}
              <span className="font-semibold ml-4">Month: </span>{selectedMonth}
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">Category</th>
                  <th className="border border-gray-300 p-2 text-right">Qty (In Cases)</th>
                  <th className="border border-gray-300 p-2 text-right">Qty (In Liters)</th>
                  <th className="border border-gray-300 p-2 text-right">Amount (USD)</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.salesByCategory.map((item, idx) => (
                  <tr key={idx} className={item.category === 'Grand Total' ? 'bg-gray-200 font-bold' : ''}>
                    <td className="border border-gray-300 p-2">{item.category}</td>
                    <td className="border border-gray-300 p-2 text-right">{formatNumber(item.qty)}</td>
                    <td className="border border-gray-300 p-2 text-right">{formatNumber(item.liters, 2)}</td>
                    <td className="border border-gray-300 p-2 text-right">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Production Category Wise */}
          <div>
            <h2 className="text-sm font-bold mb-3 bg-green-600 text-white p-2">
              Production Category Wise
            </h2>
            <div className="mb-2 text-sm">
              <span className="font-semibold">Year: </span>{selectedYear}
              <span className="font-semibold ml-4">Month: </span>{selectedMonth}
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">Category</th>
                  <th className="border border-gray-300 p-2 text-right">Qty (In cases)</th>
                  <th className="border border-gray-300 p-2 text-right">Qty (In Ltrs)</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.productionByCategory.map((item, idx) => (
                  <tr key={idx} className={item.category === 'Grand Total' ? 'bg-gray-200 font-bold' : ''}>
                    <td className="border border-gray-300 p-2">{item.category}</td>
                    <td className="border border-gray-300 p-2 text-right">{formatNumber(item.qty)}</td>
                    <td className="border border-gray-300 p-2 text-right">{formatNumber(item.liters, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* YoY Growth Section */}
        <div>
          <h2 className="text-sm font-bold mb-3 bg-purple-600 text-white p-2">
            YoY Growth
          </h2>
          <div className="grid grid-cols-2 gap-6">
            {/* Qty Comparison */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Sum of Qty-Actual</h3>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-2 text-left">Product Category</th>
                    <th className="border border-gray-300 p-2 text-right">2024</th>
                    <th className="border border-gray-300 p-2 text-right">2025</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.yoyData.qty.map((item, idx) => (
                    <tr key={idx} className={item.category === 'Grand Total' ? 'bg-gray-200 font-bold' : ''}>
                      <td className="border border-gray-300 p-2">{item.category}</td>
                      <td className="border border-gray-300 p-2 text-right">{item.y2024 ? formatNumber(item.y2024) : '-'}</td>
                      <td className="border border-gray-300 p-2 text-right">{item.y2025 ? formatNumber(item.y2025) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Amount Comparison */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Sum of Amount (US$)</h3>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-2 text-left">Product Category</th>
                    <th className="border border-gray-300 p-2 text-right">2024</th>
                    <th className="border border-gray-300 p-2 text-right">2025</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.yoyData.amount.map((item, idx) => (
                    <tr key={idx} className={item.category === 'Grand Total' ? 'bg-gray-200 font-bold' : ''}>
                      <td className="border border-gray-300 p-2">{item.category}</td>
                      <td className="border border-gray-300 p-2 text-right">{item.y2024 ? formatCurrency(item.y2024) : '-'}</td>
                      <td className="border border-gray-300 p-2 text-right">{item.y2025 ? formatCurrency(item.y2025) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* MoM Growth Section */}
        <div>
          <h2 className="text-sm font-bold mb-3 bg-orange-600 text-white p-2">
            MoM Growth
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">Month</th>
                  <th className="border border-gray-300 p-2 text-right">Soft drink Can</th>
                  <th className="border border-gray-300 p-2 text-right">Soft Drink Pet</th>
                  <th className="border border-gray-300 p-2 text-right">Alcohol - CSD</th>
                  <th className="border border-gray-300 p-2 text-right">Alcohol Drink</th>
                  <th className="border border-gray-300 p-2 text-right">Water</th>
                  <th className="border border-gray-300 p-2 text-right">Juice</th>
                  <th className="border border-gray-300 p-2 text-right">Flv. Water</th>
                  <th className="border border-gray-300 p-2 text-right">Total Qty</th>
                  <th className="border border-gray-300 p-2 text-right">Sales in $</th>
                  <th className="border border-gray-300 p-2 text-right">MoM Growth %</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.momData.map((item, idx) => (
                  <tr key={idx}>
                    <td className="border border-gray-300 p-2">{item.month}</td>
                    <td className="border border-gray-300 p-2 text-right">{formatNumber(item['Soft drink Can'])}</td>
                    <td className="border border-gray-300 p-2 text-right">{formatNumber(item['Soft Drink Pet'])}</td>
                    <td className="border border-gray-300 p-2 text-right">{formatNumber(item['Alcohol - CSD'])}</td>
                    <td className="border border-gray-300 p-2 text-right">{formatNumber(item['Alcohol Drink'])}</td>
                    <td className="border border-gray-300 p-2 text-right">{formatNumber(item['Water'])}</td>
                    <td className="border border-gray-300 p-2 text-right">{formatNumber(item['Juice'])}</td>
                    <td className="border border-gray-300 p-2 text-right">{formatNumber(item['Flv. Water'])}</td>
                    <td className="border border-gray-300 p-2 text-right font-semibold">{formatNumber(item.totalQty)}</td>
                    <td className="border border-gray-300 p-2 text-right font-semibold">{formatCurrency(item.salesAmount)}</td>
                    <td className={`border border-gray-300 p-2 text-right ${item.momGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {item.momGrowth ? formatPercent(item.momGrowth) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sales Distribution - Three Column Layout */}
        <div>
          <h2 className="text-sm font-bold mb-3 bg-indigo-600 text-white p-2">
            Sales by Location by Sales Man
          </h2>
          <div className="mb-2 text-sm">
            <span className="font-semibold">Month: </span>{selectedMonth.replace("'25", "")}
          </div>
          
          <div className="grid grid-cols-3 gap-6">
            {/* Sales by Salesperson */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Sales by Sales Person</h3>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-2 text-left">Row Labels</th>
                    <th className="border border-gray-300 p-2 text-right">Sum of Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.salesBySalesperson.map((item, idx) => (
                    <tr key={idx} className={item.name === 'Grand Total' ? 'bg-gray-200 font-bold' : ''}>
                      <td className="border border-gray-300 p-2">{item.name}</td>
                      <td className="border border-gray-300 p-2 text-right">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sales by Location */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Sales by Location</h3>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-2 text-left">Row Labels</th>
                    <th className="border border-gray-300 p-2 text-right">Sum of Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.salesByLocation.map((item, idx) => (
                    <tr key={idx} className={item.name === 'Grand Total' ? 'bg-gray-200 font-bold' : ''}>
                      <td className="border border-gray-300 p-2">{item.name}</td>
                      <td className="border border-gray-300 p-2 text-right">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sales by Type */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Sales by Type</h3>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 p-2 text-left">Type</th>
                    <th className="border border-gray-300 p-2 text-right">Sum of Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.salesByType.map((item, idx) => (
                    <tr key={idx} className={item.name === 'Grand Total' ? 'bg-gray-200 font-bold' : ''}>
                      <td className="border border-gray-300 p-2">{item.name}</td>
                      <td className="border border-gray-300 p-2 text-right">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExcelStyleDashboard;
