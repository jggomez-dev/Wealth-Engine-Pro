import React from 'react';
import { SimulationParams, Asset, AssetType } from '../types';
import { Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface SidebarProps {
  params: SimulationParams;
  setParams: (params: SimulationParams) => void;
  assets: Asset[];
  onUpdateAsset: (id: string, updates: Partial<Asset>) => void;
  onClose?: () => void;
}

export default function Sidebar({ params, setParams, assets, onUpdateAsset, onClose }: SidebarProps) {
  const { t } = useLanguage();
  const handleChange = (key: keyof SimulationParams, value: number) => {
    setParams({ ...params, [key]: value });
  };

  const assetTypes: AssetType[] = ['Domestic Stock', 'International Stock', 'Cash', 'Private', 'Real Estate', 'Bonds', 'Crypto', 'Gold'];

  const toggleCategory = (type: AssetType, enabled: boolean) => {
    assets.forEach(asset => {
      if (asset.type === type) {
        onUpdateAsset(asset.id, { isEnabled: enabled });
      }
    });
  };

  return (
    <aside className="w-80 lg:w-64 xl:w-80 h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 lg:bg-slate-50/50 lg:dark:bg-slate-950/50 p-6 flex flex-col gap-8 overflow-y-auto shadow-2xl lg:shadow-none">
      <div className="flex justify-between items-center lg:hidden">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {t('economicControls')}
        </h2>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <EyeOff className="w-5 h-5 text-slate-400 dark:text-slate-500" />
        </button>
      </div>

      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-6 hidden lg:block">
          {t('economicControls')}
        </h2>
        
        <div className="space-y-8">
          <ControlGroup
            label={t('monthlyExpenses')}
            value={params.monthlySpend}
            min={2000}
            max={15000}
            step={100}
            unit="$"
            onChange={(v) => handleChange('monthlySpend', v)}
          />

          <ControlGroup
            label={t('monthlySavings')}
            value={params.monthlySavings}
            min={0}
            max={10000}
            step={100}
            unit="$"
            onChange={(v) => handleChange('monthlySavings', v)}
          />
          
          <ControlGroup
            label={t('yearsToRetirement')}
            value={params.retirementYears}
            min={5}
            max={40}
            step={1}
            unit={t('years')}
            onChange={(v) => handleChange('retirementYears', v)}
          />
          
          <ControlGroup
            label={t('expectedReturn')}
            value={params.expectedReturn * 100}
            min={1}
            max={15}
            step={0.5}
            unit="%"
            onChange={(v) => handleChange('expectedReturn', v / 100)}
          />

          <ControlGroup
            label={t('realEstateReturn')}
            value={params.realEstateReturn * 100}
            min={0}
            max={10}
            step={0.1}
            unit="%"
            onChange={(v) => handleChange('realEstateReturn', v / 100)}
          />

          <ControlGroup
            label={t('withdrawalRate')}
            value={params.withdrawalRate * 100}
            min={1}
            max={10}
            step={0.1}
            unit="%"
            onChange={(v) => handleChange('withdrawalRate', v / 100)}
          />

          <ControlGroup
            label={t('inflationRate')}
            value={params.inflationRate * 100}
            min={0}
            max={10}
            step={0.1}
            unit="%"
            onChange={(v) => handleChange('inflationRate', v / 100)}
          />

          <ControlGroup
            label={t('effectiveTaxRate')}
            value={params.taxRate * 100}
            min={0}
            max={50}
            step={1}
            unit="%"
            onChange={(v) => handleChange('taxRate', v / 100)}
          />

          <ControlGroup
            label={t('marketCrashSim')}
            value={params.marketCrash * 100}
            min={0}
            max={50}
            step={1}
            unit="%"
            onChange={(v) => handleChange('marketCrash', v / 100)}
          />
          <p className="text-[10px] text-slate-400 italic">{t('marketCrashDesc')}</p>

          <ControlGroup
            label={t('careerAdjustment')}
            value={params.careerAdjustment * 100}
            min={-50}
            max={50}
            step={1}
            unit="%"
            onChange={(v) => handleChange('careerAdjustment', v / 100)}
          />
          <p className="text-[10px] text-slate-400 italic">{t('careerAdjustmentDesc')}</p>

          <ControlGroup
            label={t('rebalanceThreshold')}
            value={params.rebalanceThreshold}
            min={1}
            max={20}
            step={0.5}
            unit="%"
            onChange={(v) => handleChange('rebalanceThreshold', v)}
          />

          <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">
              {t('categoryExclusion')}
            </h3>
            <div className="space-y-2">
              {assetTypes.map(type => {
                const typeAssets = assets.filter(a => a.type === type);
                const allEnabled = typeAssets.every(a => a.isEnabled);
                const someEnabled = typeAssets.some(a => a.isEnabled);
                
                const typeLabel = type === 'Domestic Stock' ? t('domesticStock') :
                                 type === 'International Stock' ? t('internationalStock') :
                                 type === 'Cash' ? t('cash') :
                                 type === 'Private' ? t('private') :
                                 type === 'Real Estate' ? t('realEstate') : type;

                return (
                  <button
                    key={type}
                    onClick={() => toggleCategory(type, !allEnabled)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      allEnabled 
                        ? 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm border border-slate-200 dark:border-slate-700' 
                        : someEnabled
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-transparent'
                    }`}
                  >
                    <span>{typeLabel}</span>
                    {allEnabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800">
        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
          {t('appName')} Pro v2.0<br />
          {t('appSubtitle')}
        </p>
      </div>
    </aside>
  );
}

interface ControlGroupProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}

function ControlGroup({ label, value = 0, min, max, step, unit, onChange }: ControlGroupProps) {
  const displayValue = value ?? 0;
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
        <span className="text-sm font-mono font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">
          {unit === '$' ? `$${displayValue.toLocaleString()}` : `${unit === '%' ? displayValue.toFixed(1).replace(/\.0$/, '') : displayValue}${unit}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={displayValue}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-500"
      />
      <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-600 font-mono">
        <span>{unit === '$' ? `$${min/1000}k` : `${min}${unit}`}</span>
        <span>{unit === '$' ? `$${max/1000}k` : `${max}${unit}`}</span>
      </div>
    </div>
  );
}
