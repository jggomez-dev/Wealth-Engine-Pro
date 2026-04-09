import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Asset } from '../types';
import { formatCompactCurrency, formatCurrency } from '../lib/utils';
import { useLanguage } from '../lib/LanguageContext';

interface PortfolioChartProps {
  assets: Asset[];
}

// Distinctive, high-contrast colors for better readability
const COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#ec4899', // Pink
];

export default function PortfolioChart({ assets }: PortfolioChartProps) {
  const { t } = useLanguage();
  const data = React.useMemo(() => {
    const groups: Record<string, number> = {};
    assets.forEach((asset) => {
      const typeLabel = asset.type === 'Domestic Stock' ? t('domesticStock') :
                       asset.type === 'International Stock' ? t('internationalStock') :
                       asset.type === 'Cash' ? t('cash') :
                       asset.type === 'Private' ? t('private') :
                       asset.type === 'Real Estate' ? t('realEstate') : asset.type;
      groups[typeLabel] = (groups[typeLabel] || 0) + asset.total;
    });
    const total = Object.values(groups).reduce((sum, v) => sum + v, 0);
    return Object.entries(groups)
      .map(([name, value]) => ({ 
        name, 
        value,
        percentage: total > 0 ? (value / total) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);
  }, [assets, t]);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col min-h-[400px] lg:min-h-[450px]">
      <div className="mb-6 shrink-0">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          {t('portfolioAllocation')}
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          {t('portfolioAllocationSubtitle')}
        </p>
      </div>

      <div className="flex-1 flex flex-col gap-6">
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={75}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number, name: string, props: any) => {
                  const percentage = props?.payload?.percentage ?? 0;
                  return [
                    `${formatCurrency(value)} (${percentage.toFixed(1)}%)`, 
                    name
                  ];
                }}
                contentStyle={{ 
                  borderRadius: '12px', 
                  border: 'none', 
                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                  padding: '12px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
          {data.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div 
                  className="w-3 h-3 rounded-full shrink-0" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">
                    {item.name}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">
                    {item.percentage.toFixed(1)}% {t('ofPortfolio')}
                  </span>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-slate-600">
                {formatCompactCurrency(item.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
