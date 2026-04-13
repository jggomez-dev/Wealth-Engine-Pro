import React, { useState, useMemo } from 'react';
import { Calculator, Info, DollarSign, Users, AlertCircle, MapPin } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

// 2026 FPL Guidelines (48 Contiguous States)
const FPL_BASE = 15060;
const FPL_PER_PERSON = 5380;

// US States
const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
];

// Mock state multipliers for benchmark premium (1.0 = national average)
const STATE_MULTIPLIERS: Record<string, number> = {
  'AL': 0.95, 'AK': 1.45, 'AZ': 1.02, 'AR': 0.92, 'CA': 1.10, 'CO': 1.05,
  'CT': 1.15, 'DE': 1.08, 'FL': 1.05, 'GA': 0.98, 'HI': 1.12, 'ID': 0.96,
  'IL': 1.04, 'IN': 0.97, 'IA': 0.94, 'KS': 0.95, 'KY': 0.93, 'LA': 0.99,
  'ME': 1.06, 'MD': 0.82, 'MA': 1.18, 'MI': 0.88, 'MN': 1.03, 'MS': 0.91,
  'MO': 0.98, 'MT': 1.01, 'NE': 0.97, 'NV': 1.04, 'NH': 0.80, 'NJ': 1.08,
  'NM': 0.96, 'NY': 1.20, 'NC': 1.02, 'ND': 0.99, 'OH': 0.85, 'OK': 0.94,
  'OR': 1.07, 'PA': 1.05, 'RI': 1.10, 'SC': 0.98, 'SD': 0.96, 'TN': 0.92,
  'TX': 0.95, 'UT': 0.90, 'VT': 1.14, 'VA': 1.05, 'WA': 1.12, 'WV': 1.25,
  'WI': 1.06, 'WY': 1.35
};

// Simplified Age Curve Multipliers (ACA standard curve approximation)
const getAgeMultiplier = (age: number) => {
  if (age < 21) return 0.765;
  if (age === 21) return 1.0;
  if (age <= 30) return 1.0 + (age - 21) * 0.015;
  if (age <= 40) return 1.135 + (age - 30) * 0.014;
  if (age <= 50) return 1.278 + (age - 40) * 0.05;
  if (age <= 60) return 1.786 + (age - 50) * 0.092;
  if (age <= 64) return 2.714 + (age - 60) * 0.071;
  return 3.0; // 65+ (usually Medicare, but capped at 3.0 for ACA)
};

// National average base premium for a 21-year-old (SLCSP estimate)
const BASE_PREMIUM_21 = 450;

