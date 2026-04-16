import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Asset } from '../types';
import { formatCompactCurrency, formatFullCurrency } from '../lib/utils';
import { ShieldCheck } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface TaxBreakdownChartProps {
  assets: Asset[];
  currency?: 'USD' | 'EUR';
}

const COLORS = {
  'Pre-Tax': '#6366f1',
  'Post-Tax': '#10b981',
  'Locked': '#f59e0b',
  'Roth': '#10b981', // Roth is visually post-tax but handled specially in logic
};

export default function TaxBreakdownChart({ assets, currency = 'USD' }: TaxBreakdownChartProps) {
  const { t } = useLanguage();
  const summary = React.useMemo(() => {
    const groups: Record<string, number> = {
      'Pre-Tax': 0,
      'Post-Tax': 0,
      'Locked': 0,
    };
    
    assets.forEach((asset) => {
      if (!asset.isEnabled) return;
      
      if (asset.taxStatus === 'Roth') {
        const basis = asset.basis || 0;
        const earnings = Math.max(0, asset.total - basis);
        groups['Post-Tax'] += basis;
        groups['Locked'] += earnings;
      } else if (groups.hasOwnProperty(asset.taxStatus)) {
        groups[asset.taxStatus as keyof typeof groups] += asset.total;
      }
    });

    const total = Object.values(groups).reduce((sum, v) => sum + v, 0);
    const chartData = Object.entries(groups).map(([id, value]) => ({ 
      id,
      name: id === 'Pre-Tax' ? t('preTax') : id === 'Post-Tax' ? t('postTax') : t('locked'), 
      value,
      percentage: total > 0 ? (value / total) * 100 : 0
    }));

    return { chartData, total };
  }, [assets, t]);

  const { chartData, total } = summary;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-[400px] lg:min-h-[450px]">
      <div className="mb-6 shrink-0">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          {t('taxStrategy')}
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          {t('effectiveWealthSubtitle')}
        </p>
      </div>

      <div className="flex-1 flex flex-col gap-6">
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 60, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                stroke="#94a3b8" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                width={80}
              />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                formatter={(value: number, name: string, props: any) => {
                  const percentage = props?.payload?.percentage ?? 0;
                  return [
                    `${formatFullCurrency(value, currency)} (${percentage.toFixed(1)}%)`, 
                    t('total')
                  ];
                }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', padding: '12px' }}
              />
              <Bar 
                dataKey="value" 
                radius={[0, 4, 4, 0]} 
                barSize={32} 
                label={(props: any) => {
                  const { x, y, width, height, index } = props;
                  const percentage = chartData[index]?.percentage ?? 0;
                  return (
                    <text 
                      x={x + width + 8} 
                      y={y + height / 2} 
                      fill="#64748b" 
                      fontSize={10} 
                      fontWeight="bold" 
                      dominantBaseline="middle"
                    >
                      {percentage.toFixed(0)}%
                    </text>
                  );
                }}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.id as keyof typeof COLORS]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
          {chartData.map((item) => (
            <div key={item.id} className="flex justify-between items-center group">
              <div className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full shrink-0" 
                  style={{ backgroundColor: COLORS[item.id as keyof typeof COLORS] }}
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-tight leading-tight">{item.name}</span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {item.percentage.toFixed(1)}% {t('ofTotal')}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono font-bold text-slate-900 leading-tight">
                  {formatFullCurrency(item.value, currency)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
