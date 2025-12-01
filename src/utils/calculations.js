/**
 * Sales Dashboard Calculations
 * Matches exactly what's shown in Dashboard-1 sheet
 */

// Month column mapping for Sales Projection 2025 sheet
const MONTH_QTY_COLUMNS = {
  "Jan'25": 4, "Feb'25": 5, "Mar'25": 6, "Apr'25": 7,
  "May'25": 8, "Jun'25": 9, "Jul'25": 10, "Aug'25": 11,
  "Sep'25": 12, "Oct'25": 13, "Nov'25": 14, "Dec'25": 15
};

const MONTH_AMOUNT_COLUMNS = {
  "Jan'25": 33, "Feb'25": 34, "Mar'25": 35, "Apr'25": 36,
  "May'25": 37, "Jun'25": 38, "Jul'25": 39, "Aug'25": 40,
  "Sep'25": 41, "Oct'25": 42, "Nov'25": 43, "Dec'25": 44
};

// Get working days for a month
export const getWorkingDays = (daysData, month, year) => {
  if (!daysData || daysData.length < 2) return 27;
  const headers = daysData[0];
  const yearCol = headers.indexOf('Year');
  const monthCol = headers.indexOf('Months');
  const daysCol = headers.indexOf('Days in months');
  const row = daysData.find(r => r[monthCol] === month && r[yearCol] === year);
  return row ? row[daysCol] : 27;
};

// Calculate budget from Sales Projection 2025 (for Cases) and Data sheet (for Amount)
export const calculateBudget = (projectionData, salesData, month) => {
  // Cases Budget: From Sales Projection 2025, row 66 (totals row)
  let cases = 0;
  if (projectionData && projectionData.length >= 66) {
    const totalsRow = projectionData[65]; // Row 66 in Excel (0-indexed as 65)
    const qtyCol = MONTH_QTY_COLUMNS[month] || 10;
    cases = parseFloat(totalsRow[qtyCol]) || 0;
    console.log(`Budget Cases: projectionData has ${projectionData.length} rows, qtyCol=${qtyCol}, value=${totalsRow[qtyCol]}`);
  } else {
    console.log(`Budget Cases: projectionData length = ${projectionData ? projectionData.length : 'null'}`);
  }
  
  // Amount Budget: Sum from Data sheet, column K (Amount-Budget)
  let amount = 0;
  if (salesData && salesData.length > 1) {
    const headers = salesData[0];
    const monthCol = headers.indexOf('Month');
    const amountBudgetCol = headers.indexOf('Amount-Budget (US$)');
    
    console.log(`Budget Amount: monthCol=${monthCol}, amountBudgetCol=${amountBudgetCol}, month=${month}`);
    
    if (monthCol >= 0 && amountBudgetCol >= 0) {
      salesData.slice(1).forEach(row => {
        if (row[monthCol] === month) {
          amount += parseFloat(row[amountBudgetCol]) || 0;
        }
      });
      console.log(`Budget Amount for ${month}: ${amount}`);
    }
  }
  
  return { cases, amount };
};

// Calculate Sales by Category from Data sheet
export const calculateSalesByCategory = (salesData, month, year) => {
  if (!salesData || salesData.length < 2) return [];
  const headers = salesData[0];
  const cols = {
    year: headers.indexOf('Year'),
    month: headers.indexOf('Month'),
    category: headers.indexOf('Product Category'),
    qtyActual: headers.indexOf('Qty-Actual'),
    amountActual: headers.indexOf('Amount-Actual (US$)'),
    liters: headers.indexOf('Qty in Liters')
  };

  const result = {};
  salesData.slice(1).forEach(row => {
    if (row[cols.month] === month && row[cols.year] === year) {
      const category = row[cols.category] || 'Unknown';
      if (!result[category]) result[category] = { qty: 0, liters: 0, amount: 0 };
      result[category].qty += parseFloat(row[cols.qtyActual]) || 0;
      result[category].liters += parseFloat(row[cols.liters]) || 0;
      result[category].amount += parseFloat(row[cols.amountActual]) || 0;
    }
  });

  return Object.entries(result).map(([name, data]) => ({
    category: name, qty: data.qty, liters: data.liters, amount: data.amount
  })).sort((a, b) => b.qty - a.qty);
};

