import React from 'react';
import { formatCurrency } from '../lib/utils';
import { Target } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface AggressivenessCardProps {
  aggressiveness: number;
  onChange: (value: number) => void;
  totalWealth: number;
  currency: 'USD' | 'EUR';
}

export default function AggressivenessCard({ aggressiveness, onChange, totalWealth, currency }: AggressivenessCardProps) {
  const { t } = useLanguage();

  const ALLOCATIONS = [
    { name: t('conservative'), stocks: 0.4, re: 0.4, cash: 0.2, desc: t('conservativeDesc') },
    { name: t('moderate'), stocks: 0.6, re: 0.3, cash: 0.1, desc: t('moderateDesc') },
    { name: t('aggressive'), stocks: 0.8, re: 0.15, cash: 0.05, desc: t('aggressiveDesc') },
    { name: t('superAggressive'), stocks: 0.95, re: 0.05, cash: 0, desc: t('superAggressiveDesc') },
  ];

  const currentProfile = ALLOCATIONS[aggressiveness];

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center gap-2 text-indigo-600 mb-2">
        <Target className="w-5 h-5" />
        <h3 className="text-sm font-bold uppercase tracking-wider">{t('targetAllocationAdvice')}</h3>
      </div>

      <div className="space-y-4">
        <input
          type="range"
          min={0}
          max={3}
          step={1}
          value={aggressiveness}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
        <div className="flex justify-between text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
          <span className={aggressiveness === 0 ? 'text-indigo-600' : ''}>{t('conservative')}</span>
          <span className={aggressiveness === 1 ? 'text-indigo-600' : ''}>{t('moderate')}</span>
          <span className={aggressiveness === 2 ? 'text-indigo-600' : ''}>{t('aggressive')}</span>
          <span className={aggressiveness === 3 ? 'text-indigo-600' : ''}>{t('super')}</span>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100">
        <h4 className="text-lg font-bold text-slate-800 mb-1">{currentProfile.name} {t('profile')}</h4>
        <p className="text-sm text-slate-500 mb-6">{currentProfile.desc}</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('stocks')} ({(currentProfile.stocks * 100).toFixed(0)}%)</div>
            <div className="text-xl font-mono font-bold text-slate-700">{formatCurrency(totalWealth * currentProfile.stocks, currency)}</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('realEstate')} ({(currentProfile.re * 100).toFixed(0)}%)</div>
            <div className="text-xl font-mono font-bold text-slate-700">{formatCurrency(totalWealth * currentProfile.re, currency)}</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('cash')} ({(currentProfile.cash * 100).toFixed(0)}%)</div>
            <div className="text-xl font-mono font-bold text-slate-700">{formatCurrency(totalWealth * currentProfile.cash, currency)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
