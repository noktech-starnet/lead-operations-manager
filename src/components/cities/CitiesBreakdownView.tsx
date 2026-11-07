import React from 'react';
import {
  MapPin,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Download,
  ArrowRight,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { Lead, CityAlias } from '../../types';

interface CitiesBreakdownViewProps {
  leads: Lead[];
  cityCatalog: CityAlias[];
  onExportCity: (cityName: string) => void;
  onFilterCityInReview: (cityName: string) => void;
}

export const CitiesBreakdownView: React.FC<CitiesBreakdownViewProps> = ({
  leads,
  cityCatalog,
  onExportCity,
  onFilterCityInReview,
}) => {
  // Aggregate stats per city
  const cityStatsMap = new Map<
    string,
    {
      cityName: string;
      totalLeads: number;
      validCount: number;
      pendingCount: number;
      rejectedCount: number;
      conflictsCount: number;
      deliveredCount: number;
    }
  >();

  // Initialize with catalog cities
  cityCatalog.forEach((c) => {
    cityStatsMap.set(c.canonicalCity, {
      cityName: c.canonicalCity,
      totalLeads: 0,
      validCount: 0,
      pendingCount: 0,
      rejectedCount: 0,
      conflictsCount: 0,
      deliveredCount: 0,
    });
  });

  // Collect stats
  let unclassifiedStats = {
    cityName: 'Sin clasificar / Desconocida',
    totalLeads: 0,
    validCount: 0,
    pendingCount: 0,
    rejectedCount: 0,
    conflictsCount: 0,
    deliveredCount: 0,
  };

  leads.forEach((l) => {
    if (!l.ciudad) {
      unclassifiedStats.totalLeads++;
      if (l.status === 'accepted') unclassifiedStats.validCount++;
      else if (l.status === 'pending_review') unclassifiedStats.pendingCount++;
      else if (l.status === 'rejected') unclassifiedStats.rejectedCount++;
      return;
    }

    let stats = cityStatsMap.get(l.ciudad);
    if (!stats) {
      stats = {
        cityName: l.ciudad,
        totalLeads: 0,
        validCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        conflictsCount: 0,
        deliveredCount: 0,
      };
      cityStatsMap.set(l.ciudad, stats);
    }

    stats.totalLeads++;
    if (l.status === 'accepted') stats.validCount++;
    else if (l.status === 'pending_review') stats.pendingCount++;
    else if (l.status === 'rejected') stats.rejectedCount++;

    if (l.cityConflict) stats.conflictsCount++;
    if ((l.deliveredCount || 0) > 0) stats.deliveredCount++;
  });

  const cityStatsList = Array.from(cityStatsMap.values()).sort(
    (a, b) => b.validCount - a.validCount
  );

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-400" />
            <span>Distribución de Leads por Plaza Territorial</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Visualiza el volumen consolidado de leads válidos, pendientes y rechazados por cada ciudad normalizada.
          </p>
        </div>

        {unclassifiedStats.totalLeads > 0 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="text-xs text-amber-300">
              <span className="font-bold">{unclassifiedStats.totalLeads} leads</span> sin ciudad identificada
            </div>
            <button
              onClick={() => onFilterCityInReview('')}
              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-semibold transition-colors"
            >
              Revisar
            </button>
          </div>
        )}
      </div>

      {/* Grid of City Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cityStatsList.map((stat) => {
          const hasLeads = stat.totalLeads > 0;
          return (
            <div
              key={stat.cityName}
              className={`rounded-2xl border p-5 transition-all shadow-lg ${
                hasLeads
                  ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  : 'bg-slate-950/40 border-slate-900 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-indigo-400" />
                    <span>{stat.cityName}</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {stat.totalLeads.toLocaleString('es-MX')} leads totales
                  </span>
                </div>

                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs">
                  {stat.validCount} Válidos
                </span>
              </div>

              {/* Progress/Metric mini-bars */}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-center">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                  <span className="block text-[10px] text-amber-400 uppercase font-semibold">Pendientes</span>
                  <span className="text-sm font-bold text-amber-300">{stat.pendingCount}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                  <span className="block text-[10px] text-rose-400 uppercase font-semibold">Rechazados</span>
                  <span className="text-sm font-bold text-rose-300">{stat.rejectedCount}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800/80">
                  <span className="block text-[10px] text-blue-400 uppercase font-semibold">Entregados</span>
                  <span className="text-sm font-bold text-blue-300">{stat.deliveredCount}</span>
                </div>
              </div>

              {stat.conflictsCount > 0 && (
                <div className="mt-2 text-[11px] text-indigo-300 bg-indigo-950/40 p-1.5 rounded flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{stat.conflictsCount} apariciones con conflicto de ciudad</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2">
                <button
                  onClick={() => onExportCity(stat.cityName)}
                  disabled={stat.validCount === 0}
                  className="flex-1 py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar ({stat.validCount})</span>
                </button>
                <button
                  onClick={() => onFilterCityInReview(stat.cityName)}
                  className="py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1"
                >
                  <span>Ver Leads</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
