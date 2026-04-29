import React, { useState, useMemo, useEffect } from 'react';
import { Home, DollarSign, TrendingUp, Percent, Calculator, Building, Save, CheckCircle2 } from 'lucide-react';
import { Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, ComposedChart, Line } from 'recharts';
import { useLanguage } from '../lib/LanguageContext';
import { formatCurrency, cn } from '../lib/utils';
import MetricCard from './MetricCard';
import { PropertyConfig } from '../types';

export const DEFAULT_PROPERTY: Omit<PropertyConfig, 'id' | 'name'> = {
  purchaseDate: new Date().toISOString().slice(0, 7),
  purchasePrice: 300000,
  closingCosts: 6000,
  rehabCosts: 10000,
  downPaymentPercent: 20,
  interestRate: 6.5,
  loanTerm: 30,
  extraPrincipalMonthly: 0,
  oneTimePrincipal: 0,
  oneTimePrincipalYear: 1,
  grossRent: 2500,
  otherIncome: 0,
  propertyTaxes: 3600,
  insurance: 1200,
  repairsPercent: 5,
  vacancyPercent: 5,
  capexPercent: 5,
  managementPercent: 8,
  hoa: 0,
  appreciationRate: 3,
  rentGrowthRate: 3,
  expenseGrowthRate: 3,
  currentLoanBalanceOverride: 0,
};

export interface RealEstatePropertyData {
  name: string;
  value: number;
  loanBalance: number;
  mortgagePayment: number;
  interestRate: number;
}

interface RealEstateCalculatorProps {
  properties: PropertyConfig[];
  onUpdateProperty: (id: string, updates: Partial<PropertyConfig>) => void;
  onAddProperty: (property: PropertyConfig) => void;
  onDeleteProperty: (id: string) => void;
  onSaveToLedger?: (propertyId: string, property: RealEstatePropertyData) => void;
}

const InputGroup = ({ label, value, onChange, type = "number", prefix = "", suffix = "", step = "1" }: any) => {
  const [localValue, setLocalValue] = useState<string | number>(value);

  useEffect(() => {
    setLocalValue((prev) => {
      if (type === 'month' || type === 'date' || type === 'text') return value;
      if (prev === '' && value === 0) return '';
      if (prev === '-' && value === 0) return '-';
      if (String(prev).endsWith('.') && Number(prev) === value) return prev;
      if (String(prev).endsWith('.0') && Number(prev) === value) return prev;
      if (Number(prev) === value) return prev;
      return value;
    });
  }, [value, type]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    if (type === 'month' || type === 'date' || type === 'text') {
      onChange(val);
    } else {
      if (val === '' || val === '-') {
        onChange(0);
      } else {
        onChange(parseFloat(val) || 0);
      }
    }
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{prefix}</span>}
        <input
          type={type}
          value={localValue}
          onChange={handleChange}
          step={step}
          className={cn(
            "w-full text-sm p-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all",
            prefix && "pl-7",
            suffix && "pr-8"
          )}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{suffix}</span>}
      </div>
    </div>
  );
};

