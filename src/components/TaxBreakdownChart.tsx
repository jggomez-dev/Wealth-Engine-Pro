import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Asset } from '../types';
import { formatCompactCurrency } from '../lib/utils';
import { ShieldCheck } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface TaxBreakdownChartProps {
  assets: Asset[];
}

const COLORS = {
  'Pre-Tax': '#6366f1',
  'Post-Tax': '#10b981',
  'Locked': '#f59e0b',
};

export default function TaxBreakdownChart({ assets }: TaxBreakdownChartProps) {
  const { t } = useLanguage();
  const data = React.useMemo(() => {
    const groups: Record<string, number> = {
      [t('preTax')]: 0,
      [t('postTax')]: 0,
      [t('locked')]: 0,
    };
    assets.forEach((asset) => {
      const statusLabel = asset.taxStatus === 'Pre-Tax' ? t('preTax') :
                         asset.taxStatus === 'Post-Tax' ? t('postTax') :
                         asset.taxStatus === 'Locked' ? t('locked') : asset.taxStatus;
      groups[statusLabel] = (groups[statusLabel] || 0) + asset.total;
    });
    const total = Object.values(groups).reduce((sum, v) => sum + v, 0);
    return Object.entries(groups).map(([name, value]) => ({ 
      name, 
      value,
      percentage: total > 0 ? (value / total) * 100 : 0
    }));
  }, [assets, t]);

  return (
    <div className="h-[400px] w-full bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
      <div className="mb-6 flex items-center gap-3 shrink-0">
        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            {t('taxStrategy')}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {t('effectiveWealthSubtitle')}
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 20, right: 60 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              stroke="#94a3b8" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              width={70}
            />
            <Tooltip 
              cursor={{ fill: '#f8fafc' }}
              formatter={(value: number, name: string, props: any) => {
                const percentage = props?.payload?.percentage ?? 0;
                return [
                  `${formatCompactCurrency(value)} (${percentage.toFixed(1)}%)`, 
                  t('total')
                ];
              }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            />
            <Bar 
              dataKey="value" 
              radius={[0, 4, 4, 0]} 
              barSize={40} 
              label={(props: any) => {
                const { x, y, width, height, index } = props;
                const percentage = data[index]?.percentage ?? 0;
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
              {data.map((entry, index) => {
                const colorKey = entry.name === t('preTax') ? 'Pre-Tax' :
                                entry.name === t('postTax') ? 'Post-Tax' :
                                entry.name === t('locked') ? 'Locked' : 'Pre-Tax';
                return (
                  <Cell key={`cell-${index}`} fill={COLORS[colorKey as keyof typeof COLORS]} />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
