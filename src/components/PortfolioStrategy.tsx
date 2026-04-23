import React, { useMemo, useState } from 'react';
import { Asset, SimulationParams, AssetType } from '../types';
import { useLanguage } from '../lib/LanguageContext';
import { formatCurrency, cn } from '../lib/utils';
import { AlertTriangle, CheckCircle2, Info, ArrowRight, TrendingUp, TrendingDown, Plus, X, BrainCircuit } from 'lucide-react';
import HealthCard from './HealthCard';
import ProjectionChart from './ProjectionChart';
import { MonteCarloResults } from '../utils/finance';

interface PortfolioStrategyProps {
  assets: Asset[];
  params: SimulationParams;
  setParams: (params: SimulationParams) => void;
  portfolioData?: any[];
  strategyTotalValue?: number;
  outOfWhackCount?: number;
  currentMetrics: { mu: number; sigma: number };
  targetMetrics: { mu: number; sigma: number };
  mcResults: MonteCarloResults;
  currency: 'USD' | 'EUR';
}

const ALL_CATEGORIES: AssetType[] = ['Real Estate', 'Domestic Stock', 'International Stock', 'Crypto', 'Gold', 'Cash', 'Bonds', 'Private'];

export default function PortfolioStrategy({ 
  assets, 
  params, 
  setParams,
  portfolioData: propsPortfolioData,
  strategyTotalValue: propsStrategyTotalValue,
  outOfWhackCount: propsOutOfWhackCount,
  currentMetrics,
  targetMetrics,
  mcResults,
  currency
}: PortfolioStrategyProps) {
  const { t } = useLanguage();
  const threshold = params.rebalanceThreshold;
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<AssetType>('Domestic Stock');

  const strategyCategories = useMemo(() => {
    return Object.keys(params.portfolioTargets || {}) as AssetType[];
  }, [params.portfolioTargets]);

  const internalPortfolioData = useMemo(() => {
    if (propsPortfolioData) return propsPortfolioData;
    
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
        targetValue,
        drift,
        isOutofWhack,
        rebalanceAmount
      };
    }).sort((a, b) => b.currentTotal - a.currentTotal);
  }, [assets, threshold, params.portfolioTargets, strategyCategories, propsPortfolioData]);

  const portfolioData = propsPortfolioData || internalPortfolioData;
  const strategyTotalValue = propsStrategyTotalValue ?? portfolioData.reduce((sum, a) => sum + a.currentTotal, 0);
  const totalTarget = useMemo(() => portfolioData.reduce((sum, a) => sum + a.targetAllocation, 0), [portfolioData]);
  const isTargetValid = Math.abs(totalTarget - 100) < 0.01;

  const outOfWhackCount = propsOutOfWhackCount ?? portfolioData.filter(d => d.isOutofWhack && d.targetAllocation > 0).length;

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
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Target Value</th>
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
                      <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                        {formatCurrency(item.targetValue)}
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
                  {t('addAssetClass')}
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

        {/* Strategy Advice & Scenarios */}
        <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 bg-indigo-600 rounded-2xl p-6 lg:p-8 text-white shadow-lg shadow-indigo-100 dark:shadow-none min-h-[220px] flex flex-col justify-center">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                <Info className="w-5 h-5" />
                {t('strategyGuide')}
              </h3>
              <div className="space-y-4 text-indigo-100 text-sm leading-relaxed">
                <p>
                  {t('strategyGuideDesc')}
                </p>
                <p>
                  The <strong>{t('rebalanceThreshold')}</strong> ({threshold}%) regulates how much drift is allowed before triggering an alert.
                </p>
              </div>
            </div>

            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 lg:p-8 flex flex-col justify-center min-h-[220px]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-6 uppercase tracking-widest opacity-60">{t('rebalanceSummary')}</h3>
              <div className="space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-sm text-slate-500">{t('totalStrategyValue')}</span>
                  <span className="text-lg font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(strategyTotalValue, currency)}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-sm text-slate-500">{t('assetsOutOfRange')}</span>
                  <span className={cn(
                    "text-lg font-bold",
                    outOfWhackCount > 0 ? "text-amber-600" : "text-emerald-600"
                  )}>{outOfWhackCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">{t('thresholdTolerance')}</span>
                  <span className="text-lg font-bold text-indigo-600 font-mono">{threshold}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Projection Scenarios */}
          <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl p-6 lg:p-10 border border-slate-200 dark:border-slate-800">
            <div className="mb-8">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-indigo-600" />
                {t('projectionScenarios')}
              </h3>
              <p className="text-sm text-slate-500 mt-1">{t('projectionScenariosDesc')}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Current Allocation Analysis */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('currentAllocation')}</h4>
                  <div className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-500">{t('activeMix')}</div>
                </div>
                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="group relative">
                    <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1 cursor-help">
                      {t('expectedReturn')}
                      <Info className="w-3 h-3" />
                    </span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">{(currentMetrics.mu * 100).toFixed(2)}%</span>
                    <div className="absolute top-full left-0 mt-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {t('expectedReturnInfo')}
                    </div>
                  </div>
                  <div className="group relative">
                    <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1 cursor-help">
                      {t('portfolioVolatility')}
                      <Info className="w-3 h-3" />
                    </span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">{(currentMetrics.sigma * 100).toFixed(2)}%</span>
                    <div className="absolute top-full left-0 mt-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {t('portfolioVolatilityInfo')}
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-3">
                  <div className="flex justify-between text-xs group relative">
                    <span className="text-slate-500 italic flex items-center gap-1 cursor-help border-b border-slate-300 dark:border-slate-600 border-dotted">
                      {t('sharpeRatio')}
                    </span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{((currentMetrics.mu - 0.02) / currentMetrics.sigma).toFixed(2)}</span>
                    <div className="absolute bottom-full left-0 mb-2 w-56 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {t('sharpeRatioInfo')}
                    </div>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 italic">{t('expectedEfficiency')}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{t('baseline')}</span>
                  </div>
                </div>
              </div>

              {/* Target Allocation Analysis */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border-2 border-indigo-100 dark:border-indigo-900/30 ring-4 ring-indigo-50/50 dark:ring-indigo-900/10">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{t('targetAllocation')}</h4>
                  <div className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 rounded text-[10px] font-bold text-indigo-600">{t('strategy')}</div>
                </div>
                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="group relative">
                    <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1 cursor-help">
                      {t('expectedReturn')}
                      <Info className="w-3 h-3" />
                    </span>
                    <span className={cn(
                      "text-2xl font-bold",
                      targetMetrics.mu >= currentMetrics.mu ? "text-emerald-600" : "text-rose-600"
                    )}>
                      {(targetMetrics.mu * 100).toFixed(2)}%
                    </span>
                    <div className="absolute top-full left-0 mt-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {t('expectedReturnInfoTarget')}
                    </div>
                  </div>
                  <div className="group relative">
                    <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1 cursor-help">
                      {t('portfolioVolatility')}
                      <Info className="w-3 h-3" />
                    </span>
                    <span className={cn(
                      "text-2xl font-bold",
                      targetMetrics.sigma <= currentMetrics.sigma ? "text-emerald-600" : "text-amber-600"
                    )}>
                      {(targetMetrics.sigma * 100).toFixed(2)}%
                    </span>
                    <div className="absolute top-full left-0 mt-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {t('portfolioVolatilityInfoTarget')}
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl space-y-3">
                  <div className="flex justify-between text-xs group relative">
                    <span className="text-indigo-600/70 italic flex items-center gap-1 cursor-help border-b border-indigo-300 dark:border-indigo-600 border-dotted">
                      {t('sharpeRatio')}
                    </span>
                    <span className="font-bold text-indigo-900 dark:text-indigo-100">{((targetMetrics.mu - 0.02) / targetMetrics.sigma).toFixed(2)}</span>
                    <div className="absolute bottom-full left-0 mb-2 w-56 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {t('sharpeRatioInfoTarget')}
                    </div>
                  </div>
                  <div className="flex justify-between text-xs group relative">
                    <span className="text-indigo-600/70 italic flex items-center gap-1 cursor-help border-b border-indigo-300 dark:border-indigo-600 border-dotted">
                      {t('efficiencyDelta')}
                    </span>
                    <span className={cn(
                      "font-bold",
                      (targetMetrics.mu/targetMetrics.sigma) > (currentMetrics.mu/currentMetrics.sigma) ? "text-emerald-600" : "text-slate-600"
                    )}>
                      {(((targetMetrics.mu/targetMetrics.sigma) / (currentMetrics.mu/currentMetrics.sigma) - 1) * 100).toFixed(1)}% {((targetMetrics.mu/targetMetrics.sigma) > (currentMetrics.mu/currentMetrics.sigma)) ? t('improvement') : t('change')}
                    </span>
                    <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      {t('efficiencyDeltaInfo')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                <div className="flex gap-4">
                  <Info className="w-6 h-6 text-indigo-600 shrink-0" />
                  <div className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed">
                    <p className="font-bold mb-1 italic text-indigo-700 dark:text-indigo-300">{t('monteCarloImpact')}</p>
                    <span dangerouslySetInnerHTML={{__html: t('monteCarloImpactDesc1')}}></span>
                    <br/>
                    <span dangerouslySetInnerHTML={{__html: t('monteCarloImpactDesc2')}}></span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-3 text-sm uppercase tracking-widest">{t('howToOptimize')}</h4>
                <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
                  <p>
                    <strong>{t('improveSharpe')}</strong> {t('improveSharpeDesc')}
                  </p>
                  <p>
                    <strong>{t('increaseReturn')}</strong> {t('increaseReturnDesc')}
                  </p>
                  <p>
                    <strong>{t('lowerVolatility')}</strong> {t('lowerVolatilityDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Simulation Chart */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{t('monteCarloProjection')}</h3>
              <div className="flex gap-3 w-full md:w-auto">
                <button
                  onClick={() => setParams({ ...params, expectedReturn: currentMetrics.mu, volatility: currentMetrics.sigma })}
                  className="flex-1 md:flex-none px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-600 hover:text-indigo-600 hover:border-indigo-300 transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <TrendingUp className="w-4 h-4" />
                  {t('simulateCurrent')}
                </button>
                <button
                  onClick={() => setParams({ ...params, expectedReturn: targetMetrics.mu, volatility: targetMetrics.sigma })}
                  className="flex-1 md:flex-none px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {t('simulateTarget')}
                </button>
              </div>
            </div>
            <ProjectionChart paths={mcResults.paths} percentiles={mcResults.percentiles} />
          </div>
        </div>
      </div>
    </div>
  );
}
