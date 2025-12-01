import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { formatNumber, formatCurrency, formatCompact } from '../utils/formatters';

export const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// Sales by Category Bar Chart
export const SalesByCategoryChart = ({ data }) => {
  // Map 'category' to 'name' for chart compatibility
  const chartData = data?.map(item => ({
    ...item,
    name: item.category || item.name
  })) || [];
  
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" tickFormatter={(v) => formatCompact(v)} />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(v, name) => [formatNumber(v), name === 'qty' ? 'Cases' : name]}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
          />
          <Bar dataKey="qty" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Cases" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Production by Category Pie Chart
export const ProductionByCategoryChart = ({ data }) => {
  // Map 'category' to 'name' for chart compatibility and filter out Grand Total
  const chartData = data?.filter(item => item.category !== 'Grand Total')
    .map(item => ({
      ...item,
      name: item.category || item.name
    })) || [];
  
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="qty"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => formatNumber(v)}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// Month-over-Month Trend Chart
export const MoMTrendChart = ({ data }) => (
  <div className="h-80">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" />
        <YAxis yAxisId="left" tickFormatter={(v) => formatCompact(v)} />
        <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `$${formatCompact(v)}`} />
        <Tooltip
          formatter={(v, name) => [
            name === 'totalAmount' ? formatCurrency(v) : formatNumber(v),
            name === 'totalAmount' ? 'Amount' : 'Quantity'
          ]}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="totalQty"
          name="Total Qty"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 4 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="totalAmount"
          name="Total Amount"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

// Year-over-Year Comparison Chart
export const YoYComparisonChart = ({ data }) => {
  // Handle both object format {qty: [], amount: []} and direct array format
  const chartData = Array.isArray(data) ? data : (data?.qty || []);
  
  if (!chartData || chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400">
        No data available
      </div>
    );
  }
  
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="category"
            tick={{ fontSize: 11 }}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={60}
          />
          <YAxis tickFormatter={(v) => formatCompact(v)} />
          <Tooltip
            formatter={(v) => formatNumber(v)}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
          />
          <Legend />
          <Bar dataKey="y2024" name="2024" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          <Bar dataKey="y2025" name="2025" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Sales by Type Donut Chart
export const SalesByTypeChart = ({ data }) => (
  <div className="h-48">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="amount"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={70}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => formatCurrency(v)}
          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
        />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

// Sales by Salesperson Progress Bars
export const SalesBySalespersonChart = ({ data }) => {
  const maxAmount = Math.max(...data.map(p => p.amount));
  
  return (
    <div className="space-y-3">
      {data.map((person, i) => {
        const percent = (person.amount / maxAmount) * 100;
        return (
          <div key={person.name}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-slate-700">{person.name}</span>
              <span className="text-slate-500">{formatCurrency(person.amount)}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${percent}%`, backgroundColor: COLORS[i % COLORS.length] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
