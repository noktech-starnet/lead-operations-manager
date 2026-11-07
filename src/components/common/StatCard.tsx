import React from 'react';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'blue' | 'slate' | 'purple';
  trend?: {
    value: string;
    isPositive?: boolean;
  };
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  variant = 'indigo',
  trend,
}) => {
  const variantStyles = {
    indigo: {
      border: 'border-indigo-500/20 hover:border-indigo-500/40',
      bgGlow: 'from-indigo-500/10 to-transparent',
      iconBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      valColor: 'text-indigo-100',
    },
    emerald: {
      border: 'border-emerald-500/20 hover:border-emerald-500/40',
      bgGlow: 'from-emerald-500/10 to-transparent',
      iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      valColor: 'text-emerald-100',
    },
    amber: {
      border: 'border-amber-500/20 hover:border-amber-500/40',
      bgGlow: 'from-amber-500/10 to-transparent',
      iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      valColor: 'text-amber-100',
    },
    rose: {
      border: 'border-rose-500/20 hover:border-rose-500/40',
      bgGlow: 'from-rose-500/10 to-transparent',
      iconBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      valColor: 'text-rose-100',
    },
    blue: {
      border: 'border-blue-500/20 hover:border-blue-500/40',
      bgGlow: 'from-blue-500/10 to-transparent',
      iconBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      valColor: 'text-blue-100',
    },
    purple: {
      border: 'border-purple-500/20 hover:border-purple-500/40',
      bgGlow: 'from-purple-500/10 to-transparent',
      iconBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      valColor: 'text-purple-100',
    },
    slate: {
      border: 'border-slate-700/50 hover:border-slate-700',
      bgGlow: 'from-slate-800/30 to-transparent',
      iconBg: 'bg-slate-800 text-slate-400 border-slate-700',
      valColor: 'text-slate-100',
    },
  }[variant];

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-slate-900/90 border ${variantStyles.border} p-5 shadow-lg transition-all duration-200 group`}
    >
      <div
        className={`absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br ${variantStyles.bgGlow} blur-2xl pointer-events-none`}
      />

      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        <div className={`p-2 rounded-lg border ${variantStyles.iconBg}`}>
          {icon}
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${variantStyles.valColor}`}>
          {typeof value === 'number' ? value.toLocaleString('es-MX') : value}
        </span>
        {trend && (
          <span
            className={`text-xs font-medium ${
              trend.isPositive ? 'text-emerald-400' : 'text-slate-400'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>

      {subtitle && <p className="mt-1 text-xs text-slate-400 line-clamp-1">{subtitle}</p>}
    </div>
  );
};
