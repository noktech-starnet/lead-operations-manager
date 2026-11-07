import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Truck,
  Send,
  FileCheck2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  MapPin,
  Calendar,
  Layers,
  Target,
  ShieldAlert,
  Building,
  Percent,
} from 'lucide-react';
import { Lead, Delivery, WeeklyGoal, CityAlias, Client, LeadDistribution, ReconciliationResult } from '../../types';
import { StatCard } from '../common/StatCard';

interface WeeklyDashboardProps {
  leads: Lead[];
  deliveries: Delivery[];
  goals: WeeklyGoal[];
  cityCatalog: CityAlias[];
  clients: Client[];
  distributions: LeadDistribution[];
  reconciliations: ReconciliationResult[];
  onNavigateToReview: () => void;
  onNavigateToExports: () => void;
  onNavigateToDeliveries: () => void;
  onNavigateToDistribution: () => void;
  onNavigateToReconciliation: () => void;
}

export const WeeklyDashboard: React.FC<WeeklyDashboardProps> = ({
  leads,
  deliveries,
  goals,
  cityCatalog,
  clients,
  distributions,
  reconciliations,
  onNavigateToReview,
  onNavigateToExports,
  onNavigateToDeliveries,
  onNavigateToDistribution,
  onNavigateToReconciliation,
}) => {
  // Operational Week selector (e.g. "2026-W41" which corresponds to 05/10/2026 to 11/10/2026)
  const [selectedWeek, setSelectedWeek] = useState('2026-W41');
  const [selectedClientFilter, setSelectedClientFilter] = useState('all');
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState('all');
  const [selectedCityFilter, setSelectedCityFilter] = useState('all');

  const availableWeeks = [
    { id: 'all', label: 'Histórico Completo Acumulado' },
    { id: '2026-W39', label: 'Semana 39 (21/09/2026 - 27/09/2026)' },
    { id: '2026-W40', label: 'Semana 40 (28/09/2026 - 04/10/2026)' },
    { id: '2026-W41', label: 'Semana 41 (05/10/2026 - 11/10/2026) [Actual]' },
    { id: '2026-W42', label: 'Semana 42 (12/10/2026 - 18/10/2026)' },
  ];

  // 1. LOS 4 INDICADORES ESTRICTAMENTE SEPARADOS (Requisito Sección 7)

  // Indicador 1: Leads válidos procesados (status === 'accepted')
  const totalValidosProcesados = useMemo(() => {
    return leads.filter((l) => {
      if (l.status !== 'accepted') return false;
      if (selectedCityFilter !== 'all' && l.ciudad.toLowerCase() !== selectedCityFilter.toLowerCase()) return false;
      if (selectedCampaignFilter !== 'all' && l.campaign.toLowerCase() !== selectedCampaignFilter.toLowerCase()) return false;
      return true;
    }).length;
  }, [leads, selectedCityFilter, selectedCampaignFilter]);

  // Indicador 2: Leads entregados confirmados (sum of confirmed deliveries)
  const totalEntregadosConfirmados = useMemo(() => {
    return deliveries
      .filter((d) => {
        if (selectedWeek !== 'all' && d.semanaOperativa !== selectedWeek) return false;
        if (selectedCityFilter !== 'all' && d.ciudad.toLowerCase() !== selectedCityFilter.toLowerCase()) return false;
        if (selectedCampaignFilter !== 'all' && d.campaña.toLowerCase() !== selectedCampaignFilter.toLowerCase()) return false;
        if (selectedClientFilter !== 'all') {
          const client = clients.find((c) => c.id === selectedClientFilter);
          if (client && !d.destinatario.toLowerCase().includes(client.nombreComercial.toLowerCase())) {
            return false;
          }
        }
        return true;
      })
      .reduce((sum, d) => sum + (d.leadsCount || 0), 0);
  }, [deliveries, selectedWeek, selectedCityFilter, selectedCampaignFilter, selectedClientFilter, clients]);

  // Indicador 3: Leads distribuidos por cliente (sum of distributions)
  const totalDistribuidos = useMemo(() => {
    return distributions
      .filter((dist) => {
        if (selectedClientFilter !== 'all' && dist.clienteId !== selectedClientFilter) return false;
        if (selectedCityFilter !== 'all' && dist.ciudad.toLowerCase() !== selectedCityFilter.toLowerCase()) return false;
        if (selectedCampaignFilter !== 'all' && dist.campaña.toLowerCase() !== selectedCampaignFilter.toLowerCase()) return false;
        return true;
      })
      .reduce((sum, dist) => sum + dist.cantidad, 0);
  }, [distributions, selectedClientFilter, selectedCityFilter, selectedCampaignFilter]);

  // Indicador 4: Leads conciliados con el dump (coincidencias únicas en reconciliations)
  const totalConciliadosConDump = useMemo(() => {
    return reconciliations
      .filter((rec) => {
        if (selectedWeek !== 'all' && rec.semanaOperativa !== selectedWeek) return false;
        if (selectedCampaignFilter !== 'all' && rec.campaña.toLowerCase() !== selectedCampaignFilter.toLowerCase()) return false;
        return true;
      })
      .reduce((sum, rec) => sum + rec.coincidenciasCount, 0);
  }, [reconciliations, selectedWeek, selectedCampaignFilter]);

  // Additional process indicators
  const totalPendientesRevision = useMemo(() => {
    return leads.filter((l) => l.status === 'pending_review').length;
  }, [leads]);

  const totalRechazados = useMemo(() => {
    return leads.filter((l) => l.status === 'rejected').length;
  }, [leads]);

  // Distributions breakdown by client
  const clientDistributionsSummary = useMemo(() => {
    return clients.map((cli) => {
      const cliDist = distributions
        .filter((d) => d.clienteId === cli.id)
        .reduce((sum, d) => sum + d.cantidad, 0);

      const cliDeliv = deliveries
        .filter(
          (del) =>
            del.clienteId === cli.id ||
            del.destinatario.toLowerCase().includes(cli.nombreComercial.toLowerCase())
        )
        .reduce((sum, del) => sum + del.leadsCount, 0);

      return {
        id: cli.id,
        nombre: cli.nombreComercial,
        estado: cli.estado,
        campañas: cli.campañas.join(', '),
        distribuidos: cliDist,
        entregasArchivo: cliDeliv,
      };
    });
  }, [clients, distributions, deliveries]);

  // City Goals Comparison Table
  const cityComparison = useMemo(() => {
    return cityCatalog.map((city) => {
      const canonical = city.canonicalCity;

      // Find goal for this city & week
      const goal = goals.find(
        (g) =>
          g.ciudad.toLowerCase() === canonical.toLowerCase() &&
          g.semanaOperativa === selectedWeek
      );

      // Processed valid leads for this city
      const cityProcessed = leads.filter(
        (l) => l.ciudad.toLowerCase() === canonical.toLowerCase() && l.status === 'accepted'
      ).length;

      // Pending leads for this city
      const cityPending = leads.filter(
        (l) => l.ciudad.toLowerCase() === canonical.toLowerCase() && l.status === 'pending_review'
      ).length;

      // Confirmed delivered for this city
      const cityDelivered = deliveries
        .filter(
          (d) =>
            d.ciudad.toLowerCase() === canonical.toLowerCase() &&
            (d.semanaOperativa === selectedWeek || selectedWeek === 'all')
        )
        .reduce((sum, d) => sum + (d.leadsCount || 0), 0);

      // Distributed for this city
      const cityDistributed = distributions
        .filter((dist) => dist.ciudad.toLowerCase() === canonical.toLowerCase())
        .reduce((sum, dist) => sum + dist.cantidad, 0);

      // Processing % & Diff
      let metaProc = goal ? goal.metaProcesamiento : null;
      let pctProc: number | null = null;
      let diffProc: number | null = null;

      if (metaProc && metaProc > 0) {
        pctProc = Math.round((cityProcessed / metaProc) * 100);
        diffProc = cityProcessed - metaProc;
      }

      // Delivery % & Diff
      let metaEntr = goal ? goal.metaEntrega : null;
      let pctEntr: number | null = null;
      let diffEntr: number | null = null;

      if (metaEntr && metaEntr > 0) {
        pctEntr = Math.round((cityDelivered / metaEntr) * 100);
        diffEntr = cityDelivered - metaEntr;
      }

      const pendingToDeliver = Math.max(0, cityProcessed - cityDelivered);

      return {
        canonicalCity: canonical,
        state: city.state,
        metaProc,
        cityProcessed,
        pctProc,
        diffProc,
        metaEntr,
        cityDelivered,
        pctEntr,
        diffEntr,
        cityDistributed,
        cityPending,
        pendingToDeliver,
      };
    });
  }, [cityCatalog, goals, leads, deliveries, distributions, selectedWeek]);

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
              Dashboard de Operaciones
            </span>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mt-0.5">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <span>Ciclo de Vida de Leads: Procesamiento, Entrega, Distribución y Conciliación</span>
            </h3>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Semana Operativa
            </label>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {availableWeeks.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Cliente Destinatario
            </label>
            <select
              value={selectedClientFilter}
              onChange={(e) => setSelectedClientFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none"
            >
              <option value="all">Todos los clientes</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombreComercial}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Ciudad / Plaza
            </label>
            <select
              value={selectedCityFilter}
              onChange={(e) => setSelectedCityFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none"
            >
              <option value="all">Todas las ciudades</option>
              {cityCatalog.map((c) => (
                <option key={c.canonicalCity} value={c.canonicalCity}>
                  {c.canonicalCity}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Campaña
            </label>
            <select
              value={selectedCampaignFilter}
              onChange={(e) => setSelectedCampaignFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none"
            >
              <option value="all">Todas las campañas</option>
              <option value="Pensiones">Pensiones</option>
              <option value="Retiro Activo">Retiro Activo</option>
            </select>
          </div>
        </div>
      </div>

      {/* LOS 4 INDICADORES ESTRICTAMENTE SEPARADOS (Requisito Sección 7) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Cuatro Indicadores Operativos Independientes (No mezclados)
          </h4>
          <span className="text-[11px] text-slate-400">
            Cada métrica representa una etapa independiente del ciclo operativo
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* INDICADOR 1 */}
          <StatCard
            title="1. Válidos Procesados"
            value={totalValidosProcesados}
            subtitle="Leads únicos aprobados y listos para entregar"
            icon={<CheckCircle2 className="w-5 h-5" />}
            variant="emerald"
          />

          {/* INDICADOR 2 */}
          <StatCard
            title="2. Entregados Confirmados"
            value={totalEntregadosConfirmados}
            subtitle="Leads con archivo de entrega confirmado y acuse"
            icon={<Truck className="w-5 h-5" />}
            variant="blue"
          />

          {/* INDICADOR 3 */}
          <StatCard
            title="3. Distribuidos por Cliente"
            value={totalDistribuidos}
            subtitle="Movimientos de envío registrados a destinatarios"
            icon={<Send className="w-5 h-5" />}
            variant="indigo"
          />

          {/* INDICADOR 4 */}
          <StatCard
            title="4. Conciliados con Dump"
            value={totalConciliadosConDump}
            subtitle="Coincidencias únicas verificadas contra dumps externos"
            icon={<FileCheck2 className="w-5 h-5" />}
            variant="purple"
          />
        </div>
      </div>

      {/* Secondary Status Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase">Leads Pendientes de Depuración</span>
            <span className="text-2xl font-bold text-amber-300 block mt-0.5">
              {totalPendientesRevision.toLocaleString('es-MX')}
            </span>
            <span className="text-[11px] text-slate-400">Nombres sin apellido, negocios o ambigüedad</span>
          </div>
          <button
            onClick={onNavigateToReview}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-colors"
          >
            Revisar
          </button>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase">Registros Rechazados</span>
            <span className="text-2xl font-bold text-rose-400 block mt-0.5">
              {totalRechazados.toLocaleString('es-MX')}
            </span>
            <span className="text-[11px] text-slate-400">Teléfonos inválidos o datos incompletos</span>
          </div>
          <button
            onClick={onNavigateToReview}
            className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 text-xs font-semibold hover:bg-rose-500/30 transition-colors"
          >
            Auditar
          </button>
        </div>
      </div>

      {/* Distribution by Client Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Building className="w-4 h-4 text-indigo-400" />
              <span>Avance de Distribución por Cliente Destinatario</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Volumen acumulado de leads asignados y entregados a cada destinatario activo.
            </p>
          </div>

          <button
            onClick={onNavigateToDistribution}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
          >
            Ver Bitácora de Distribución &rarr;
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 font-semibold">
                <th className="px-4 py-3">Cliente Destinatario</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Campañas</th>
                <th className="px-4 py-3 text-right text-indigo-300 font-bold">Leads Distribuidos</th>
                <th className="px-4 py-3 text-right text-emerald-400 font-bold">Entregas con Archivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {clientDistributionsSummary.map((c) => (
                <tr key={c.id} className="hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-bold text-slate-100 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>{c.nombre}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.estado === 'activo'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {c.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{c.campañas}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-indigo-300 text-sm">
                    {c.distribuidos.toLocaleString('es-MX')}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400 text-sm">
                    {c.entregasArchivo.toLocaleString('es-MX')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comparative Goals Table per City */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-400" />
              <span>Avance de Metas por Ciudad — {selectedWeek}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Comparativa entre meta de procesamiento (Indicador 1) y meta de entrega (Indicador 2).
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/60">
                <th className="px-4 py-3">Ciudad / Plaza</th>
                {/* Indicador 1: Procesamiento */}
                <th className="px-3 py-3 text-right">Meta Proc.</th>
                <th className="px-3 py-3 text-right text-emerald-400 font-bold">Proc. Real (1)</th>
                <th className="px-4 py-3 text-center">% Proc.</th>

                {/* Indicador 2: Entregas */}
                <th className="px-3 py-3 text-right border-l border-slate-800">Meta Entr.</th>
                <th className="px-3 py-3 text-right text-blue-400 font-bold">Entr. Real (2)</th>
                <th className="px-4 py-3 text-center">% Entr.</th>

                {/* Distribución */}
                <th className="px-3 py-3 text-right border-l border-slate-800 text-indigo-300 font-bold">
                  Distribuido (3)
                </th>

                {/* Pendientes */}
                <th className="px-3 py-3 text-right border-l border-slate-800 text-amber-300">Pend. Depurar</th>
                <th className="px-3 py-3 text-right text-blue-300">Pend. Entregar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cityComparison.map((row) => (
                <tr key={row.canonicalCity} className="hover:bg-slate-900/40 text-slate-300">
                  <td className="px-4 py-3 font-bold text-slate-100 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>{row.canonicalCity}</span>
                  </td>

                  <td className="px-3 py-3 text-right font-mono text-slate-400">
                    {row.metaProc !== null ? row.metaProc.toLocaleString('es-MX') : '—'}
                  </td>

                  <td className="px-3 py-3 text-right font-mono font-bold text-emerald-400">
                    {row.cityProcessed.toLocaleString('es-MX')}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {row.pctProc !== null ? (
                      <div className="space-y-1">
                        <span className={`font-bold ${row.pctProc >= 100 ? 'text-emerald-400' : 'text-slate-200'}`}>
                          {row.pctProc}%
                        </span>
                        <div className="w-16 mx-auto bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              row.pctProc >= 100 ? 'bg-emerald-400' : 'bg-emerald-500/70'
                            }`}
                            style={{ width: `${Math.min(row.pctProc, 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Meta no configurada</span>
                    )}
                  </td>

                  <td className="px-3 py-3 text-right font-mono text-slate-400 border-l border-slate-800">
                    {row.metaEntr !== null ? row.metaEntr.toLocaleString('es-MX') : '—'}
                  </td>

                  <td className="px-3 py-3 text-right font-mono font-bold text-blue-400">
                    {row.cityDelivered.toLocaleString('es-MX')}
                  </td>

                  <td className="px-4 py-3 text-center">
                    {row.pctEntr !== null ? (
                      <div className="space-y-1">
                        <span className={`font-bold ${row.pctEntr >= 100 ? 'text-blue-400' : 'text-slate-200'}`}>
                          {row.pctEntr}%
                        </span>
                        <div className="w-16 mx-auto bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              row.pctEntr >= 100 ? 'bg-blue-400' : 'bg-blue-500/70'
                            }`}
                            style={{ width: `${Math.min(row.pctEntr, 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Meta no configurada</span>
                    )}
                  </td>

                  <td className="px-3 py-3 text-right font-mono font-bold text-indigo-300 border-l border-slate-800">
                    {row.cityDistributed.toLocaleString('es-MX')}
                  </td>

                  <td className="px-3 py-3 text-right font-mono font-medium text-amber-300 border-l border-slate-800">
                    {row.cityPending}
                  </td>

                  <td className="px-3 py-3 text-right font-mono font-medium text-blue-300">
                    {row.pendingToDeliver}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
