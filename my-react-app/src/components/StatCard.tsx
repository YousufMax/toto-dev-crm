import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  subtext?: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  highlight?: boolean;
  color?: 'default' | 'emerald' | 'rose' | 'amber' | 'blue';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  icon,
  trend,
  highlight = false,
  color = 'default',
}) => {
  const colorMap = {
    default: 'from-slate-900 to-slate-900/60 border-slate-800 text-slate-200',
    emerald: 'from-emerald-950/30 to-slate-900/60 border-emerald-500/20 text-emerald-400',
    rose: 'from-rose-950/30 to-slate-900/60 border-rose-500/20 text-rose-400',
    amber: 'from-amber-950/30 to-slate-900/60 border-amber-500/20 text-amber-400',
    blue: 'from-blue-950/30 to-slate-900/60 border-blue-500/20 text-blue-400',
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-b p-5 shadow-sm transition-all duration-200 hover:border-slate-700/80 ${colorMap[color]}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
        <div className="rounded-lg bg-slate-800/80 p-2 text-slate-300">
          {icon}
        </div>
      </div>
      <div className="mt-3">
        <h3 className="text-2xl font-bold tracking-tight text-white">{value}</h3>
        {subtext && (
          <p className="mt-1 text-xs text-slate-400 flex items-center gap-1.5">
            {trend && (
              <span className={`font-semibold ${trend.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {trend.value}
              </span>
            )}
            <span>{subtext}</span>
          </p>
        )}
      </div>
      {highlight && (
        <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />
      )}
    </div>
  );
};