// Calculate Production by Category from Production Data sheet
export const calculateProductionByCategory = (productionData, month, year) => {
  if (!productionData || productionData.length < 2) return [];
  const headers = productionData[0];
  const cols = {
    year: headers.indexOf('Year'),
    month: headers.indexOf('Month'),
    category: headers.indexOf('Product Category'),
    qtyActual: headers.indexOf('Qty-Actual'),
    liters: headers.indexOf('Qty in Liters')
  };

  const result = {};
  productionData.slice(1).forEach(row => {
    if (row[cols.month] === month && row[cols.year] === year) {
      const category = row[cols.category] || 'Unknown';
      if (!result[category]) result[category] = { qty: 0, liters: 0 };
      result[category].qty += parseFloat(row[cols.qtyActual]) || 0;
      result[category].liters += parseFloat(row[cols.liters]) || 0;
    }
  });

  return Object.entries(result).map(([name, data]) => ({
    category: name, qty: data.qty, liters: data.liters
  })).sort((a, b) => b.qty - a.qty);
};

// Calculate YoY Growth data
export const calculateYoYData = (salesData) => {
  if (!salesData || salesData.length < 2) return { qty: [], amount: [] };
  const headers = salesData[0];
  const cols = {
    year: headers.indexOf('Year'),
    category: headers.indexOf('Product Category'),
    qtyActual: headers.indexOf('Qty-Actual'),
    amountActual: headers.indexOf('Amount-Actual (US$)')
  };

  const categories = [...new Set(salesData.slice(1).map(row => row[cols.category]).filter(Boolean))];
  
  const qtyData = [];
  const amountData = [];

  categories.forEach(cat => {
    const qty2024 = salesData.slice(1)
      .filter(row => row[cols.year] === 2024 && row[cols.category] === cat)
      .reduce((sum, row) => sum + (parseFloat(row[cols.qtyActual]) || 0), 0);
    const qty2025 = salesData.slice(1)
      .filter(row => row[cols.year] === 2025 && row[cols.category] === cat)
      .reduce((sum, row) => sum + (parseFloat(row[cols.qtyActual]) || 0), 0);
    const amt2024 = salesData.slice(1)
      .filter(row => row[cols.year] === 2024 && row[cols.category] === cat)
      .reduce((sum, row) => sum + (parseFloat(row[cols.amountActual]) || 0), 0);
    const amt2025 = salesData.slice(1)
      .filter(row => row[cols.year] === 2025 && row[cols.category] === cat)
      .reduce((sum, row) => sum + (parseFloat(row[cols.amountActual]) || 0), 0);

    if (qty2024 > 0 || qty2025 > 0) {
      qtyData.push({ category: cat, y2024: qty2024, y2025: qty2025 });
    }
    if (amt2024 > 0 || amt2025 > 0) {
      amountData.push({ category: cat, y2024: amt2024, y2025: amt2025 });
    }
  });

  // Calculate totals
  const qtyTotal = { category: 'Grand Total', y2024: qtyData.reduce((s, r) => s + r.y2024, 0), y2025: qtyData.reduce((s, r) => s + r.y2025, 0) };
  const amtTotal = { category: 'Grand Total', y2024: amountData.reduce((s, r) => s + r.y2024, 0), y2025: amountData.reduce((s, r) => s + r.y2025, 0) };

  return { qty: [...qtyData, qtyTotal], amount: [...amountData, amtTotal] };
};

