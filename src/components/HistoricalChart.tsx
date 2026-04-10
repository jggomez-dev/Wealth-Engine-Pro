import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { HistoricalNetWorth } from '../types';
import { formatCompactCurrency, formatCurrency } from '../lib/utils';
import { useLanguage } from '../lib/LanguageContext';
import { History, Plus } from 'lucide-react';

interface HistoricalChartProps {
  data: HistoricalNetWorth[];
  currency: 'USD' | 'EUR';
  onRecord: () => void;
}

export default function HistoricalChart({ data, currency, onRecord }: HistoricalChartProps) {
  const { t } = useLanguage();

  // Sort data by date
  const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Format data for chart
  const chartData = sortedData.map(record => ({
    ...record,
    displayDate: new Date(record.date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-xl border border-slate-100">
          <p className="font-bold text-slate-800 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-600 capitalize">{entry.name}:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatCurrency(entry.value, currency)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            {t('historicalNetWorth')}
          </h2>
          <p className="text-sm text-slate-500">{t('historicalNetWorthSubtitle')}</p>
        </div>
        <button
          onClick={onRecord}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          {t('recordNetWorth')}
        </button>
      </div>

      {chartData.length > 0 ? (
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorLiabilities" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="displayDate" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                dy={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickFormatter={(value) => formatCompactCurrency(value, currency)}
                dx={-10}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
              
              <Area 
                type="monotone" 
                dataKey="totalAssets" 
                name="Assets"
                stroke="#10b981" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorAssets)" 
              />
              <Area 
                type="monotone" 
                dataKey="totalLiabilities" 
                name="Liabilities"
                stroke="#ef4444" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorLiabilities)" 
              />
              <Area 
                type="monotone" 
                dataKey="netWorth" 
                name="Net Worth"
                stroke="#4f46e5" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorNetWorth)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[300px] w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
          <History className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium text-center max-w-sm">
            No historical data yet. Click "Record Current Net Worth" to start tracking your progress over time.
          </p>
        </div>
      )}
    </div>
  );
}
