import React, { useMemo, useState } from 'react';
import { Asset, SimulationParams, AssetType } from '../types';
import { useLanguage } from '../lib/LanguageContext';
import { formatCurrency, cn } from '../lib/utils';
import { AlertTriangle, CheckCircle2, Info, ArrowRight, TrendingUp, TrendingDown, Plus, X } from 'lucide-react';

interface PortfolioStrategyProps {
  assets: Asset[];
  params: SimulationParams;
  setParams: (params: SimulationParams) => void;
}

const ALL_CATEGORIES: AssetType[] = ['Real Estate', 'Domestic Stock', 'International Stock', 'Crypto', 'Gold', 'Cash', 'Bonds', 'Private'];

export default function PortfolioStrategy({ assets, params, setParams }: PortfolioStrategyProps) {
  const { t } = useLanguage();
  const threshold = params.rebalanceThreshold;
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<AssetType>('Domestic Stock');

  const strategyCategories = useMemo(() => {
    return Object.keys(params.portfolioTargets || {}) as AssetType[];
  }, [params.portfolioTargets]);

  const portfolioData = useMemo(() => {
    // Group by AssetType
    const totalsByType: Record<string, number> = {};
    assets.forEach(asset => {
      totalsByType[asset.type] = (totalsByType[asset.type] || 0) + asset.total;
    });

    // Only include categories that are in the strategy
    const strategyTotalValue = strategyCategories.reduce((sum, type) => sum + (totalsByType[type] || 0), 0);

    return strategyCategories.map(type => {
      const currentTotal = totalsByType[type] || 0;
      const currentAllocation = strategyTotalValue > 0 ? (currentTotal / strategyTotalValue) * 100 : 0;
      const targetAllocation = params.portfolioTargets?.[type] || 0;
      const drift = currentAllocation - targetAllocation;
      const isOutofWhack = Math.abs(drift) > threshold;
      
      const targetValue = strategyTotalValue * (targetAllocation / 100);
      const rebalanceAmount = targetValue - currentTotal;

      return {
        type,
        currentTotal,
        currentAllocation,
        targetAllocation,
        drift,
        isOutofWhack,
        rebalanceAmount
      };
    }).sort((a, b) => b.currentTotal - a.currentTotal);
  }, [assets, threshold, params.portfolioTargets, strategyCategories]);

  const strategyTotalValue = useMemo(() => portfolioData.reduce((sum, a) => sum + a.currentTotal, 0), [portfolioData]);
  const totalTarget = useMemo(() => portfolioData.reduce((sum, a) => sum + a.targetAllocation, 0), [portfolioData]);
  const isTargetValid = Math.abs(totalTarget - 100) < 0.01;

  const outOfWhackCount = useMemo(() => portfolioData.filter(d => d.isOutofWhack && d.targetAllocation > 0).length, [portfolioData]);

  const handleUpdateTarget = (type: string, value: number) => {
    const newTargets = { ...(params.portfolioTargets || {}) };
    newTargets[type] = value;
    setParams({ ...params, portfolioTargets: newTargets });
  };

  const handleRemoveCategory = (type: string) => {
    const newTargets = { ...(params.portfolioTargets || {}) };
    delete newTargets[type];
    setParams({ ...params, portfolioTargets: newTargets });
  };

  const handleAddCategory = () => {
    if (!strategyCategories.includes(selectedCategory)) {
      const newTargets = { ...(params.portfolioTargets || {}) };
      newTargets[selectedCategory] = 0;
      setParams({ ...params, portfolioTargets: newTargets });
    }
    setIsAddingCategory(false);
  };

  const availableCategoriesToAdd = ALL_CATEGORIES.filter(c => !strategyCategories.includes(c));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Alert Banner */}
      {outOfWhackCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-4">
          <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100">
              {t('rebalanceNeeded')}
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              {t('rebalanceNeededDesc').replace('{threshold}', threshold.toString())}
            </p>
          </div>
        </div>
      )}

      {outOfWhackCount === 0 && isTargetValid && strategyTotalValue > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-start gap-4">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
              {t('noRebalanceNeeded')}
            </h3>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
              Your portfolio is currently aligned with your target strategy within the {threshold}% tolerance.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Strategy Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                {t('portfolioStrategy')}
              </h2>
              <p className="text-sm text-slate-500 mt-1">Define your target allocations and monitor drift</p>
            </div>
            <div className={cn(
              "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
              isTargetValid ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
            )}>
              {t('totalTarget')}: {totalTarget.toFixed(1)}%
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Asset Class</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">{t('currentAllocation')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">{t('targetAllocation')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">{t('drift')}</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">{t('rebalanceAction')}</th>
                  <th className="px-6 py-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {portfolioData.map((item) => (
                  <tr key={item.type} className={cn(
                    "group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30",
                    item.isOutofWhack && item.targetAllocation > 0 ? "bg-amber-50/30 dark:bg-amber-900/5" : ""
                  )}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {item.type === 'Domestic Stock' ? t('domesticStock') :
                         item.type === 'International Stock' ? t('internationalStock') :
                         item.type === 'Cash' ? t('cash') :
                         item.type === 'Private' ? t('private') :
                         item.type === 'Real Estate' ? t('realEstate') : item.type}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {item.currentAllocation.toFixed(1)}%
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {formatCurrency(item.currentTotal)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="number"
                          value={item.targetAllocation === 0 ? '' : item.targetAllocation}
                          onChange={(e) => handleUpdateTarget(item.type, e.target.value === '' ? 0 : parseFloat(e.target.value))}
                          className="w-16 px-2 py-1 text-right text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                        <span className="text-sm text-slate-400">%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={cn(
                        "text-sm font-bold flex items-center justify-end gap-1",
                        item.isOutofWhack && item.targetAllocation > 0 ? "text-amber-600" : "text-slate-500"
                      )}>
                        {item.drift > 0 ? '+' : ''}{item.drift.toFixed(1)}%
                        {item.isOutofWhack && item.targetAllocation > 0 && <AlertTriangle className="w-3 h-3" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {item.targetAllocation > 0 && Math.abs(item.rebalanceAmount) > 1 && (
                        <div className={cn(
                          "text-xs font-bold inline-flex items-center gap-1 px-2 py-1 rounded",
                          item.rebalanceAmount > 0 
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                            : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                        )}>
                          {item.rebalanceAmount > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {item.rebalanceAmount > 0 ? t('buy') : t('sell')} {formatCurrency(Math.abs(item.rebalanceAmount))}
                        </div>
                      )}
                      {(!item.targetAllocation || Math.abs(item.rebalanceAmount) <= 1) && (
                        <span className="text-xs text-slate-400 italic">No action</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRemoveCategory(item.type)}
                        className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Remove from strategy"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {availableCategoriesToAdd.length > 0 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
              {isAddingCategory ? (
                <div className="flex items-center gap-3">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as AssetType)}
                    className="flex-1 text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    {availableCategoriesToAdd.map(c => (
                      <option key={c} value={c}>
                        {c === 'Domestic Stock' ? t('domesticStock') :
                         c === 'International Stock' ? t('internationalStock') :
                         c === 'Cash' ? t('cash') :
                         c === 'Private' ? t('private') :
                         c === 'Real Estate' ? t('realEstate') : c}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddCategory}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-widest rounded-lg transition-colors"
                  >
                    {t('confirm')}
                  </button>
                  <button
                    onClick={() => setIsAddingCategory(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setSelectedCategory(availableCategoriesToAdd[0]);
                    setIsAddingCategory(true);
                  }}
                  className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 dark:hover:border-indigo-700 dark:hover:text-indigo-400 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Asset Class
                </button>
              )}
            </div>
          )}
          
          {!isTargetValid && (
            <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border-t border-rose-100 dark:border-rose-800 flex items-center gap-3">
              <Info className="w-4 h-4 text-rose-600" />
              <p className="text-xs font-medium text-rose-700 dark:text-rose-300">{t('mustEqual100')}</p>
            </div>
          )}
        </div>

        {/* Info Card & Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200 dark:shadow-none h-full">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Info className="w-5 h-5" />
              Strategy Guide
            </h3>
            <div className="mt-4 space-y-4 text-indigo-100 text-sm leading-relaxed">
              <p>
                A <strong>Target Allocation</strong> represents your ideal portfolio mix. Over time, market movements cause your actual holdings to "drift" away from these targets.
              </p>
              <p>
                The <strong>Rebalance Threshold</strong> (currently {threshold}%) is your tolerance level. When an asset drifts by more than this amount, it's time to sell winners and buy losers to restore your strategy.
              </p>
              <div className="pt-4 border-t border-indigo-500/50">
                <div className="flex items-center gap-2 font-bold text-white">
                  <ArrowRight className="w-4 h-4" />
                  Pro Tip
                </div>
                <p className="mt-1">
                  Rebalancing forces you to "buy low and sell high" automatically, which is one of the most effective ways to manage risk and improve long-term returns.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 h-full flex flex-col justify-center">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Rebalance Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500">Total Strategy Value</span>
                <span className="text-sm font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(strategyTotalValue)}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500">Assets Out of Range</span>
                <span className={cn(
                  "text-sm font-bold",
                  outOfWhackCount > 0 ? "text-amber-600" : "text-emerald-600"
                )}>{outOfWhackCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Alert Threshold</span>
                <span className="text-sm font-bold text-indigo-600">{threshold}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