// Calculate MoM Growth data
export const calculateMoMData = (salesData, year) => {
  if (!salesData || salesData.length < 2) return [];
  const headers = salesData[0];
  const cols = {
    year: headers.indexOf('Year'),
    month: headers.indexOf('Month'),
    category: headers.indexOf('Product Category'),
    qtyActual: headers.indexOf('Qty-Actual'),
    amountActual: headers.indexOf('Amount-Actual (US$)')
  };

  const months = ["Jan'25", "Feb'25", "Mar'25", "Apr'25", "May'25", "Jun'25", "Jul'25", "Aug'25", "Sep'25", "Oct'25", "Nov'25", "Dec'25"];
  const categoryOrder = ['Soft drink Can', 'Soft Drink Pet', 'Alcohol - CSD', 'Alcohol Drink', 'Water', 'Juice', 'Flv. Water'];

  const result = [];
  let prevAmount = null;

  months.forEach(month => {
    const monthSales = salesData.slice(1).filter(row => row[cols.month] === month && row[cols.year] === year);
    if (monthSales.length === 0) return;

    const byCategory = {};
    categoryOrder.forEach(cat => byCategory[cat] = 0);

    let totalQty = 0, totalAmount = 0;
    monthSales.forEach(row => {
      const cat = row[cols.category];
      const qty = parseFloat(row[cols.qtyActual]) || 0;
      const amt = parseFloat(row[cols.amountActual]) || 0;
      if (byCategory.hasOwnProperty(cat)) byCategory[cat] += qty;
      totalQty += qty;
      totalAmount += amt;
    });

    const momGrowth = prevAmount !== null ? (totalAmount - prevAmount) / prevAmount : null;
    prevAmount = totalAmount;

    result.push({
      month: month.replace("'25", "'25"),
      ...byCategory,
      totalQty,
      salesAmount: totalAmount,
      momGrowth
    });
  });

  return result;
};

