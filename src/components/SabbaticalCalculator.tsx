import React, { useState, useMemo } from 'react';
import { Calculator, Info, DollarSign, TrendingUp, AlertCircle, Briefcase } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { Asset, PropertyConfig } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import MetricCard from './MetricCard';

interface SabbaticalCalculatorProps {
  assets: Asset[];
  realEstateProperties: PropertyConfig[];
  expectedReturn: number;
  realEstateReturn: number;
  monthlySpend: number;
}

export default function SabbaticalCalculator({
  assets,
  realEstateProperties,
  expectedReturn,
  realEstateReturn,
  monthlySpend
}: SabbaticalCalculatorProps) {
  const { t } = useLanguage();
  const [durationMonths, setDurationMonths] = useState(12);
  const [strategy, setStrategy] = useState<'returns_only' | 'principal'>('returns_only');

  const { postTaxTotal, unlinkedRealEstateTotal } = useMemo(() => {
    const linkedAssetIds = new Set(realEstateProperties.map(p => p.linkedAssetId).filter(Boolean));

    return assets.reduce(
      (acc, asset) => {
        if (!asset.isEnabled) return acc;
        
        if (asset.type === 'Real Estate') {
          if (!linkedAssetIds.has(asset.id)) {
            acc.unlinkedRealEstateTotal += asset.total;
          }
        } else if (asset.taxStatus === 'Post-Tax') {
          acc.postTaxTotal += asset.total;
        } else if (asset.taxStatus === 'Roth') {
          acc.postTaxTotal += (asset.basis || 0);
        }
        return acc;
      },
      { postTaxTotal: 0, unlinkedRealEstateTotal: 0 }
    );
  }, [assets, realEstateProperties]);

  const monthlyRealEstateIncome = useMemo(() => {
    const propertiesIncome = realEstateProperties.reduce((sum, prop) => {
      const monthlyIncome = prop.grossRent + prop.otherIncome;
      const monthlyTaxes = prop.propertyTaxes / 12;
      const monthlyInsurance = prop.insurance / 12;
      const monthlyRepairs = (monthlyIncome * prop.repairsPercent) / 100;
      const monthlyVacancy = (monthlyIncome * prop.vacancyPercent) / 100;
      const monthlyCapex = (monthlyIncome * prop.capexPercent) / 100;
      const monthlyManagement = (monthlyIncome * prop.managementPercent) / 100;
      const hoa = prop.hoa || 0;
      
      const totalMonthlyExpenses = monthlyTaxes + monthlyInsurance + monthlyRepairs + monthlyVacancy + monthlyCapex + monthlyManagement + hoa;
      const monthlyNOI = monthlyIncome - totalMonthlyExpenses;
      
      const r = prop.interestRate / 100 / 12;
      const n = prop.loanTerm * 12;
      const loanAmount = prop.purchasePrice * (1 - prop.downPaymentPercent / 100);
      const monthlyMortgage = loanAmount > 0 && r > 0 
        ? loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
        : loanAmount > 0 ? loanAmount / n : 0;

      const monthlyCashFlow = monthlyNOI - monthlyMortgage - prop.extraPrincipalMonthly;
      return sum + monthlyCashFlow;
    }, 0);

    const unlinkedIncome = (unlinkedRealEstateTotal * realEstateReturn) / 12;

    return propertiesIncome + unlinkedIncome;
  }, [realEstateProperties, unlinkedRealEstateTotal, realEstateReturn]);

  const monthlyPostTaxIncome = useMemo(() => {
    const monthlyRate = expectedReturn / 12;
    if (strategy === 'returns_only') {
      return postTaxTotal * monthlyRate;
    } else {
      // PMT formula: P * (r / (1 - (1 + r)^-n))
      if (monthlyRate === 0) return postTaxTotal / durationMonths;
      return postTaxTotal * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -durationMonths)));
    }
  }, [postTaxTotal, expectedReturn, strategy, durationMonths]);

  const totalMonthlyBudget = monthlyRealEstateIncome + monthlyPostTaxIncome;
  const surplusShortfall = totalMonthlyBudget - monthlySpend;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('sabbaticalTitle')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('sabbaticalExplanation')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('sabbaticalDuration')}
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="3"
                max="60"
                step="1"
                value={durationMonths}
                onChange={(e) => setDurationMonths(Number(e.target.value))}
                className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <span className="text-lg font-semibold text-slate-900 dark:text-white w-12 text-right">
                {durationMonths}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('drawdownStrategy')}
            </label>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button
                onClick={() => setStrategy('returns_only')}
                className={cn(
                  "flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors",
                  strategy === 'returns_only' 
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" 
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                )}
              >
                {t('returnsOnly')}
              </button>
              <button
                onClick={() => setStrategy('principal')}
                className={cn(
                  "flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors",
                  strategy === 'principal' 
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" 
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                )}
              >
                {t('drawdownPrincipal')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        <MetricCard
          title={t('monthlyBudget')}
          value={formatCurrency(totalMonthlyBudget)}
          icon={<DollarSign className="w-5 h-5 text-emerald-500" />}
          trend={{ value: strategy === 'principal' ? 'Depletes post-tax' : 'Preserves principal', isPositive: strategy === 'returns_only' }}
        />
        <MetricCard
          title={t('postTaxIncome')}
          value={formatCurrency(monthlyPostTaxIncome)}
          icon={<TrendingUp className="w-5 h-5 text-blue-500" />}
          trend={{ value: `${formatCurrency(postTaxTotal)} total`, isPositive: true }}
        />
        <MetricCard
          title={t('realEstateIncome')}
          value={formatCurrency(monthlyRealEstateIncome)}
          icon={<Calculator className="w-5 h-5 text-purple-500" />}
          trend={{ value: `${realEstateProperties.length} properties`, isPositive: true }}
        />
        <MetricCard
          title={t('surplusShortfall')}
          value={formatCurrency(surplusShortfall)}
          icon={<AlertCircle className={cn("w-5 h-5", surplusShortfall >= 0 ? "text-emerald-500" : "text-rose-500")} />}
          trend={{ value: `vs ${formatCurrency(monthlySpend)} spend`, isPositive: surplusShortfall >= 0 }}
        />
      </div>
    </div>
  );
}
