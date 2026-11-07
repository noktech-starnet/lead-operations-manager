import { useAuth } from '../auth/AuthGate';
import { canWrite } from '../../services/access';
import React, { useState, useMemo } from 'react';
import {
  Truck,
  PlusCircle,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  Clock,
  Calendar,
  Building,
  User,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import { Delivery, Lead, CityAlias } from '../../types';
import { storageService } from '../../services/storageService';
import { Modal } from '../common/Modal';

interface DeliveriesViewProps {
  deliveries: Delivery[];
  leads: Lead[];
  cityCatalog: CityAlias[];
  onRefresh: () => void;
}

export const DeliveriesView: React.FC<DeliveriesViewProps> = ({
  deliveries,
  leads,
  cityCatalog,
  onRefresh,
}) => {
  const canEdit = canWrite(useAuth().profile.roles, 'deliveries');
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [weekFilter, setWeekFilter] = useState('all');

  // Manual new delivery modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Form state
  const [formCity, setFormCity] = useState(cityCatalog[0]?.canonicalCity || 'Monterrey');
  const [formRecipient, setFormRecipient] = useState('');
  const [formDate, setFormDate] = useState(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  });
  const [formCampaign, setFormCampaign] = useState('Pensiones');
  const [formFormat, setFormFormat] = useState<'standard' | 'polaris' | 'vapi'>('standard');
  const [formExportedCount, setFormExportedCount] = useState<number>(0);
  const [formDeliveredCount, setFormDeliveredCount] = useState<number>(0);
  const [formObservations, setFormObservations] = useState('');
  const [formDiscrepancyReason, setFormDiscrepancyReason] = useState('');
  const [formWeek, setFormWeek] = useState('2026-W41');

  // Calculate available valid leads in selected city
  const availableValidInCity = useMemo(() => {
    return leads.filter((l) => l.status === 'accepted' && l.ciudad.toLowerCase() === formCity.toLowerCase()).length;
  }, [leads, formCity]);

  // When formCity changes, auto-set exported & delivered count to available valid leads
  const handleCityChangeInForm = (city: string) => {
    setFormCity(city);
    const count = leads.filter((l) => l.status === 'accepted' && l.ciudad.toLowerCase() === city.toLowerCase()).length;
    setFormExportedCount(count);
    setFormDeliveredCount(count);
  };

  // Open modal
  const handleOpenCreateModal = () => {
    const defaultCity = cityCatalog[0]?.canonicalCity || 'Monterrey';
    handleCityChangeInForm(defaultCity);
    setFormRecipient('');
    setFormObservations('');
    setFormDiscrepancyReason('');
    setIsNewModalOpen(true);
  };

  // Submit manual delivery
  const handleSubmitDelivery = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formRecipient.trim()) {
      alert('Por favor especifica el destinatario o cliente receptor.');
      return;
    }

    if (formDeliveredCount <= 0) {
      alert('La cantidad de leads entregados debe ser mayor a 0.');
      return;
    }

    // If discrepancy between exported and delivered, require explanation
    if (formDeliveredCount !== formExportedCount && !formDiscrepancyReason.trim()) {
      alert('Detectamos una discrepancia entre la cantidad exportada y la cantidad entregada. Por favor explica el motivo de la diferencia en las observaciones.');
      return;
    }

    const matchedLeads = leads
      .filter((l) => l.status === 'accepted' && l.ciudad.toLowerCase() === formCity.toLowerCase())
      .slice(0, formDeliveredCount)
      .map((l) => l.id);

    const deliveryId = `del-${Date.now()}`;
    const newDelivery: Delivery = {
      id: deliveryId,
      ciudad: formCity,
      campaña: formCampaign,
      destinatario: formRecipient.trim(),
      fechaEntrega: formDate,
      leadsCount: formDeliveredCount,
      exportedLeadsCount: formExportedCount,
      fileName: `${formCity}_${formCampaign}_entrega.xlsx`,
      formato: formFormat,
      semanaOperativa: formWeek,
      observaciones: formDiscrepancyReason
        ? `[DISCREPANCIA: ${formDiscrepancyReason}] ${formObservations}`.trim()
        : formObservations.trim(),
      estado: formDeliveredCount < formExportedCount ? 'parcial' : 'confirmada',
      leadIds: matchedLeads,
      createdAt: new Date().toISOString(),
    };

    storageService.saveDelivery(newDelivery);
    setIsNewModalOpen(false);
    onRefresh();
  };

  // Filtered deliveries
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesCity = d.ciudad.toLowerCase().includes(term);
        const matchesRecipient = d.destinatario.toLowerCase().includes(term);
        const matchesCampaign = d.campaña.toLowerCase().includes(term);
        if (!matchesCity && !matchesRecipient && !matchesCampaign) return false;
      }

      if (cityFilter !== 'all' && d.ciudad.toLowerCase() !== cityFilter.toLowerCase()) {
        return false;
      }

      if (weekFilter !== 'all' && d.semanaOperativa !== weekFilter) {
        return false;
      }

      return true;
    });
  }, [deliveries, searchTerm, cityFilter, weekFilter]);

  // Unique weeks
  const uniqueWeeks = useMemo(() => {
    const set = new Set<string>();
    deliveries.forEach((d) => set.add(d.semanaOperativa));
    return Array.from(set).sort();
  }, [deliveries]);

  // Total confirmed delivered count
  const totalDeliveredSum = useMemo(() => {
    return deliveries.reduce((acc, d) => acc + (d.leadsCount || 0), 0);
  }, [deliveries]);

  return (
    <div className="space-y-6">
      {/* Header and Summary Bar */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-400" />
            <span>Control y Trazabilidad de Entregas Reales</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Registra las entregas confirmadas de leads para garantizar que la descarga de un archivo no se confunda con una entrega completada.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <span className="text-slate-400 block text-[11px]">Total Leads Entregados</span>
            <span className="text-base font-bold text-emerald-400">
              {totalDeliveredSum.toLocaleString('es-MX')} leads
            </span>
          </div>

          <button
            disabled={!canEdit}
          onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Registrar Entrega Manual</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por destinatario, ciudad o campaña..."
            className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">Todas las Ciudades</option>
            {cityCatalog.map((c) => (
              <option key={c.canonicalCity} value={c.canonicalCity}>
                {c.canonicalCity}
              </option>
            ))}
          </select>

          <select
            value={weekFilter}
            onChange={(e) => setWeekFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">Todas las Semanas</option>
            {uniqueWeeks.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Deliveries Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/80">
                <th className="px-4 py-3">ID / Archivo</th>
                <th className="px-4 py-3">Fecha Entrega</th>
                <th className="px-4 py-3">Semana</th>
                <th className="px-4 py-3">Ciudad</th>
                <th className="px-4 py-3">Destinatario / Cliente</th>
                <th className="px-4 py-3 text-emerald-400 font-bold">Leads Entregados</th>
                <th className="px-4 py-3">Exportados</th>
                <th className="px-4 py-3">Formato</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredDeliveries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-300">No hay entregas registradas aún</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Las entregas se registran al exportar un archivo o mediante el botón "Registrar Entrega Manual".
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDeliveries.map((del) => {
                  const hasDiscrepancy = del.leadsCount !== del.exportedLeadsCount;
                  return (
                    <tr key={del.id} className="hover:bg-slate-950/40 text-slate-300">
                      <td className="px-4 py-3 font-mono font-medium text-slate-200">
                        <div className="truncate max-w-[150px]" title={del.fileName}>
                          {del.fileName || del.id}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300 whitespace-nowrap">
                        {del.fechaEntrega}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-[11px] text-slate-300">
                          {del.semanaOperativa}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-100 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>{del.ciudad}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-200">{del.destinatario}</td>
                      <td className="px-4 py-3 font-extrabold text-emerald-400 text-sm">
                        {del.leadsCount.toLocaleString('es-MX')}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">
                        {del.exportedLeadsCount ? del.exportedLeadsCount.toLocaleString('es-MX') : del.leadsCount}
                      </td>
                      <td className="px-4 py-3 uppercase text-[10px] text-slate-400 font-semibold">
                        {del.formato}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {del.estado === 'confirmada' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <CheckCircle className="w-3 h-3" /> Confirmada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            <AlertCircle className="w-3 h-3" /> Parcial
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-[11px] text-slate-400" title={del.observaciones}>
                        {del.observaciones || <span className="text-slate-400 italic">Sin notas</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Delivery Modal */}
      {isNewModalOpen && (
        <Modal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          title="Registrar Entrega Manual de Leads"
          subtitle="Confirma la entrega efectiva realizada a clientes o canales de captación."
        >
          <form onSubmit={handleSubmitDelivery} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ciudad de la Entrega *
                </label>
                <select
                  value={formCity}
                  onChange={(e) => handleCityChangeInForm(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  {cityCatalog.map((c) => (
                    <option key={c.canonicalCity} value={c.canonicalCity}>
                      {c.canonicalCity}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Disponibles válidos en sistema: <strong>{availableValidInCity}</strong> leads
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Semana Operativa *
                </label>
                <input
                  type="text"
                  value={formWeek}
                  onChange={(e) => setFormWeek(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="2026-W41"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Destinatario / Cliente / Canal *
                </label>
                <input
                  type="text"
                  value={formRecipient}
                  onChange={(e) => setFormRecipient(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  placeholder="Ej: Call Center Vapi, Sucursal Monterrey"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Fecha de Entrega *
                </label>
                <input
                  type="text"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  placeholder="09/10/2026"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cantidad Exportada
                </label>
                <input
                  type="number"
                  min="0"
                  value={formExportedCount}
                  onChange={(e) => setFormExportedCount(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cantidad Realmente Entregada *
                </label>
                <input
                  type="number"
                  min="1"
                  value={formDeliveredCount}
                  onChange={(e) => setFormDeliveredCount(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500 font-bold text-emerald-400"
                  required
                />
              </div>
            </div>

            {/* If discrepancy between exported and delivered */}
            {formExportedCount !== formDeliveredCount && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span>Discrepancia detectada ({formExportedCount} exportados vs {formDeliveredCount} entregados)</span>
                </div>
                <label className="block text-[11px] font-semibold text-amber-200">
                  Motivo obligatorio de la discrepancia:
                </label>
                <input
                  type="text"
                  value={formDiscrepancyReason}
                  onChange={(e) => setFormDiscrepancyReason(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-amber-500/40 text-xs text-slate-100 focus:outline-none"
                  placeholder="Ej: Se excluyeron registros duplicados de campaña previa a solicitud del cliente"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Observaciones Generales
              </label>
              <textarea
                value={formObservations}
                onChange={(e) => setFormObservations(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                placeholder="Canal de entrega, responsable, acuse..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20"
              >
                Guardar Registro de Entrega
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
