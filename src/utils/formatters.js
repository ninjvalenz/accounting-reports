/**
 * Formatting utilities for the Sales Dashboard
 */

export const formatNumber = (num, decimals = 0) => {
  if (num === null || num === undefined || isNaN(num)) return '-';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
};

export const formatCurrency = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(num);
};

export const formatPercent = (num, decimals = 1) => {
  if (num === null || num === undefined || isNaN(num)) return '-';
  return (num * 100).toFixed(decimals) + '%';
};

export const formatVariance = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  const prefix = value >= 0 ? '' : '';
  return prefix + formatNumber(value);
};

export const formatCompact = (value) => {
  if (value === null || value === undefined) return '0';
  
  const num = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  if (num >= 1000000) {
    return sign + (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return sign + (num / 1000).toFixed(1) + 'K';
  }
  
  return sign + num.toFixed(0);
};
