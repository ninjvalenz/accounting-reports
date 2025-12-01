import React, { useState, useCallback, useMemo } from 'react';
import { Upload, Package, TrendingUp, Users, MapPin, Building2, Download, RefreshCw } from 'lucide-react';

import FileUpload from './FileUpload';
import KPICards from './KPICards';
import Section from './Section';
import {
  SalesByCategoryChart,
  ProductionByCategoryChart,
  MoMTrendChart,
  YoYComparisonChart,
  SalesByTypeChart,
  SalesBySalespersonChart
} from './Charts';
import {
  SalesByCategoryTable,
  ProductionByCategoryTable,
  SalesByLocationList,
  SalesByTypeList,
  MoMDataTable
} from './DataTables';

import useExcelParser from '../hooks/useExcelParser';
import { calculateDashboard, exportToJSON, exportToCSV } from '../utils/calculations';

const SalesDashboard = () => {
  const { sheets, loading, error, parseFile, reset, REQUIRED_SHEETS } = useExcelParser();
  const [selectedMonth, setSelectedMonth] = useState("Jul'25");
  const [selectedYear, setSelectedYear] = useState(2025);
  const [expandedSections, setExpandedSections] = useState({
    salesCategory: true,
    productionCategory: true,
    momTrend: true,
    yoyComparison: true,
    salesPerson: true,
    location: true,
    salesType: true
  });

  const toggleSection = useCallback((section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const handleFileSelect = useCallback((file) => {
    parseFile(file).catch(() => {});
  }, [parseFile]);

  // Calculate dashboard data when sheets or filters change
  const dashboardData = useMemo(() => {
    if (!sheets) return null;
    return calculateDashboard(sheets, selectedMonth, selectedYear);
  }, [sheets, selectedMonth, selectedYear]);

  // Update month when filters are available
  const handleMonthChange = useCallback((e) => {
    setSelectedMonth(e.target.value);
  }, []);

  // If no data, show upload screen
  if (!sheets) {
    return (
      <FileUpload
        onFileSelect={handleFileSelect}
        loading={loading}
        error={error}
        requiredSheets={REQUIRED_SHEETS}
      />
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Processing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Sales Performance Dashboard</h1>
              <p className="text-blue-200 text-sm mt-1">
                Month: {selectedMonth} | Working Days: {dashboardData.summary.workingDays}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Month Filter */}
              <select
                value={selectedMonth}
                onChange={handleMonthChange}
                className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {dashboardData.filters.months.map(m => (
                  <option key={m} value={m} className="text-slate-900">{m}</option>
                ))}
              </select>

              {/* Export Dropdown */}
              <div className="relative group">
                <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors">
                  <Download size={18} />
                  <span>Export</span>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <button
                    onClick={() => exportToJSON(dashboardData)}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-t-lg"
                  >
                    Export as JSON
                  </button>
                  <button
                    onClick={() => exportToCSV(dashboardData, 'salesByCategory')}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Sales by Category (CSV)
                  </button>
                  <button
                    onClick={() => exportToCSV(dashboardData, 'salesBySalesperson')}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Sales by Person (CSV)
                  </button>
                  <button
                    onClick={() => exportToCSV(dashboardData, 'salesByLocation')}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-b-lg"
                  >
                    Sales by Location (CSV)
                  </button>
                </div>
              </div>

              {/* New File Button */}
              <label className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg cursor-pointer transition-colors">
                <Upload size={18} />
                <span>New File</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
              </label>

              {/* Reset Button */}
              <button
                onClick={reset}
                className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg transition-colors"
              >
                <RefreshCw size={18} />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* KPI Cards */}
        <KPICards summary={dashboardData.summary} />

        {/* Two Column Layout - Sales & Production by Category */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Section
            title="Sales by Category"
            icon={Package}
            expanded={expandedSections.salesCategory}
            onToggle={() => toggleSection('salesCategory')}
          >
            <SalesByCategoryChart data={dashboardData.salesByCategory} />
            <div className="mt-4">
              <SalesByCategoryTable data={dashboardData.salesByCategory} />
            </div>
          </Section>

          <Section
            title="Production by Category"
            icon={Package}
            expanded={expandedSections.productionCategory}
            onToggle={() => toggleSection('productionCategory')}
          >
            <ProductionByCategoryChart data={dashboardData.productionByCategory} />
            <div className="mt-4">
              <ProductionByCategoryTable data={dashboardData.productionByCategory} />
            </div>
          </Section>
        </div>

        {/* MoM Trend */}
        <Section
          title="Month-over-Month Trend"
          icon={TrendingUp}
          expanded={expandedSections.momTrend}
          onToggle={() => toggleSection('momTrend')}
        >
          <MoMTrendChart data={dashboardData.momData} />
          <div className="mt-4">
            <MoMDataTable data={dashboardData.momData} />
          </div>
        </Section>

        {/* Three Column Layout - Sales Distribution */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Section
            title="Sales by Salesperson"
            icon={Users}
            expanded={expandedSections.salesPerson}
            onToggle={() => toggleSection('salesPerson')}
          >
            <SalesBySalespersonChart data={dashboardData.salesBySalesperson} />
          </Section>

          <Section
            title="Top Locations"
            icon={MapPin}
            expanded={expandedSections.location}
            onToggle={() => toggleSection('location')}
          >
            <SalesByLocationList data={dashboardData.salesByLocation} />
          </Section>

          <Section
            title="Sales by Type"
            icon={Building2}
            expanded={expandedSections.salesType}
            onToggle={() => toggleSection('salesType')}
          >
            <SalesByTypeChart data={dashboardData.salesByType} />
            <div className="mt-4">
              <SalesByTypeList data={dashboardData.salesByType} />
            </div>
          </Section>
        </div>

        {/* YoY Comparison */}
        <Section
          title="Year-over-Year Comparison"
          icon={TrendingUp}
          expanded={expandedSections.yoyComparison}
          onToggle={() => toggleSection('yoyComparison')}
        >
          <YoYComparisonChart data={dashboardData.yoyData} />
        </Section>

        {/* Storage Info Footer */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">Data Storage Options</h3>
          <p className="text-slate-300 text-sm mb-4">
            For production use, export data as JSON for quick loading, or integrate with a database
            like SQLite for local apps or PostgreSQL for multi-user environments.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => exportToJSON(dashboardData)}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
            >
              Export Full Data (JSON)
            </button>
            <button
              onClick={() => {
                const summaryJSON = JSON.stringify({
                  exportedAt: new Date().toISOString(),
                  month: selectedMonth,
                  year: selectedYear,
                  summary: dashboardData.summary
                }, null, 2);
                const blob = new Blob([summaryJSON], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'dashboard_summary.json';
                a.click();
              }}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-sm font-medium transition-colors"
            >
              Export Summary Only
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesDashboard;
