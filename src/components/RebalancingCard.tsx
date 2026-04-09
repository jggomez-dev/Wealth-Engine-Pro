import React from 'react';
import { Asset } from '../types';
import { formatCurrency } from '../lib/utils';
import { Scale, Info } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface RebalancingCardProps {
  assets: Asset[];
}

export default function RebalancingCard({ assets }: RebalancingCardProps) {
  const { t } = useLanguage();
  const totalWealth = assets.reduce((sum, a) => sum + a.total, 0);
  
  // Target allocation: 60% Stock, 30% Cash/Private, 10% Real Estate (simplified)
  const categories = assets.reduce((acc, a) => {
    const cat = a.type.includes('Stock') ? 'Equity' : a.type;
    acc[cat] = (acc[cat] || 0) + a.total;
    return acc;
  }, {} as Record<string, number>);

  const currentEquity = (categories['Equity'] || 0) / totalWealth;
  const targetEquity = 0.65; // Economist target
  const diff = (targetEquity - currentEquity) * totalWealth;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
          <Scale className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          {t('rebalancing')}
        </h3>
        <div className="group relative">
          <Info className="w-4 h-4 text-slate-300 cursor-help" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-[10px] text-white rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            {t('rebalancingSubtitle')}
          </div>
        </div>
      </div>
      
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-xs font-bold mb-1">
            <span className="text-slate-500 uppercase">{t('equityExposure')}</span>
            <span className={Math.abs(currentEquity - targetEquity) > 0.1 ? 'text-rose-600' : 'text-emerald-600'}>
              {(currentEquity * 100).toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-600 transition-all duration-500" 
              style={{ width: `${Math.min(currentEquity * 100, 100)}%` }}
            />
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-xs font-medium text-slate-600 leading-relaxed">
            {Math.abs(diff) < 1000 
              ? t('perfectlyBalanced')
              : diff > 0 
                ? t('underweight').replace('{amount}', formatCurrency(diff))
                : t('overweight').replace('{amount}', formatCurrency(Math.abs(diff)))
            }
          </p>
        </div>
      </div>
    </div>
  );
}