export const HealthcareCalculator: React.FC = () => {
  const { t } = useLanguage();
  const [usState, setUsState] = useState<string>('');
  const [zipCode, setZipCode] = useState<string>('');
  const [income, setIncome] = useState<number | ''>(50000);
  const [adults, setAdults] = useState<{ age: number | '' }[]>([{ age: 21 }]);
  const [children, setChildren] = useState<number | ''>(0);

  const householdSize = adults.length + (typeof children === 'number' ? children : 0);

  const handleAdultCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setAdults([]);
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0 && num <= 10) {
      const newAdults = [...adults];
      while (newAdults.length < num) newAdults.push({ age: 21 });
      while (newAdults.length > num) newAdults.pop();
      setAdults(newAdults);
    }
  };

  const updateAdultAge = (index: number, val: string) => {
    const newAdults = [...adults];
    newAdults[index].age = val === '' ? '' : parseInt(val, 10);
    setAdults(newAdults);
  };

  const results = useMemo(() => {
    const safeIncome = typeof income === 'number' ? income : 0;
    const safeChildren = typeof children === 'number' ? children : 0;
    
    // 1. Calculate FPL
    const fpl = FPL_BASE + (Math.max(1, householdSize) - 1) * FPL_PER_PERSON;
    const fplPercentage = (safeIncome / fpl) * 100;

    // 2. Calculate Expected Contribution Percentage (Inflation Reduction Act rules)
    let contributionPct = 0;
    if (fplPercentage <= 150) {
      contributionPct = 0;
    } else if (fplPercentage <= 200) {
      contributionPct = 0 + ((fplPercentage - 150) / 50) * 0.02;
    } else if (fplPercentage <= 250) {
      contributionPct = 0.02 + ((fplPercentage - 200) / 50) * 0.02;
    } else if (fplPercentage <= 300) {
      contributionPct = 0.04 + ((fplPercentage - 250) / 50) * 0.02;
    } else if (fplPercentage <= 400) {
      contributionPct = 0.06 + ((fplPercentage - 300) / 100) * 0.025;
    } else {
      contributionPct = 0.085;
    }

    // 3. Calculate Expected Monthly Contribution
    const expectedMonthlyContribution = (safeIncome * contributionPct) / 12;

    // 4. Estimate Benchmark Premium (SLCSP)
    const stateMultiplier = STATE_MULTIPLIERS[usState] || 1.0;
    
    // Apply a deterministic zip code adjustment (+/- 10%) if a 5-digit zip is provided
    let zipAdjustment = 1.0;
    if (zipCode.length === 5 && !isNaN(Number(zipCode))) {
      const zipNum = parseInt(zipCode, 10);
      zipAdjustment = 1 + ((zipNum % 21) - 10) / 100; 
    }
    
    const adjustedBasePremium = BASE_PREMIUM_21 * stateMultiplier * zipAdjustment;
    
    let totalBenchmarkPremium = 0;
    adults.forEach(adult => {
      const age = typeof adult.age === 'number' ? adult.age : 21;
      totalBenchmarkPremium += adjustedBasePremium * getAgeMultiplier(age);
    });
    for (let i = 0; i < safeChildren; i++) {
      totalBenchmarkPremium += adjustedBasePremium * getAgeMultiplier(15); // Average child age multiplier
    }

    // 5. Calculate Tax Credit and Net Premium
    const taxCredit = Math.max(0, totalBenchmarkPremium - expectedMonthlyContribution);
    const netPremium = Math.max(0, totalBenchmarkPremium - taxCredit);

    return {
      fpl,
      fplPercentage,
      contributionPct,
      expectedMonthlyContribution,
      totalBenchmarkPremium,
      taxCredit,
      netPremium,
      stateMultiplier,
      zipAdjustment
    };
  }, [income, adults, children, householdSize, usState, zipCode]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('acaEstimator')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('acaEstimatorDesc')}</p>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('state')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="h-4 w-4 text-slate-400" />
                </div>
                <select
                  value={usState}
                  onChange={(e) => setUsState(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                >
                  <option value="">{t('selectState')}</option>
                  {US_STATES.map(s => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('zipCode')}
              </label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="e.g. 90210"
                maxLength={5}
                className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('annualIncome')}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="number"
                value={income}
                onChange={(e) => setIncome(e.target.value === '' ? '' : Number(e.target.value))}
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="50000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('numAdults')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Users className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="number"
                  value={adults.length === 0 ? '' : adults.length}
                  onChange={handleAdultCountChange}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-indigo-500 focus:border-indigo-500"
                  min="0"
                  max="10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('numChildren')}
              </label>
              <input
                type="number"
                value={children}
                onChange={(e) => setChildren(e.target.value === '' ? '' : Number(e.target.value))}
                className="block w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-indigo-500 focus:border-indigo-500"
                min="0"
                max="15"
              />
            </div>
          </div>

          {adults.length > 0 && (
            <div className="pt-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                {t('adultAges')}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {adults.map((adult, index) => (
                  <div key={index} className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-xs font-medium text-slate-400">#{index + 1}</span>
                    </div>
                    <input
                      type="number"
                      value={adult.age}
                      onChange={(e) => updateAdultAge(index, e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Age"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-6">{t('estimatedMonthlyCosts')}</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
              <span className="text-slate-600 dark:text-slate-400">{t('benchmarkPremium')}</span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                ${Math.round(results.totalBenchmarkPremium).toLocaleString()}
              </span>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b border-slate-200 dark:border-slate-700">
              <span className="text-slate-600 dark:text-slate-400">{t('taxCredit')}</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                -${Math.round(results.taxCredit).toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between items-center py-4">
              <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('estimatedPremium')}</span>
              <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                ${Math.round(results.netPremium).toLocaleString()}<span className="text-sm font-normal text-slate-500">/{t('monthly').toLowerCase()}</span>
              </span>
            </div>
          </div>

          <div className="mt-8 space-y-3 bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-500" />
              {t('calcDetails')}
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-slate-500 dark:text-slate-400">{t('householdSize')}</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{householdSize} {t('people')}</span>
              </div>
              <div>
                <span className="block text-slate-500 dark:text-slate-400">{t('incomeVsFpl')}</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{Math.round(results.fplPercentage)}% of FPL</span>
              </div>
              <div>
                <span className="block text-slate-500 dark:text-slate-400">{t('maxIncomeContribution')}</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{(results.contributionPct * 100).toFixed(2)}%</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800/30">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p>
                {t('acaDisclaimer')}
              </p>
              <p className="font-medium">
                {t('planExplanation')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
