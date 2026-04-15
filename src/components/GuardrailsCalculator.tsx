import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ShieldAlert, TrendingUp, DollarSign, AlertTriangle, TrendingDown, Minus, Play } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { formatCurrency, formatCompactCurrency } from '../lib/utils';
import MetricCard from './MetricCard';

interface GuardrailsCalculatorProps {
  initialWealth: number;
  expectedReturn: number;
  inflationRate: number;
  currency: 'USD' | 'EUR';
}

type Scenario = 'stress' | 'average' | 'bull';

export default function GuardrailsCalculator({
  initialWealth,
  expectedReturn,
  inflationRate,
  currency
}: GuardrailsCalculatorProps) {
  const { t } = useLanguage();
  
  // Guardrail Parameters
  const [scenario, setScenario] = useState<Scenario>('stress');
  const [initialWithdrawalRate, setInitialWithdrawalRate] = useState(0.04);
  const [upperGuardrail, setUpperGuardrail] = useState(0.20); // e.g. 20% above initial
  const [lowerGuardrail, setLowerGuardrail] = useState(0.20); // e.g. 20% below initial
  const [spendingAdjustment, setSpendingAdjustment] = useState(0.10); // e.g. 10% cut/raise
  const [years, setYears] = useState(30);

  const simulationData = useMemo(() => {
    let staticPortfolio = initialWealth;
    let dynamicPortfolio = initialWealth;
    
    let staticSpending = initialWealth * initialWithdrawalRate;
    let dynamicSpending = initialWealth * initialWithdrawalRate;
    
    const initialTargetRate = initialWithdrawalRate;
    const upperThreshold = initialTargetRate * (1 + upperGuardrail);
    const lowerThreshold = initialTargetRate * (1 - lowerGuardrail);

    const data = [];
    
    const returns = Array.from({ length: years }, (_, i) => {
      if (scenario === 'stress') {
        if (i === 0) return -0.15;
        if (i === 1) return -0.10;
        if (i === 2) return -0.05;
        if (i >= 20 && i <= 22) return 0.20; // Bull market later
      } else if (scenario === 'bull') {
        if (i === 0) return 0.15;
        if (i === 1) return 0.10;
        if (i === 2) return 0.05;
      }
      return expectedReturn;
    });

    let totalStaticSpent = 0;
    let totalDynamicSpent = 0;
    let dynamicCuts = 0;
    let dynamicRaises = 0;

    for (let y = 1; y <= years; y++) {
      if (y > 1) {
        // 1. Adjust proposed spending for inflation
        staticSpending = staticSpending * (1 + inflationRate);
        dynamicSpending = dynamicSpending * (1 + inflationRate);

        // 2. Apply Guardrails to Dynamic Strategy
        if (dynamicPortfolio > 0) {
          const currentRate = dynamicSpending / dynamicPortfolio;
          
          if (currentRate > upperThreshold) {
            // Capital Preservation Rule: Cut spending
            dynamicSpending = dynamicSpending * (1 - spendingAdjustment);
            dynamicCuts++;
          } else if (currentRate < lowerThreshold) {
            // Prosperity Rule: Increase spending
            dynamicSpending = dynamicSpending * (1 + spendingAdjustment);
            dynamicRaises++;
          }
        }
      }

      // 3. Calculate actual spending (can't spend more than you have)
      const actualStaticSpending = Math.min(staticPortfolio, staticSpending);
      const actualDynamicSpending = Math.min(dynamicPortfolio, dynamicSpending);

      // 4. Record data for the year (Start of year portfolio & actual spending)
      data.push({
        year: y,
        staticPortfolio: Math.round(staticPortfolio),
        dynamicPortfolio: Math.round(dynamicPortfolio),
        staticSpending: Math.round(actualStaticSpending),
        dynamicSpending: Math.round(actualDynamicSpending),
        currentWithdrawalRate: dynamicPortfolio > 0 ? (actualDynamicSpending / dynamicPortfolio) * 100 : 0,
      });

      // 5. Subtract spending
      staticPortfolio -= actualStaticSpending;
      dynamicPortfolio -= actualDynamicSpending;

      totalStaticSpent += actualStaticSpending;
      totalDynamicSpent += actualDynamicSpending;

      // 6. Grow portfolio for the next year
      const r = returns[y - 1];
      staticPortfolio = staticPortfolio * (1 + r);
      dynamicPortfolio = dynamicPortfolio * (1 + r);
    }

    return {
      data,
      totalStaticSpent,
      totalDynamicSpent,
      finalStatic: staticPortfolio,
      finalDynamic: dynamicPortfolio,
      dynamicCuts,
      dynamicRaises
    };
  }, [initialWealth, initialWithdrawalRate, upperGuardrail, lowerGuardrail, spendingAdjustment, years, expectedReturn, inflationRate, scenario]);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Dynamic Spending Guardrails
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              See how flexible spending protects your retirement during market crashes.
            </p>
          </div>
        </div>

        {/* Scenario Selector */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg w-fit mb-4">
            <button
              onClick={() => setScenario('stress')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                scenario === 'stress' 
                  ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingDown className="w-4 h-4" />
              Market Crash (Stress Test)
            </button>
            <button
              onClick={() => setScenario('average')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                scenario === 'average' 
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Minus className="w-4 h-4" />
              Average Returns
            </button>
            <button
              onClick={() => setScenario('bull')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                scenario === 'bull' 
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Bull Market
            </button>
          </div>
          
          <div className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
            {scenario === 'stress' && (
              <p><strong>Stress Test:</strong> Simulates a severe "Sequence of Returns Risk" scenario. The market drops significantly in the first three years of retirement (-15%, -10%, -5%), followed by average returns, and a bull market much later. This shows how taking a temporary pay cut early on can save your portfolio from depleting to zero.</p>
            )}
            {scenario === 'average' && (
              <p><strong>Average Returns:</strong> Simulates a steady, predictable market where returns hit your expected average every single year. Notice how the guardrails rarely trigger because there is no extreme volatility.</p>
            )}
            {scenario === 'bull' && (
              <p><strong>Bull Market:</strong> Simulates a fantastic start to retirement (+15%, +10%, +5% in the first three years). This shows how the "Prosperity Rule" allows you to safely give yourself a raise and enjoy your wealth when the market is booming.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Card 1: The Basics */}
          <div className="space-y-6 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">1. Starting Withdrawal Rate</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">What percentage of your portfolio will you spend in Year 1?</p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0.02"
                  max="0.08"
                  step="0.005"
                  value={initialWithdrawalRate}
                  onChange={(e) => setInitialWithdrawalRate(Number(e.target.value))}
                  className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 w-12 text-right">
                  {(initialWithdrawalRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <span className="text-sm text-slate-600 dark:text-slate-400">Year 1 Spending:</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">
                  {formatCurrency(initialWealth * initialWithdrawalRate, currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: The Rules */}
          <div className="space-y-6 p-5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/10">
            <div>
              <h3 className="text-base font-semibold text-amber-900 dark:text-amber-100">2. The Guardrail Rules</h3>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">How much should you adjust your spending if the market moves?</p>
            </div>

            <div className="space-y-5">
              {/* Pay Cut */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Rule 1: The Pay Cut (Preservation)</span>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0.10"
                    max="0.50"
                    step="0.05"
                    value={upperGuardrail}
                    onChange={(e) => setUpperGuardrail(Number(e.target.value))}
                    className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  If market drops and withdrawal rate hits <strong className="text-rose-600">{(initialWithdrawalRate * (1 + upperGuardrail) * 100).toFixed(1)}%</strong>, take a pay cut.
                </p>
              </div>

              {/* Raise */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Rule 2: The Raise (Prosperity)</span>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0.10"
                    max="0.50"
                    step="0.05"
                    value={lowerGuardrail}
                    onChange={(e) => setLowerGuardrail(Number(e.target.value))}
                    className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  If market booms and withdrawal rate drops to <strong className="text-emerald-600">{(initialWithdrawalRate * (1 - lowerGuardrail) * 100).toFixed(1)}%</strong>, get a raise.
                </p>
              </div>

              {/* Adjustment Amount */}
              <div className="pt-3 border-t border-amber-200/50 dark:border-amber-800/50">
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Pay Cut / Raise Amount</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{(spendingAdjustment * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.25"
                  step="0.01"
                  value={spendingAdjustment}
                  onChange={(e) => setSpendingAdjustment(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard
          title="Final Portfolio (Static)"
          value={formatCurrency(simulationData.finalStatic, currency)}
          icon={<DollarSign className="w-5 h-5 text-slate-500" />}
          trend={{ value: simulationData.finalStatic === 0 ? 'Depleted' : 'Survived', isPositive: simulationData.finalStatic > 0 }}
        />
        <MetricCard
          title="Final Portfolio (Dynamic)"
          value={formatCurrency(simulationData.finalDynamic, currency)}
          icon={<ShieldAlert className="w-5 h-5 text-amber-500" />}
          trend={{ value: simulationData.finalDynamic === 0 ? 'Depleted' : 'Survived', isPositive: simulationData.finalDynamic > 0 }}
        />
        <MetricCard
          title="Total Spent (Dynamic)"
          value={formatCurrency(simulationData.totalDynamicSpent, currency)}
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
          trend={{ value: `vs ${formatCompactCurrency(simulationData.totalStaticSpent, currency)} Static`, isPositive: simulationData.totalDynamicSpent > simulationData.totalStaticSpent }}
        />
        <MetricCard
          title="Guardrail Triggers"
          value={`${simulationData.dynamicCuts} Cuts`}
          icon={<AlertTriangle className="w-5 h-5 text-rose-500" />}
          trend={{ value: `${simulationData.dynamicRaises} Raises`, isPositive: true }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6">
            Portfolio Value Over Time
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={simulationData.data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="year" 
                  tickFormatter={(val) => `Year ${val}`}
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickMargin={10}
                />
                <YAxis 
                  tickFormatter={(val) => formatCompactCurrency(val, currency)}
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickMargin={10}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value, currency)}
                  labelFormatter={(label) => `Year ${label}`}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="staticPortfolio" 
                  name="Static 4% Rule" 
                  stroke="#94a3b8" 
                  strokeWidth={2} 
                  dot={false} 
                  strokeDasharray="5 5"
                />
                <Line 
                  type="monotone" 
                  dataKey="dynamicPortfolio" 
                  name="Dynamic Guardrails" 
                  stroke="#f59e0b" 
                  strokeWidth={3} 
                  dot={false} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6">
            Annual Spending Over Time
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={simulationData.data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="year" 
                  tickFormatter={(val) => `Year ${val}`}
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickMargin={10}
                />
                <YAxis 
                  tickFormatter={(val) => formatCompactCurrency(val, currency)}
                  stroke="#94a3b8" 
                  fontSize={12} 
                  tickMargin={10}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value, currency)}
                  labelFormatter={(label) => `Year ${label}`}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Line 
                  type="stepAfter" 
                  dataKey="staticSpending" 
                  name="Static Spending" 
                  stroke="#94a3b8" 
                  strokeWidth={2} 
                  dot={false} 
                  strokeDasharray="5 5"
                />
                <Line 
                  type="stepAfter" 
                  dataKey="dynamicSpending" 
                  name="Dynamic Spending" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  dot={false} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