// Calculate Sales by Salesperson from SALES BY FPR
export const calculateSalesBySalesperson = (fprData, month, year) => {
  if (!fprData || fprData.length < 2) return [];
  const headers = fprData[0];
  const cols = {
    year: headers.indexOf('Year'),
    month: headers.indexOf('Month'),
    salesman: headers.indexOf('SalesMan'),
    amount: headers.indexOf('Amount')
  };

  const monthName = month.replace(/'[0-9]+$/, '');
  const result = {};

  fprData.slice(1).forEach(row => {
    if (row[cols.year] === year && row[cols.month] === monthName) {
      const salesman = row[cols.salesman] || 'Unknown';
      result[salesman] = (result[salesman] || 0) + (parseFloat(row[cols.amount]) || 0);
    }
  });

  const data = Object.entries(result).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  const total = data.reduce((s, r) => s + r.amount, 0);
  return [...data, { name: 'Grand Total', amount: total }];
};

// Calculate Sales by Location from SALES BY FPR
export const calculateSalesByLocation = (fprData, month, year) => {
  if (!fprData || fprData.length < 2) return [];
  const headers = fprData[0];
  const cols = {
    year: headers.indexOf('Year'),
    month: headers.indexOf('Month'),
    location: headers.indexOf('Location'),
    amount: headers.indexOf('Amount')
  };

  const monthName = month.replace(/'[0-9]+$/, '');
  const result = {};

  fprData.slice(1).forEach(row => {
    if (row[cols.year] === year && row[cols.month] === monthName) {
      const location = row[cols.location] || 'Unknown';
      result[location] = (result[location] || 0) + (parseFloat(row[cols.amount]) || 0);
    }
  });

  const data = Object.entries(result).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  const total = data.reduce((s, r) => s + r.amount, 0);
  return [...data, { name: 'Grand Total', amount: total }];
};

// Calculate Sales by Type from SALES BY FPR
export const calculateSalesByType = (fprData, month, year) => {
  if (!fprData || fprData.length < 2) return [];
  const headers = fprData[0];
  const cols = {
    year: headers.indexOf('Year'),
    month: headers.indexOf('Month'),
    type: headers.indexOf('Type of sales'),
    amount: headers.indexOf('Amount')
  };

  const monthName = month.replace(/'[0-9]+$/, '');
  const result = {};

  fprData.slice(1).forEach(row => {
    if (row[cols.year] === year && row[cols.month] === monthName) {
      const type = row[cols.type] || 'Unknown';
      result[type] = (result[type] || 0) + (parseFloat(row[cols.amount]) || 0);
    }
  });

  const data = Object.entries(result).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  const total = data.reduce((s, r) => s + r.amount, 0);
  return [...data, { name: 'Grand Total', amount: total }];
};

// Get available months from data
export const getAvailableFilters = (salesData) => {
  if (!salesData || salesData.length < 2) return { months: [], years: [] };
  const headers = salesData[0];
  const monthCol = headers.indexOf('Month');
  const yearCol = headers.indexOf('Year');
  const months = [...new Set(salesData.slice(1).map(row => row[monthCol]).filter(Boolean))].sort();
  const years = [...new Set(salesData.slice(1).map(row => row[yearCol]).filter(Boolean))].sort();
  return { months, years };
};

// Main calculation function
export const calculateDashboard = (sheets, month, year) => {
  const salesData = sheets['Data'] || [];
  const productionData = sheets['Production Data'] || [];
  const fprData = sheets['SALES BY FPR'] || [];
  const daysData = sheets['Day (in Month)'] || [];
  const projectionData = sheets['Sales Projection 2025'] || [];

  const workingDays = getWorkingDays(daysData, month, year);
  const budget = calculateBudget(projectionData, salesData, month);
  const salesByCategory = calculateSalesByCategory(salesData, month, year);
  const productionByCategory = calculateProductionByCategory(productionData, month, year);

  // Calculate totals
  const totalSalesCases = salesByCategory.reduce((s, c) => s + c.qty, 0);
  const totalSalesLiters = salesByCategory.reduce((s, c) => s + c.liters, 0);
  const totalSalesAmount = salesByCategory.reduce((s, c) => s + c.amount, 0);
  const totalProductionCases = productionByCategory.reduce((s, c) => s + c.qty, 0);
  const totalProductionLiters = productionByCategory.reduce((s, c) => s + c.liters, 0);

  // Collection data (from FPR - simplified, you may need to adjust based on your actual data)
  const collection = totalSalesAmount * 0.858; // Placeholder - adjust as needed
  const collectionEfficiency = collection / totalSalesAmount;

  return {
    selectedMonth: month,
    selectedYear: year,
    workingDays,
    
    // Summary for KPI Cards
    summary: {
      workingDays,
      salesCases: {
        budget: budget.cases,
        actual: totalSalesCases,
        variance: totalSalesCases - budget.cases
      },
      salesAmount: {
        budget: budget.amount,
        actual: totalSalesAmount,
        variance: totalSalesAmount - budget.amount
      },
      productionCases: {
        budget: budget.cases,
        actual: totalProductionCases,
        variance: totalProductionCases - budget.cases
      },
      dailyCaseAvg: {
        budget: budget.cases / workingDays,
        actual: totalSalesCases / workingDays, // Sales Daily Case Avg, not production
        variance: (totalSalesCases - budget.cases) / workingDays
      },
      productionLiters: totalProductionLiters,
      collection: collection,
      collectionEfficiency: collectionEfficiency
    },

    // Sales comparison (Budget vs Actual)
    salesComparison: {
      salesCases: { budget: budget.cases, actual: totalSalesCases, variance: totalSalesCases - budget.cases },
      dailyCaseAvg: { budget: budget.cases / workingDays, actual: totalSalesCases / workingDays, variance: (totalSalesCases - budget.cases) / workingDays },
      salesAmount: { budget: budget.amount, actual: totalSalesAmount, variance: totalSalesAmount - budget.amount },
      collection: { actual: collection },
      collectionEfficiency: { actual: collectionEfficiency }
    },

    // Production comparison (Budget vs Actual)
    productionComparison: {
      productionCases: { budget: budget.cases, actual: totalProductionCases, variance: totalProductionCases - budget.cases },
      dailyCaseAvg: { budget: budget.cases / workingDays, actual: totalProductionCases / workingDays, variance: (totalProductionCases - budget.cases) / workingDays },
      productionLtrs: { actual: totalProductionLiters },
      dailyLiterAvg: { actual: totalProductionLiters / workingDays }
    },

    // Category breakdowns
    salesByCategory: [...salesByCategory, { category: 'Grand Total', qty: totalSalesCases, liters: totalSalesLiters, amount: totalSalesAmount }],
    productionByCategory: [...productionByCategory, { category: 'Grand Total', qty: totalProductionCases, liters: totalProductionLiters }],

    // YoY data
    yoyData: calculateYoYData(salesData),

    // MoM data
    momData: calculateMoMData(salesData, year),

    // Sales distribution
    salesBySalesperson: calculateSalesBySalesperson(fprData, month, year),
    salesByLocation: calculateSalesByLocation(fprData, month, year),
    salesByType: calculateSalesByType(fprData, month, year),

    // Filters
    filters: getAvailableFilters(salesData)
  };
};

// Export functions
export const exportToJSON = (data, filename = 'dashboard_data.json') => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle values that contain commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
