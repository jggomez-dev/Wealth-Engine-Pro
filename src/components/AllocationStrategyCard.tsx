import React from 'react';
import { formatCurrency } from '../lib/utils';
import { Target } from 'lucide-react';

interface Props {
  totalWealth: number;
  aggressiveness: number;
  setAggressiveness: (val: number) => void;
  currency: 'USD' | 'EUR';
}

export default function AllocationStrategyCard({ totalWealth, aggressiveness, setAggressiveness, currency }: Props) {
  const profiles = [
    { name: 'Conservative', stocks: 0.4, re: 0.4, cash: 0.2 },
    { name: 'Moderate', stocks: 0.6, re: 0.3, cash: 0.1 },
    { name: 'Aggressive', stocks: 0.8, re: 0.15, cash: 0.05 },
    { name: 'Super Aggressive', stocks: 0.95, re: 0.05, cash: 0 },
  ];

  const currentProfile = profiles[aggressiveness];

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
      <div className="flex items-center gap-2 mb-6">
        <Target className="w-5 h-5 text-indigo-600" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Target Allocation</h3>
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <label className="text-sm font-medium text-slate-700">Risk Profile</label>
          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-md">
            {currentProfile.name}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={3}
          step={1}
          value={aggressiveness}
          onChange={(e) => setAggressiveness(parseInt(e.target.value))}
          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
        <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-2">
          <span>Conservative</span>
          <span>Moderate</span>
          <span>Aggressive</span>
          <span>Super</span>
        </div>
      </div>

      <div className="space-y-4 flex-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Recommended Amounts</h4>
        
        <AllocationRow label="Stocks" percentage={currentProfile.stocks} amount={totalWealth * currentProfile.stocks} currency={currency} color="bg-indigo-500" />
        <AllocationRow label="Real Estate" percentage={currentProfile.re} amount={totalWealth * currentProfile.re} currency={currency} color="bg-emerald-500" />
        <AllocationRow label="Cash / Bonds" percentage={currentProfile.cash} amount={totalWealth * currentProfile.cash} currency={currency} color="bg-amber-500" />
      </div>
    </div>
  );
}

function AllocationRow({ label, percentage, amount, currency, color }: { label: string, percentage: number, amount: number, currency: 'USD' | 'EUR', color: string }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-slate-700">{label}</span>
          <span className="text-[10px] font-bold text-slate-400">{(percentage * 100).toFixed(0)}% TARGET</span>
        </div>
      </div>
      <span className="text-sm font-mono font-bold text-slate-800">
        {formatCurrency(amount, currency)}
      </span>
    </div>
  );
}