export default function RealEstateCalculator({ properties, onUpdateProperty, onAddProperty, onDeleteProperty, onSaveToLedger }: RealEstateCalculatorProps) {
  const { t } = useLanguage();
  
  const [activeId, setActiveId] = useState<string>(properties[0]?.id || '1');
  const activeProperty = properties.find(p => p.id === activeId) || properties[0];

  const updateProperty = (field: keyof PropertyConfig, value: any) => {
    onUpdateProperty(activeId, { [field]: value });
  };

  const calculations = useMemo(() => {
    if (!activeProperty) return null;
    const {
      purchaseDate, purchasePrice, closingCosts, rehabCosts, downPaymentPercent, interestRate, loanTerm, extraPrincipalMonthly, oneTimePrincipal, oneTimePrincipalYear,
      grossRent, otherIncome, propertyTaxes, insurance, repairsPercent, vacancyPercent,
      capexPercent, managementPercent, hoa, appreciationRate, rentGrowthRate, expenseGrowthRate, currentLoanBalanceOverride
    } = activeProperty;

    const [pYearStr, pMonthStr] = (purchaseDate || new Date().toISOString().slice(0, 7)).split('-');
    const pYear = parseInt(pYearStr, 10) || new Date().getFullYear();
    const pMonth = parseInt(pMonthStr, 10) || new Date().getMonth() + 1;

    const downPaymentAmount = purchasePrice * (downPaymentPercent / 100);
    const loanAmount = purchasePrice - downPaymentAmount;
    const totalOutOfPocket = downPaymentAmount + closingCosts + rehabCosts;

    // Monthly P&I
    const r = interestRate / 100 / 12;
    const n = loanTerm * 12;
    const monthlyMortgage = n === 0 ? 0 : (r === 0 ? loanAmount / n : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));

    const monthlyIncome = grossRent + otherIncome;
    
    const monthlyTaxes = propertyTaxes / 12;
    const monthlyInsurance = insurance / 12;
    const monthlyRepairs = monthlyIncome * (repairsPercent / 100);
    const monthlyVacancy = monthlyIncome * (vacancyPercent / 100);
    const monthlyCapex = monthlyIncome * (capexPercent / 100);
    const monthlyManagement = monthlyIncome * (managementPercent / 100);

    const totalMonthlyExpenses = monthlyTaxes + monthlyInsurance + monthlyRepairs + monthlyVacancy + monthlyCapex + monthlyManagement + hoa;
    
    const monthlyNOI = monthlyIncome - totalMonthlyExpenses;
    const annualNOI = monthlyNOI * 12;
    
    const monthlyCashFlow = monthlyNOI - monthlyMortgage - extraPrincipalMonthly;
    const annualCashFlow = monthlyCashFlow * 12;

    const capRate = purchasePrice > 0 ? (annualNOI / purchasePrice) * 100 : 0;
    const cashOnCash = totalOutOfPocket > 0 ? (annualCashFlow / totalOutOfPocket) * 100 : 0;

    // Month-by-Month Projections
    const projections = [];
    let currentBalance = loanAmount;
    let currentPropertyValue = purchasePrice;
    let currentMonthlyRent = monthlyIncome;
    let currentMonthlyFixedExpenses = (monthlyTaxes + monthlyInsurance + hoa);
    const variableExpensePercent = (repairsPercent + vacancyPercent + capexPercent + managementPercent) / 100;

    // Initial State (Purchase Month)
    projections.push({
      year: `${pMonth}/${pYear}`,
      propertyValue: Math.round(currentPropertyValue),
      loanBalance: Math.round(currentBalance),
      equity: Math.round(currentPropertyValue - currentBalance),
      cashFlow: 0,
    });

    const targetOneTimeMonth = oneTimePrincipalYear * 12;
    let currentCalendarYear = pYear;
    let yearCashFlow = 0;
    const totalMonths = Math.max(30, loanTerm) * 12;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const monthsSincePurchase = (currentYear - pYear) * 12 + (currentMonth - pMonth);

    let currentValForLedger = purchasePrice;
    let currentBalanceForLedger = loanAmount;

    for (let m = 1; m <= totalMonths; m++) {
      let principalPaid = 0;
      let interestPaid = 0;

      if (m === targetOneTimeMonth && oneTimePrincipal > 0) {
        let extra = oneTimePrincipal;
        if (extra > currentBalance) extra = currentBalance;
        currentBalance -= extra;
        principalPaid += extra;
      }

      if (currentBalance > 0) {
        const interest = currentBalance * r;
        let principal = monthlyMortgage - interest + extraPrincipalMonthly;
        if (principal > currentBalance) principal = currentBalance;
        interestPaid += interest;
        principalPaid += principal;
        currentBalance -= principal;
      }
      if (currentBalance < 0) currentBalance = 0;

      const monthlyVariableExpenses = currentMonthlyRent * variableExpensePercent;
      const monthlyExpenses = currentMonthlyFixedExpenses + monthlyVariableExpenses;
      const monthlyCF = currentMonthlyRent - monthlyExpenses - (principalPaid + interestPaid);
      
      yearCashFlow += monthlyCF;

      const currentMonthOfYear = ((pMonth - 1 + m - 1) % 12) + 1;
      
      if (currentMonthOfYear === 12 || m === totalMonths) {
        projections.push({
          year: currentCalendarYear.toString(),
          propertyValue: Math.round(currentPropertyValue),
          loanBalance: Math.round(currentBalance),
          equity: Math.round(currentPropertyValue - currentBalance),
          cashFlow: Math.round(yearCashFlow),
        });
        currentCalendarYear++;
        yearCashFlow = 0;
      }

      // Apply growth on anniversary
      if (m % 12 === 0) {
        currentPropertyValue *= (1 + appreciationRate / 100);
        currentMonthlyRent *= (1 + rentGrowthRate / 100);
        currentMonthlyFixedExpenses *= (1 + expenseGrowthRate / 100);
      }

      if (m === monthsSincePurchase) {
        currentValForLedger = currentPropertyValue;
        currentBalanceForLedger = currentBalance;
      }
    }

    if (monthsSincePurchase > totalMonths) {
      currentValForLedger = currentPropertyValue;
      currentBalanceForLedger = currentBalance;
      // Approximate further appreciation if loan is paid off
      const extraYears = Math.floor((monthsSincePurchase - totalMonths) / 12);
      if (extraYears > 0) {
        currentValForLedger *= Math.pow(1 + appreciationRate / 100, extraYears);
      }
    } else if (monthsSincePurchase <= 0) {
      currentValForLedger = purchasePrice;
      currentBalanceForLedger = loanAmount;
    }

    if (currentLoanBalanceOverride !== undefined && currentLoanBalanceOverride > 0) {
      currentBalanceForLedger = currentLoanBalanceOverride;
    }

    return {
      monthlyCashFlow,
      capRate,
      cashOnCash,
      monthlyNOI,
      totalOutOfPocket,
      totalMonthlyExpenses,
      monthlyMortgage,
      monthlyIncome,
      projections,
      currentValForLedger,
      currentBalanceForLedger
    };
  }, [activeProperty]);

  useEffect(() => {
    if (onSaveToLedger && calculations && activeProperty) {
      onSaveToLedger(activeProperty.id, {
        name: activeProperty.name,
        value: Math.round(calculations.currentValForLedger),
        loanBalance: Math.round(calculations.currentBalanceForLedger),
        mortgagePayment: calculations.monthlyMortgage,
        interestRate: activeProperty.interestRate / 100,
      });
    }
  }, [
    activeProperty?.id,
    activeProperty?.name,
    activeProperty?.interestRate,
    calculations?.currentValForLedger,
    calculations?.currentBalanceForLedger,
    calculations?.monthlyMortgage
  ]);

  if (!activeProperty || !calculations) {
    return (
      <div className="text-center py-12 max-w-6xl mx-auto">
        <button
          onClick={() => {
            const newId = Math.random().toString(36).substr(2, 9);
            onAddProperty({ id: newId, name: `${t('property')} 1`, ...DEFAULT_PROPERTY });
            setActiveId(newId);
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          + {t('addProperty')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Building className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('realEstateTitle')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('realEstateExplanation')}
            </p>
          </div>
        </div>

        {/* Property Selector */}
        <div className="flex flex-wrap items-center gap-2 mb-8 pb-6 border-b border-slate-200 dark:border-slate-800">
          {properties.map(p => (
            <button
              key={p.id}
              onClick={() => setActiveId(p.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeId === p.id
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              )}
            >
              {p.name}
            </button>
          ))}
          <button
            onClick={() => {
              const newId = Math.random().toString(36).substr(2, 9);
              onAddProperty({ id: newId, name: `${t('property')} ${properties.length + 1}`, ...DEFAULT_PROPERTY });
              setActiveId(newId);
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-500 hover:text-indigo-600 dark:hover:border-indigo-400 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"
          >
            + {t('addProperty')}
          </button>
          
          {properties.length > 1 && (
            <button
              onClick={() => {
                onDeleteProperty(activeId);
                const remaining = properties.filter(p => p.id !== activeId);
                if (remaining.length > 0) setActiveId(remaining[0].id);
              }}
              className="ml-auto px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
            >
              {t('deleteProperty')}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Purchase & Loan */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">
              {t('purchaseInfo')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label={t('purchaseDate')} value={activeProperty.purchaseDate} onChange={(v: string) => updateProperty('purchaseDate', v)} type="month" />
              <InputGroup label={t('purchasePrice')} value={activeProperty.purchasePrice} onChange={(v: number) => updateProperty('purchasePrice', v)} prefix="$" step="1000" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label={t('closingCosts')} value={activeProperty.closingCosts} onChange={(v: number) => updateProperty('closingCosts', v)} prefix="$" step="100" />
              <InputGroup label={t('rehabCosts')} value={activeProperty.rehabCosts} onChange={(v: number) => updateProperty('rehabCosts', v)} prefix="$" step="1000" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label={t('downPaymentPercent')} value={activeProperty.downPaymentPercent} onChange={(v: number) => updateProperty('downPaymentPercent', v)} suffix="%" step="0.1" />
              <InputGroup label={t('mortgageInterestRate')} value={activeProperty.interestRate} onChange={(v: number) => updateProperty('interestRate', v)} suffix="%" step="0.125" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label={t('loanTerm')} value={activeProperty.loanTerm} onChange={(v: number) => updateProperty('loanTerm', v)} suffix="yrs" />
              <InputGroup label={t('currentLoanBalanceOpt')} value={activeProperty.currentLoanBalanceOverride || 0} onChange={(v: number) => updateProperty('currentLoanBalanceOverride', v)} prefix="$" step="1000" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label={t('extraPrincipal')} value={activeProperty.extraPrincipalMonthly} onChange={(v: number) => updateProperty('extraPrincipalMonthly', v)} prefix="$" step="50" />
              <InputGroup label={t('oneTimePrincipal')} value={activeProperty.oneTimePrincipal} onChange={(v: number) => updateProperty('oneTimePrincipal', v)} prefix="$" step="1000" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label={t('oneTimePrincipalYear')} value={activeProperty.oneTimePrincipalYear} onChange={(v: number) => updateProperty('oneTimePrincipalYear', v)} step="1" />
            </div>
            <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
              <InputGroup label={t('appreciationRate')} value={activeProperty.appreciationRate} onChange={(v: number) => updateProperty('appreciationRate', v)} suffix="%" step="0.5" />
            </div>
          </div>

          {/* Income */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">
              {t('incomeInfo')}
            </h3>
            <InputGroup label={t('grossRent')} value={activeProperty.grossRent} onChange={(v: number) => updateProperty('grossRent', v)} prefix="$" step="50" />
            <InputGroup label={t('otherIncome')} value={activeProperty.otherIncome} onChange={(v: number) => updateProperty('otherIncome', v)} prefix="$" step="10" />
            
            <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">{t('totalOutOfPocket')}</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">{formatCurrency(calculations.totalOutOfPocket)}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">{t('monthlyMortgage')}</span>
                <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">-{formatCurrency(calculations.monthlyMortgage)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500 dark:text-slate-400">{t('totalMonthlyExpenses')}</span>
                <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">-{formatCurrency(calculations.totalMonthlyExpenses)}</span>
              </div>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
              <InputGroup label={t('rentGrowthRate')} value={activeProperty.rentGrowthRate} onChange={(v: number) => updateProperty('rentGrowthRate', v)} suffix="%" step="0.5" />
            </div>
          </div>

          {/* Expenses */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-2">
              {t('expensesInfo')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label={t('propertyTaxes')} value={activeProperty.propertyTaxes} onChange={(v: number) => updateProperty('propertyTaxes', v)} prefix="$" step="100" />
              <InputGroup label={t('annualInsurance')} value={activeProperty.insurance} onChange={(v: number) => updateProperty('insurance', v)} prefix="$" step="50" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label={t('repairs')} value={activeProperty.repairsPercent} onChange={(v: number) => updateProperty('repairsPercent', v)} suffix="%" step="1" />
              <InputGroup label={t('vacancy')} value={activeProperty.vacancyPercent} onChange={(v: number) => updateProperty('vacancyPercent', v)} suffix="%" step="1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputGroup label={t('capex')} value={activeProperty.capexPercent} onChange={(v: number) => updateProperty('capexPercent', v)} suffix="%" step="1" />
              <InputGroup label={t('management')} value={activeProperty.managementPercent} onChange={(v: number) => updateProperty('managementPercent', v)} suffix="%" step="1" />
            </div>
            <InputGroup label={t('hoa')} value={activeProperty.hoa} onChange={(v: number) => updateProperty('hoa', v)} prefix="$" step="10" />
            <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
              <InputGroup label={t('expenseGrowthRate')} value={activeProperty.expenseGrowthRate} onChange={(v: number) => updateProperty('expenseGrowthRate', v)} suffix="%" step="0.5" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        <MetricCard
          title={t('monthlyCashFlow')}
          value={formatCurrency(calculations.monthlyCashFlow)}
          icon={<DollarSign className={cn("w-5 h-5", calculations.monthlyCashFlow >= 0 ? "text-emerald-500" : "text-rose-500")} />}
          trend={{ value: calculations.monthlyCashFlow >= 0 ? 'Positive Cash Flow' : 'Negative Cash Flow', isPositive: calculations.monthlyCashFlow >= 0 }}
        />
        <MetricCard
          title={t('cashOnCash')}
          value={`${calculations.cashOnCash.toFixed(2)}%`}
          icon={<TrendingUp className={cn("w-5 h-5", calculations.cashOnCash >= 8 ? "text-emerald-500" : "text-amber-500")} />}
          trend={{ value: 'Annual ROI on cash invested', isPositive: calculations.cashOnCash >= 8 }}
          info={t('cashOnCashExplanation')}
        />
        <MetricCard
          title={t('capRate')}
          value={`${calculations.capRate.toFixed(2)}%`}
          icon={<Percent className="w-5 h-5 text-blue-500" />}
          trend={{ value: 'Unleveraged return', isPositive: true }}
          info={t('capRateExplanation')}
        />
        <MetricCard
          title={t('noi')}
          value={formatCurrency(calculations.monthlyNOI)}
          icon={<Calculator className="w-5 h-5 text-purple-500" />}
          trend={{ value: 'Monthly Net Operating Income', isPositive: true }}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">{t('projections')}</h3>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={calculations.projections} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
              <XAxis dataKey="year" stroke="#64748b" fontSize={12} />
              <YAxis yAxisId="left" stroke="#64748b" fontSize={12} tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
              <RechartsTooltip
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                labelFormatter={(label) => `${label}`}
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
              />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="loanBalance" name={t('loanBalance')} stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
              <Area yAxisId="left" type="monotone" dataKey="equity" name={t('propertyEquity')} stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
              <Line yAxisId="right" type="monotone" dataKey="cashFlow" name={t('annualCashFlow')} stroke="#f59e0b" strokeWidth={3} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
