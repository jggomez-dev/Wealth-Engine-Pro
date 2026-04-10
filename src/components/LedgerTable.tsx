import React, { useState } from 'react';
import { Asset, AssetType, TaxStatus } from '../types';
import { formatCurrency } from '../lib/utils';
import { cn } from '../lib/utils';
import { Plus, Trash2, X } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface LedgerTableProps {
  assets: Asset[];
  currency: 'USD' | 'EUR';
  onUpdateAsset: (id: string, updates: Partial<Asset>) => void;
  onAddAsset: (asset: Omit<Asset, 'id'>) => void;
  onDeleteAsset: (id: string) => void;
}

export default function LedgerTable({ assets, currency, onUpdateAsset, onAddAsset, onDeleteAsset }: LedgerTableProps) {
  const { t } = useLanguage();
  const [isAdding, setIsAdding] = useState(false);
  const [newAsset, setNewAsset] = useState<Omit<Asset, 'id'>>({
    account: '',
    ticker: '',
    type: 'Domestic Stock',
    taxStatus: 'Post-Tax',
    qty: 0,
    beta: 1.0,
    total: 0,
    isEnabled: true
  });

  const groupedAssets = React.useMemo(() => {
    const groups: Record<string, Asset[]> = {};
    assets.forEach(asset => {
      if (!groups[asset.account]) groups[asset.account] = [];
      groups[asset.account].push(asset);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [assets]);

  const handleAdd = () => {
    if (!newAsset.account || !newAsset.ticker) return;
    onAddAsset(newAsset);
    setIsAdding(false);
    setNewAsset({
      account: '',
      ticker: '',
      type: 'Domestic Stock',
      taxStatus: 'Post-Tax',
      qty: 0,
      beta: 1.0,
      total: 0,
      isEnabled: true
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 lg:p-6 border-b border-slate-100 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            {t('liveLedger')}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide">{t('liveLedgerSubtitle')}</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('addAsset')}
        </button>
      </div>
      
      {isAdding && (
        <div className="p-6 bg-slate-50 border-b border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('account')}</label>
              <input
                type="text"
                placeholder="e.g. Brokerage"
                value={newAsset.account}
                onChange={e => setNewAsset(prev => ({ ...prev, account: e.target.value }))}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('ticker')}</label>
              <input
                type="text"
                placeholder="e.g. VTI"
                value={newAsset.ticker}
                onChange={e => setNewAsset(prev => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('type')}</label>
              <select
                value={newAsset.type}
                onChange={e => setNewAsset(prev => ({ ...prev, type: e.target.value as AssetType }))}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="Domestic Stock">{t('domesticStock')}</option>
                <option value="International Stock">{t('internationalStock')}</option>
                <option value="Cash">{t('cash')}</option>
                <option value="Private">{t('private')}</option>
                <option value="Real Estate">{t('realEstate')}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('taxStatus')}</label>
              <select
                value={newAsset.taxStatus}
                onChange={e => setNewAsset(prev => ({ ...prev, taxStatus: e.target.value as TaxStatus }))}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="Pre-Tax">{t('preTax')}</option>
                <option value="Post-Tax">{t('postTax')}</option>
                <option value="Locked">{t('locked')}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('qty')}/{t('total')}</label>
              <input
                type="number"
                value={newAsset.qty || newAsset.total}
                onChange={e => {
                  const val = parseFloat(e.target.value) || 0;
                  if (newAsset.type === 'Cash' || newAsset.type === 'Real Estate' || newAsset.type === 'Private') {
                    setNewAsset(prev => ({ ...prev, total: val, qty: 0 }));
                  } else {
                    setNewAsset(prev => ({ ...prev, qty: val, total: 0 }));
                  }
                }}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="flex-1 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-widest py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {t('confirm')}
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-y border-slate-100">
              <th className="px-3 lg:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('ticker')}</th>
              <th className="px-3 lg:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('type')}</th>
              <th className="px-3 lg:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('taxStatus')}</th>
              <th className="px-3 lg:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">{t('qty')}</th>
              <th className="px-3 lg:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">{t('price')}</th>
              <th className="px-3 lg:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">{t('total')}</th>
              <th className="px-3 lg:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groupedAssets.map(([account, accountAssets]) => {
              const allEnabled = accountAssets.every(a => a.isEnabled);
              const someEnabled = accountAssets.some(a => a.isEnabled);
              
              return (
                <React.Fragment key={account}>
                  <tr className="bg-slate-50/30">
                    <td colSpan={7} className="px-6 py-2 bg-indigo-50/30">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={allEnabled}
                          ref={el => {
                            if (el) el.indeterminate = someEnabled && !allEnabled;
                          }}
                          onChange={(e) => {
                            accountAssets.forEach(a => onUpdateAsset(a.id, { isEnabled: e.target.checked }));
                          }}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
                          {account}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {accountAssets.sort((a, b) => b.total - a.total).map((asset) => {
                    const typeLabel = asset.type === 'Domestic Stock' ? t('domesticStock') :
                                     asset.type === 'International Stock' ? t('internationalStock') :
                                     asset.type === 'Cash' ? t('cash') :
                                     asset.type === 'Private' ? t('private') :
                                     asset.type === 'Real Estate' ? t('realEstate') : asset.type;

                    return (
                      <tr key={asset.id} className={cn(
                        "hover:bg-slate-50/50 transition-colors group",
                        !asset.isEnabled && "opacity-50 grayscale-[0.5]"
                      )}>
                        <td className="px-3 lg:px-6 py-3 lg:py-4">
                          <div className="flex items-center gap-2 lg:gap-3">
                            <input
                              type="checkbox"
                              checked={asset.isEnabled}
                              onChange={(e) => onUpdateAsset(asset.id, { isEnabled: e.target.checked })}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className="text-[10px] lg:text-xs font-mono font-bold bg-slate-100 text-slate-600 px-1.5 lg:px-2 py-0.5 lg:py-1 rounded">
                              {asset.ticker}
                            </span>
                          </div>
                        </td>
                      <td className="px-3 lg:px-6 py-3 lg:py-4">
                        <span className="text-[9px] lg:text-[10px] font-bold uppercase tracking-wide text-slate-400 border border-slate-200 px-1.5 lg:px-2 py-0.5 rounded-full whitespace-nowrap">
                          {typeLabel}
                        </span>
                      </td>
                      <td className="px-3 lg:px-6 py-3 lg:py-4">
                        <select
                          value={asset.taxStatus}
                          onChange={(e) => onUpdateAsset(asset.id, { taxStatus: e.target.value as any })}
                          className="text-[9px] lg:text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-50 border border-slate-200 px-1.5 lg:px-2 py-0.5 rounded-full outline-none focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
                        >
                          <option value="Pre-Tax">{t('preTax')}</option>
                          <option value="Post-Tax">{t('postTax')}</option>
                          <option value="Locked">{t('locked')}</option>
                        </select>
                      </td>
                      <td className="px-3 lg:px-6 py-3 lg:py-4 text-right">
                        {asset.qty > 0 ? (
                          <input
                            type="number"
                            value={asset.qty}
                            onChange={(e) => onUpdateAsset(asset.id, { qty: parseFloat(e.target.value) || 0 })}
                            className="w-16 lg:w-24 text-xs lg:text-sm font-mono text-slate-600 text-right bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1 py-0.5 outline-none transition-all"
                          />
                        ) : (
                          <span className="text-xs lg:text-sm font-mono text-slate-400 pr-2">—</span>
                        )}
                      </td>
                      <td className="px-3 lg:px-6 py-3 lg:py-4 text-xs lg:text-sm font-mono text-slate-600 text-right">
                        {asset.price ? formatCurrency(asset.price, currency) : '—'}
                      </td>
                      <td className="px-3 lg:px-6 py-3 lg:py-4 text-right">
                        {asset.qty === 0 ? (
                          <input
                            type="number"
                            value={asset.total}
                            onChange={(e) => onUpdateAsset(asset.id, { total: parseFloat(e.target.value) || 0 })}
                            className="w-24 lg:w-32 text-xs lg:text-sm font-mono font-bold text-slate-900 text-right bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1 py-0.5 outline-none transition-all"
                          />
                        ) : (
                          <span className="text-xs lg:text-sm font-mono font-bold text-slate-900 pr-1">
                            {formatCurrency(asset.total, currency)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 lg:px-6 py-3 lg:py-4 text-right">
                        <button
                          onClick={() => onDeleteAsset(asset.id)}
                          className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          title={t('deleteAsset')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                  <tr className="bg-slate-50/10">
                    <td colSpan={5} className="px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">
                      {account} {t('total')}
                    </td>
                    <td className="px-6 py-2 text-right text-xs font-mono font-bold text-slate-600">
                      {formatCurrency(accountAssets.filter(a => a.isEnabled).reduce((sum, a) => sum + a.total, 0), currency)}
                    </td>
                    <td></td>
                  </tr>
              </React.Fragment>
            );
          })}
        </tbody>
        </table>
      </div>
    </div>
  );
}
