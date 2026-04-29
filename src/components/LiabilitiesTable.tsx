import React, { useState } from 'react';
import { Liability, LiabilityType } from '../types';
import { parseVal } from '../utils/finance';
import { formatCurrency } from '../lib/utils';
import { cn } from '../lib/utils';
import { Plus, Trash2, X } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';

interface LiabilitiesTableProps {
  liabilities: Liability[];
  currency: 'USD' | 'EUR';
  onUpdateLiability: (id: string, updates: Partial<Liability>) => void;
  onAddLiability: (liability: Omit<Liability, 'id'>) => void;
  onDeleteLiability: (id: string) => void;
}

export default function LiabilitiesTable({ liabilities, currency, onUpdateLiability, onAddLiability, onDeleteLiability }: LiabilitiesTableProps) {
  const { t } = useLanguage();
  const [isAdding, setIsAdding] = useState(false);
  const [newLiability, setNewLiability] = useState<Omit<Liability, 'id'>>({
    name: '',
    type: 'Mortgage',
    balance: 0,
    interestRate: 0.05,
    minimumPayment: 0
  });

  const handleAdd = () => {
    if (!newLiability.name) return;
    onAddLiability(newLiability);
    setIsAdding(false);
    setNewLiability({
      name: '',
      type: 'Mortgage',
      balance: 0,
      interestRate: 0.05,
      minimumPayment: 0
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mt-6">
      <div className="p-4 lg:p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t('liabilities')}
          </h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1 uppercase tracking-wide">{t('liabilitiesSubtitle')}</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-rose-600 dark:bg-rose-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-rose-700 dark:hover:bg-rose-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('addLiability')}
        </button>
      </div>
      
      {isAdding && (
        <div className="p-6 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
            <div className="space-y-1 lg:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t('name')}</label>
              <input
                type="text"
                placeholder="e.g. Chase Sapphire"
                value={newLiability.name}
                onChange={e => setNewLiability(prev => ({ ...prev, name: e.target.value }))}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t('type')}</label>
              <select
                value={newLiability.type}
                onChange={e => setNewLiability(prev => ({ ...prev, type: e.target.value as LiabilityType }))}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 outline-none"
              >
                <option value="Mortgage">{t('mortgage')}</option>
                <option value="Student Loan">{t('studentLoan')}</option>
                <option value="Credit Card">{t('creditCard')}</option>
                <option value="Auto Loan">{t('autoLoan')}</option>
                <option value="Other">{t('other')}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t('balance')}</label>
              <input
                type="number"
                value={newLiability.balance === 0 ? '' : newLiability.balance}
                onChange={e => setNewLiability(prev => ({ ...prev, balance: e.target.value === '' ? 0 : parseFloat(e.target.value) }))}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t('interestRate')} (%)</label>
              <input
                type="number"
                step="0.1"
                value={newLiability.interestRate === 0 ? '' : Number((newLiability.interestRate * 100).toFixed(1))}
                onChange={e => setNewLiability(prev => ({ ...prev, interestRate: (e.target.value === '' ? 0 : parseFloat(e.target.value)) / 100 }))}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t('minimumPayment')}</label>
              <input
                type="number"
                step="0.1"
                value={newLiability.minimumPayment === 0 ? '' : Number(newLiability.minimumPayment.toFixed(1))}
                onChange={e => setNewLiability(prev => ({ ...prev, minimumPayment: e.target.value === '' ? 0 : parseFloat(e.target.value) }))}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>
            <div className="flex gap-2 lg:col-span-6">
              <button
                onClick={handleAdd}
                className="flex-1 bg-rose-600 dark:bg-rose-500 text-white text-[10px] font-bold uppercase tracking-widest py-2 rounded-lg hover:bg-rose-700 dark:hover:bg-rose-600 transition-colors"
              >
                {t('confirm')}
              </button>
              <button
                onClick={() => setIsAdding(false)}
                className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
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
            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-y border-slate-100 dark:border-slate-800">
              <th className="px-3 lg:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t('name')}</th>
              <th className="px-3 lg:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">{t('type')}</th>
              <th className="px-3 lg:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">{t('interestRate')}</th>
              <th className="px-3 lg:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">{t('minimumPayment')}</th>
              <th className="px-3 lg:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">{t('balance')}</th>
              <th className="px-3 lg:px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {liabilities.sort((a, b) => {
              const valA = parseVal(a.balance);
              const valB = parseVal(b.balance);
              return valB - valA;
            }).map((liability) => {
              const typeLabel = liability.type === 'Mortgage' ? t('mortgage') :
                               liability.type === 'Student Loan' ? t('studentLoan') :
                               liability.type === 'Credit Card' ? t('creditCard') :
                               liability.type === 'Auto Loan' ? t('autoLoan') : t('other');

              return (
                <tr key={liability.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-3 lg:px-6 py-3 lg:py-4">
                    <span className="text-[10px] lg:text-xs font-bold text-slate-700 dark:text-slate-200">
                      {liability.name}
                    </span>
                  </td>
                  <td className="px-3 lg:px-6 py-3 lg:py-4">
                    <span className="text-[9px] lg:text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 px-1.5 lg:px-2 py-0.5 rounded-full whitespace-nowrap">
                      {typeLabel}
                    </span>
                  </td>
                  <td className="px-3 lg:px-6 py-3 lg:py-4 text-right">
                    <input
                      type="number"
                      step="0.1"
                      value={liability.interestRate === 0 ? '' : Number((liability.interestRate * 100).toFixed(1))}
                      onChange={(e) => onUpdateLiability(liability.id, { interestRate: (e.target.value === '' ? 0 : parseFloat(e.target.value)) / 100 })}
                      className="w-16 lg:w-20 text-xs lg:text-sm font-mono text-slate-600 dark:text-slate-300 text-right bg-transparent hover:bg-white dark:hover:bg-slate-700 focus:bg-white dark:focus:bg-slate-700 focus:ring-1 focus:ring-rose-500 rounded px-1 py-0.5 outline-none transition-all"
                    />%
                  </td>
                  <td className="px-3 lg:px-6 py-3 lg:py-4 text-right">
                    <input
                      type="number"
                      step="0.1"
                      value={liability.minimumPayment === 0 ? '' : Number(liability.minimumPayment.toFixed(1))}
                      onChange={(e) => onUpdateLiability(liability.id, { minimumPayment: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                      className="w-20 lg:w-24 text-xs lg:text-sm font-mono text-slate-600 dark:text-slate-300 text-right bg-transparent hover:bg-white dark:hover:bg-slate-700 focus:bg-white dark:focus:bg-slate-700 focus:ring-1 focus:ring-rose-500 rounded px-1 py-0.5 outline-none transition-all"
                    />
                  </td>
                  <td className="px-3 lg:px-6 py-3 lg:py-4 text-right">
                    <input
                      type="number"
                      value={liability.balance}
                      onChange={(e) => onUpdateLiability(liability.id, { balance: parseFloat(e.target.value) || 0 })}
                      className="w-24 lg:w-32 text-xs lg:text-sm font-mono font-bold text-rose-600 dark:text-rose-400 text-right bg-transparent hover:bg-white dark:hover:bg-slate-700 focus:bg-white dark:focus:bg-slate-700 focus:ring-1 focus:ring-rose-500 rounded px-1 py-0.5 outline-none transition-all"
                    />
                  </td>
                  <td className="px-3 lg:px-6 py-3 lg:py-4 text-right">
                    <button
                      onClick={() => onDeleteLiability(liability.id)}
                      className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all"
                      title="Delete Liability"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {liabilities.length > 0 && (
              <tr className="bg-slate-50/10 dark:bg-slate-800/10">
                <td colSpan={4} className="px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">
                  {t('totalLiabilities')}
                </td>
                <td className="px-6 py-3 text-right text-sm font-mono font-bold text-rose-600 dark:text-rose-400">
                  {formatCurrency(liabilities.reduce((sum, l) => sum + parseVal(l.balance), 0), currency)}
                </td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
