import React from 'react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { Info } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  info?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  progress?: number;
  className?: string;
}

export default function MetricCard({
  title,
  value,
  subtitle,
  icon,
  info,
  trend,
  progress,
  className
}: MetricCardProps) {
  const [showInfo, setShowInfo] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-white dark:bg-slate-900 p-4 lg:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-full min-h-[140px] lg:min-h-[160px] relative",
        className
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 leading-tight">
              {title}
            </p>
            {info && (
              <div className="relative">
                <button 
                  onMouseEnter={() => setShowInfo(true)}
                  onMouseLeave={() => setShowInfo(false)}
                  className="text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors"
                >
                  <Info className="w-3 h-3" />
                </button>
                {showInfo && (
                  <div className="absolute z-50 top-full left-0 mt-2 w-48 p-2 bg-slate-900 dark:bg-slate-800 text-white text-[10px] rounded-lg shadow-xl pointer-events-none">
                    {info}
                  </div>
                )}
              </div>
            )}
          </div>
          <h3 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight font-mono truncate">
            {value}
          </h3>
        </div>
        {icon && (
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400 shrink-0 ml-3">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-auto pt-4 border-t border-slate-50 dark:border-slate-800">
        {progress !== undefined ? (
          <div className="space-y-2.5">
            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progress * 100, 100)}%` }}
                className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full"
              />
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">
              {subtitle}
            </p>
          </div>
        ) : (
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest leading-tight">
            {subtitle}
          </p>
        )}

        {trend && (
          <div className={cn(
            "text-[10px] font-bold flex items-center gap-1 mt-2.5",
            trend.isPositive ? "text-emerald-600" : "text-rose-600"
          )}>
            {trend.isPositive ? '↑' : '↓'} {trend.value}
            <span className="text-slate-400 font-normal ml-1">vs sync</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
