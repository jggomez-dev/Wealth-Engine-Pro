import React from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from '../lib/utils';

interface HealthCardProps {
  title: string;
  status: 'success' | 'warning' | 'error' | 'info';
  message: string;
  info?: string;
}

export default function HealthCard({ title, status, message, info }: HealthCardProps) {
  const styles = {
    success: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', icon: <CheckCircle2 className="w-4 h-4" /> },
    warning: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', icon: <AlertCircle className="w-4 h-4" /> },
    error: { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-700', icon: <AlertCircle className="w-4 h-4" /> },
    info: { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700', icon: <Info className="w-4 h-4" /> },
  };

  const current = styles[status];

  return (
    <div className={`p-4 rounded-xl border ${current.bg} ${current.border} flex gap-3 items-start relative group shadow-sm`}>
      <div className={cn("shrink-0", current.text)}>{current.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between mb-1 gap-2">
          <h4 className={`text-[10px] font-bold uppercase tracking-widest ${current.text} leading-tight`}>{title}</h4>
          {info && (
            <div className="relative shrink-0">
              <Info className="w-3 h-3 text-slate-400 cursor-help" />
              <div className="absolute top-full right-0 mt-2 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {info}
              </div>
            </div>
          )}
        </div>
        <p className="text-sm font-medium text-slate-700 leading-snug break-words">{message}</p>
      </div>
    </div>
  );
}
