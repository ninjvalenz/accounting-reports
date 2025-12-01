import React from 'react';
import { formatNumber, formatCurrency } from '../utils/formatters';
import { COLORS } from './Charts';

// Sales by Category Table
export const SalesByCategoryTable = ({ data }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-100">
          <th className="text-left py-2 px-3 text-slate-500 font-medium">Category</th>
          <th className="text-right py-2 px-3 text-slate-500 font-medium">Cases</th>
          <th className="text-right py-2 px-3 text-slate-500 font-medium">Liters</th>
          <th className="text-right py-2 px-3 text-slate-500 font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        {data.map((cat) => (
          <tr key={cat.name} className="border-b border-slate-50 hover:bg-slate-50">
            <td className="py-2 px-3 font-medium text-slate-700">{cat.name}</td>
            <td className="py-2 px-3 text-right text-slate-600">{formatNumber(cat.qty)}</td>
            <td className="py-2 px-3 text-right text-slate-600">{formatNumber(cat.liters, 2)}</td>
            <td className="py-2 px-3 text-right text-slate-600">{formatCurrency(cat.amount)}</td>
          </tr>
        ))}
        <tr className="bg-slate-50 font-semibold">
          <td className="py-2 px-3 text-slate-800">Total</td>
          <td className="py-2 px-3 text-right text-slate-800">
            {formatNumber(data.reduce((sum, cat) => sum + cat.qty, 0))}
          </td>
          <td className="py-2 px-3 text-right text-slate-800">
            {formatNumber(data.reduce((sum, cat) => sum + cat.liters, 0), 2)}
          </td>
          <td className="py-2 px-3 text-right text-slate-800">
            {formatCurrency(data.reduce((sum, cat) => sum + cat.amount, 0))}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
);

// Production by Category Table
export const ProductionByCategoryTable = ({ data }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-100">
          <th className="text-left py-2 px-3 text-slate-500 font-medium">Category</th>
          <th className="text-right py-2 px-3 text-slate-500 font-medium">Cases</th>
          <th className="text-right py-2 px-3 text-slate-500 font-medium">Liters</th>
        </tr>
      </thead>
      <tbody>
        {data.map((cat, i) => (
          <tr key={cat.name} className="border-b border-slate-50 hover:bg-slate-50">
            <td className="py-2 px-3 flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="font-medium text-slate-700">{cat.name}</span>
            </td>
            <td className="py-2 px-3 text-right text-slate-600">{formatNumber(cat.qty)}</td>
            <td className="py-2 px-3 text-right text-slate-600">{formatNumber(cat.liters, 2)}</td>
          </tr>
        ))}
        <tr className="bg-slate-50 font-semibold">
          <td className="py-2 px-3 text-slate-800">Total</td>
          <td className="py-2 px-3 text-right text-slate-800">
            {formatNumber(data.reduce((sum, cat) => sum + cat.qty, 0))}
          </td>
          <td className="py-2 px-3 text-right text-slate-800">
            {formatNumber(data.reduce((sum, cat) => sum + cat.liters, 0), 2)}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
);

// Sales by Location List
export const SalesByLocationList = ({ data, limit = 15 }) => (
  <div className="space-y-2 max-h-80 overflow-y-auto">
    {data.slice(0, limit).map((loc, i) => (
      <div key={loc.name} className="flex items-center justify-between py-2 border-b border-slate-50">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
            {i + 1}
          </span>
          <span className="text-sm font-medium text-slate-700">{loc.name}</span>
        </div>
        <span className="text-sm text-slate-600">{formatCurrency(loc.amount)}</span>
      </div>
    ))}
    {data.length > limit && (
      <p className="text-xs text-slate-400 text-center pt-2">
        + {data.length - limit} more locations
      </p>
    )}
  </div>
);

// Sales by Type List with color indicators
export const SalesByTypeList = ({ data }) => (
  <div className="space-y-2">
    {data.map((type, i) => (
      <div key={type.name} className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: COLORS[i % COLORS.length] }}
          />
          <span className="text-sm text-slate-700">{type.name}</span>
        </div>
        <span className="text-sm font-medium text-slate-600">{formatCurrency(type.amount)}</span>
      </div>
    ))}
  </div>
);

// MoM Data Table
export const MoMDataTable = ({ data }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-100">
          <th className="text-left py-2 px-3 text-slate-500 font-medium">Month</th>
          <th className="text-right py-2 px-3 text-slate-500 font-medium">Total Qty</th>
          <th className="text-right py-2 px-3 text-slate-500 font-medium">Total Amount</th>
          <th className="text-right py-2 px-3 text-slate-500 font-medium">MoM Change</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => {
          const prevAmount = i > 0 ? data[i - 1].totalAmount : null;
          const momChange = prevAmount ? ((row.totalAmount - prevAmount) / prevAmount) * 100 : null;
          
          return (
            <tr key={row.month} className="border-b border-slate-50 hover:bg-slate-50">
              <td className="py-2 px-3 font-medium text-slate-700">{row.month}</td>
              <td className="py-2 px-3 text-right text-slate-600">{formatNumber(row.totalQty)}</td>
              <td className="py-2 px-3 text-right text-slate-600">{formatCurrency(row.totalAmount)}</td>
              <td className={`py-2 px-3 text-right font-medium ${
                momChange === null ? 'text-slate-400' :
                momChange >= 0 ? 'text-emerald-600' : 'text-red-500'
              }`}>
                {momChange === null ? '-' : `${momChange >= 0 ? '+' : ''}${momChange.toFixed(1)}%`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);
