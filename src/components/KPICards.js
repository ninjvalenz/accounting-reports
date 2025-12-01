import React from 'react';
import { Package, DollarSign, TrendingUp, TrendingDown, Droplets } from 'lucide-react';
import { formatNumber, formatCurrency } from '../utils/formatters';

const VarianceIndicator = ({ value }) => {
  if (value === null || value === undefined) return null;
  const isPositive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
      {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
      {formatNumber(Math.abs(value))}
    </span>
  );
};

const KPICard = ({ title, value, budget, variance, icon: Icon, iconColor, formatter = formatNumber }) => (
  <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
    <div className="flex items-center justify-between mb-3">
      <span className="text-slate-500 text-sm">{title}</span>
      <Icon size={20} className={iconColor} />
    </div>
    <p className="text-2xl font-bold text-slate-800">{formatter(value)}</p>
    <div className="flex items-center justify-between mt-2">
      {budget !== undefined && (
        <span className="text-xs text-slate-400">Budget: {formatter(budget)}</span>
      )}
      {variance !== undefined && <VarianceIndicator value={variance} />}
    </div>
  </div>
);

const KPICards = ({ summary }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <KPICard
        title="Sales Cases"
        value={summary.salesCases.actual}
        budget={summary.salesCases.budget}
        variance={summary.salesCases.variance}
        icon={Package}
        iconColor="text-blue-500"
      />
      <KPICard
        title="Sales Amount"
        value={summary.salesAmount.actual}
        budget={summary.salesAmount.budget}
        variance={summary.salesAmount.variance}
        icon={DollarSign}
        iconColor="text-emerald-500"
        formatter={formatCurrency}
      />
      <KPICard
        title="Production Cases"
        value={summary.productionCases.actual}
        budget={summary.productionCases.budget}
        variance={summary.productionCases.variance}
        icon={Package}
        iconColor="text-amber-500"
      />
      <KPICard
        title="Daily Case Avg"
        value={summary.dailyCaseAvg.actual}
        budget={summary.dailyCaseAvg.budget}
        icon={TrendingUp}
        iconColor="text-purple-500"
        formatter={(v) => formatNumber(v, 1)}
      />
      <KPICard
        title="Production Liters"
        value={summary.productionLiters}
        icon={Droplets}
        iconColor="text-cyan-500"
        formatter={(v) => formatNumber(v, 2)}
      />
    </div>
  );
};

export default KPICards;
