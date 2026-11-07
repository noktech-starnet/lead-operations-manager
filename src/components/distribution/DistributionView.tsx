import React, { useState, useMemo } from 'react';
import {
  Send,
  PlusCircle,
  Search,
  Filter,
  CheckCircle,
  FileSpreadsheet,
  AlertCircle,
  User,
  Calendar,
  Building,
  MapPin,
  Layers,
  Tag,
  Clock,
  Download,
} from 'lucide-react';
import { LeadDistribution, Client, Delivery, CityAlias, Lead } from '../../types';
import { storageService } from '../../services/storageService';
import { Modal } from '../common/Modal';

interface DistributionViewProps {
  distributions: LeadDistribution[];
  clients: Client[];
  deliveries: Delivery[];
  cityCatalog: CityAlias[];
  leads: Lead[];
  onRefresh: () => void;
  currentUserRole: string;
}

export const DistributionView: React.FC<DistributionViewProps> = ({
  distributions,
  clients,
  deliveries,
  cityCatalog,
  leads,
  onRefresh,
  currentUserRole,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [responsibleFilter, setResponsibleFilter] = useState('all');

  // Modal new distribution movement
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Form state
  const [formDate, setFormDate] = useState(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  });
  const [formClientId, setFormClientId] = useState(clients[0]?.id || '');
  const [formCampaign, setFormCampaign] = useState('Pensiones');
  const [formCity, setFormCity] = useState(cityCatalog[0]?.canonicalCity || 'Acapulco');
  const [formQuantity, setFormQuantity] = useState<number>(12);
  const [formResponsible, setFormResponsible] = useState('Reina & Frank');
  const [formRegType, setFormRegType] = useState<'manual_sin_detalle' | 'vinculado_archivo'>('manual_sin_detalle');
  const [formDeliveryId, setFormDeliveryId] = useState('');
  const [formObservations, setFormObservations] = useState('');

  // Active clients only for dropdown
  const activeClients = useMemo(() => {
    return clients.filter((c) => c.estado === 'activo');
  }, [clients]);

  // When delivery is selected, auto-fill linked data
  const handleDeliverySelect = (deliveryId: string) => {
    setFormDeliveryId(deliveryId);
    const del = deliveries.find((d) => d.id === deliveryId);
    if (del) {
      setFormCity(del.ciudad);
      setFormCampaign(del.campaña);
      setFormQuantity(del.leadsCount);
      setFormDate(del.fechaEntrega);

      // Match client if recipient matches
      const matchedClient = clients.find(
        (c) => c.nombreComercial.toLowerCase() === del.destinatario.toLowerCase()
      );
      if (matchedClient) {
        setFormClientId(matchedClient.id);
      }
    }
  };

  // Submit new distribution
  const handleSubmitDistribution = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formClientId) {
      alert('Por favor selecciona un cliente destinatario.');
      return;
    }

    if (formQuantity <= 0) {
      alert('La cantidad de leads enviados debe ser mayor a 0.');
      return;
    }

    const selectedClient = clients.find((c) => c.id === formClientId);
    const clienteNombre = selectedClient ? selectedClient.nombreComercial : 'Cliente no especificado';

    // Exact phone list if linked to delivery
    let phonesList: string[] | undefined = undefined;
    let archivoOrigen: string | undefined = undefined;

    if (formRegType === 'vinculado_archivo' && formDeliveryId) {
      const del = deliveries.find((d) => d.id === formDeliveryId);
      if (del) {
        archivoOrigen = del.fileName;
        phonesList = del.leadIds && del.leadIds.length > 0 ? del.leadIds : undefined;
      }
    }

    // Check duplicate movement warning
    const isDuplicate = distributions.some(
      (d) =>
        d.fechaEnvio === formDate &&
        d.clienteId === formClientId &&
        d.ciudad.toLowerCase() === formCity.toLowerCase() &&
        d.cantidad === formQuantity &&
        d.campaña.toLowerCase() === formCampaign.toLowerCase()
    );

    if (isDuplicate) {
      const confirmDup = confirm(
        'Ya existe un movimiento idéntico registrado para esta misma fecha, cliente, ciudad y cantidad. ¿Deseas registrarlo de todas formas?'
      );
      if (!confirmDup) return;
    }

    const newDist: LeadDistribution = {
      id: `dist-${Date.now()}`,
      fechaEnvio: formDate,
      clienteId: formClientId,
      clienteNombre,
      campaña: formCampaign,
      ciudad: formCity,
      cantidad: formQuantity,
      responsable: formResponsible.trim() || 'Responsable Distribución',
      archivoOrigen,
      deliveryId: formRegType === 'vinculado_archivo' ? formDeliveryId : undefined,
      tipoRegistro: formRegType,
      phones: phonesList,
      observaciones: formObservations.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    storageService.addDistribution(newDist, formResponsible);
    setIsNewModalOpen(false);
    onRefresh();
  };

  // Filtered movements
  const filteredDistributions = useMemo(() => {
    return distributions.filter((d) => {
      if (clientFilter !== 'all' && d.clienteId !== clientFilter) return false;
      if (cityFilter !== 'all' && d.ciudad.toLowerCase() !== cityFilter.toLowerCase()) return false;
      if (campaignFilter !== 'all' && d.campaña.toLowerCase() !== campaignFilter.toLowerCase()) return false;
      if (responsibleFilter !== 'all' && d.responsable.toLowerCase() !== responsibleFilter.toLowerCase()) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesClient = d.clienteNombre.toLowerCase().includes(term);
        const matchesCity = d.ciudad.toLowerCase().includes(term);
        const matchesResp = d.responsable.toLowerCase().includes(term);
        const matchesCampaign = d.campaña.toLowerCase().includes(term);
        if (!matchesClient && !matchesCity && !matchesResp && !matchesCampaign) return false;
      }

      return true;
    });
  }, [distributions, clientFilter, cityFilter, campaignFilter, responsibleFilter, searchTerm]);

  // Aggregate stats
  const totalLeadsDistributed = useMemo(() => {
    return filteredDistributions.reduce((sum, d) => sum + d.cantidad, 0);
  }, [filteredDistributions]);

  const uniqueResponsibles = useMemo(() => {
    const set = new Set<string>();
    distributions.forEach((d) => set.add(d.responsable));
    return Array.from(set);
  }, [distributions]);

  const uniqueCampaigns = useMemo(() => {
    const set = new Set<string>();
    distributions.forEach((d) => set.add(d.campaña));
    return Array.from(set);
  }, [distributions]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Send className="w-5 h-5 text-indigo-400" />
            <span>Módulo de Distribución de Leads</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Registro operativo de movimientos de envío por cliente, plaza y responsable. Permite vincular entregas verificadas o registrar distribuciones manuales.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Distribuido</span>
            <span className="text-base font-bold text-indigo-300">
              {totalLeadsDistributed.toLocaleString('es-MX')} leads
            </span>
          </div>

          <button
            onClick={() => {
              if (activeClients.length > 0) setFormClientId(activeClients[0].id);
              setIsNewModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Registrar Movimiento</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, ciudad, campaña o responsable..."
            className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">Todos los Clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombreComercial}
              </option>
            ))}
          </select>

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
            value={responsibleFilter}
            onChange={(e) => setResponsibleFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">Todos los Responsables</option>
            {uniqueResponsibles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Movements Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/80">
                <th className="px-4 py-3">Fecha Envío</th>
                <th className="px-4 py-3">Cliente Destinatario</th>
                <th className="px-4 py-3">Campaña</th>
                <th className="px-4 py-3">Ciudad</th>
                <th className="px-4 py-3 text-right text-indigo-300 font-bold">Leads Enviados</th>
                <th className="px-4 py-3">Responsable</th>
                <th className="px-4 py-3">Tipo Registro</th>
                <th className="px-4 py-3">Archivo Origen</th>
                <th className="px-4 py-3">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredDistributions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-300">No hay movimientos de distribución registrados</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Registra el primer envío haciendo clic en "Registrar Movimiento".
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDistributions.map((dist) => (
                  <tr key={dist.id} className="hover:bg-slate-950/40 text-slate-300">
                    <td className="px-4 py-3 font-mono text-slate-200 whitespace-nowrap">
                      {dist.fechaEnvio}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-100 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{dist.clienteNombre}</span>
                    </td>
                    <td className="px-4 py-3">{dist.campaña}</td>
                    <td className="px-4 py-3 font-semibold text-slate-200">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        {dist.ciudad}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-indigo-300 text-sm">
                      {dist.cantidad.toLocaleString('es-MX')}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-200">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                        {dist.responsable}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {dist.tipoRegistro === 'vinculado_archivo' ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold text-[10px] border border-emerald-500/20">
                          Vinculado a archivo
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-medium text-[10px]">
                          Manual (Sin detalle)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400 truncate max-w-xs" title={dist.archivoOrigen}>
                      {dist.archivoOrigen || '—'}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-400 max-w-xs truncate" title={dist.observaciones}>
                      {dist.observaciones || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal New Distribution */}
      {isNewModalOpen && (
        <Modal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          title="Registrar Movimiento de Distribución"
          subtitle="Registra el envío de leads hacia un cliente con responsable y detalles de trazabilidad."
        >
          <form onSubmit={handleSubmitDistribution} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cliente Destinatario *
                </label>
                <select
                  value={formClientId}
                  onChange={(e) => setFormClientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                >
                  <option value="">-- Seleccionar Cliente --</option>
                  {activeClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombreComercial}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Persona Responsable de la Distribución *
                </label>
                <input
                  type="text"
                  value={formResponsible}
                  onChange={(e) => setFormResponsible(e.target.value)}
                  placeholder="Ej: Reina & Frank, Frank, Lic. Carlos"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Fecha de Envío *
                </label>
                <input
                  type="text"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  placeholder="28/09/2026"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Campaña o Producto *
                </label>
                <input
                  type="text"
                  value={formCampaign}
                  onChange={(e) => setFormCampaign(e.target.value)}
                  placeholder="Pensiones"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ciudad *
                </label>
                <select
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  {cityCatalog.map((c) => (
                    <option key={c.canonicalCity} value={c.canonicalCity}>
                      {c.canonicalCity}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cantidad de Leads Enviados *
                </label>
                <input
                  type="number"
                  min="1"
                  value={formQuantity}
                  onChange={(e) => setFormQuantity(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono font-bold text-indigo-300 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            {/* Registration Type: Manual vs Linked to Verifiable File */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Tipo de Registro y Vinculación con Archivos
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormRegType('manual_sin_detalle');
                    setFormDeliveryId('');
                  }}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    formRegType === 'manual_sin_detalle'
                      ? 'bg-indigo-950/30 border-indigo-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="font-bold text-xs block">Registro Manual</span>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Solo se conoce la cantidad enviada; no tiene lista individual de teléfonos.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormRegType('vinculado_archivo')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    formRegType === 'vinculado_archivo'
                      ? 'bg-emerald-950/30 border-emerald-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <span className="font-bold text-xs block">Vinculado a Archivo / Entrega</span>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Conserva la lista exacta y verificable de teléfonos enviados.
                  </span>
                </button>
              </div>
            </div>

            {formRegType === 'vinculado_archivo' && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Seleccionar Entrega / Archivo Generado:
                </label>
                {deliveries.length === 0 ? (
                  <p className="text-xs text-amber-300">
                    No hay entregas exportadas registradas aún para vincular. Puedes guardarlo como registro manual.
                  </p>
                ) : (
                  <select
                    value={formDeliveryId}
                    onChange={(e) => handleDeliverySelect(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 focus:outline-none"
                    required
                  >
                    <option value="">-- Seleccionar Archivo de Entrega --</option>
                    {deliveries.map((del) => (
                      <option key={del.id} value={del.id}>
                        {del.fechaEntrega} — {del.ciudad} — {del.destinatario} ({del.leadsCount} leads, {del.fileName})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Observaciones del Movimiento
              </label>
              <textarea
                value={formObservations}
                onChange={(e) => setFormObservations(e.target.value)}
                rows={2}
                placeholder="Canal de entrega, horario, requerimiento especial..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
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
                Registrar Movimiento
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
