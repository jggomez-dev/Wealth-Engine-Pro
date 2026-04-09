import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ComposedChart,
} from 'recharts';
import { SimulationPath } from '../types';
import { formatCompactCurrency } from '../lib/utils';
import { useLanguage } from '../lib/LanguageContext';

interface ProjectionChartProps {
  paths: SimulationPath[];
  percentiles: {
    p10: { year: number; value: number }[];
    p50: { year: number; value: number }[];
    p90: { year: number; value: number }[];
  };
}

export default function ProjectionChart({ paths, percentiles }: ProjectionChartProps) {
  const { t } = useLanguage();
  const chartData = percentiles.p50.map((p, i) => ({
    year: p.year,
    median: p.value,
    low: percentiles.p10[i].value,
    high: percentiles.p90[i].value,
  }));

  return (
    <div className="h-[350px] md:h-[450px] w-full bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
      <div className="mb-6 flex justify-between items-start shrink-0">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            {t('wealthProjection')}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {t('wealthProjectionSubtitle')}
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-indigo-600 rounded-sm"></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">{t('median')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-indigo-100 rounded-sm"></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">{t('range80')}</span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="year" 
              stroke="#94a3b8" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
            />
            <YAxis 
              stroke="#94a3b8" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              tickFormatter={(v) => formatCompactCurrency(v)}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
              formatter={(value: number, name: string) => {
                const labelMap: Record<string, string> = {
                  high: 'Top 10%',
                  median: t('median'),
                  low: 'Bottom 10%'
                };
                return [formatCompactCurrency(value), labelMap[name] || name];
              }}
            />
            <Area
              type="monotone"
              dataKey="high"
              stroke="none"
              fill="#6366f1"
              fillOpacity={0.05}
              isAnimationActive={false}
              name="high"
              tooltipType="none"
            />
            <Area
              type="monotone"
              dataKey="low"
              stroke="none"
              fill="#fff"
              fillOpacity={1}
              isAnimationActive={false}
              name="low"
              tooltipType="none"
            />
            <Line
              type="monotone"
              dataKey="high"
              stroke="#6366f1"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              name="high"
            />
            <Line
              type="monotone"
              dataKey="median"
              stroke="#6366f1"
              strokeWidth={3}
              dot={false}
              name="median"
            />
            <Line
              type="monotone"
              dataKey="low"
              stroke="#6366f1"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              name="low"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
