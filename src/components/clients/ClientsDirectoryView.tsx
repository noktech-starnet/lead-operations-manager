import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Edit2,
  Eye,
  Building,
  Phone,
  Mail,
  Calendar,
  Layers,
  History,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { Client, Delivery, LeadDistribution } from '../../types';
import { storageService } from '../../services/storageService';
import { Modal } from '../common/Modal';

interface ClientsDirectoryViewProps {
  clients: Client[];
  deliveries: Delivery[];
  distributions: LeadDistribution[];
  onRefresh: () => void;
  currentUserRole: string;
}

export const ClientsDirectoryView: React.FC<ClientsDirectoryViewProps> = ({
  clients,
  deliveries,
  distributions,
  onRefresh,
  currentUserRole,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'activo' | 'inactivo'>('all');
  const [campaignFilter, setCampaignFilter] = useState('all');

  // Modal create/edit client
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Client deliveries history drawer/modal
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<Client | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCampaigns, setFormCampaigns] = useState('Pensiones');
  const [formContactName, setFormContactName] = useState('');
  const [formContactEmail, setFormContactEmail] = useState('');
  const [formContactPhone, setFormContactPhone] = useState('');
  const [formStatus, setFormStatus] = useState<'activo' | 'inactivo'>('activo');
  const [formObservations, setFormObservations] = useState('');

  // Open create modal
  const handleOpenCreate = () => {
    setEditingClient(null);
    setFormName('');
    setFormCampaigns('Pensiones');
    setFormContactName('');
    setFormContactEmail('');
    setFormContactPhone('');
    setFormStatus('activo');
    setFormObservations('');
    setIsClientModalOpen(true);
  };

  // Open edit modal
  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setFormName(client.nombreComercial);
    setFormCampaigns(client.campañas.join(', '));
    setFormContactName(client.contactoNombre || '');
    setFormContactEmail(client.contactoEmail || '');
    setFormContactPhone(client.contactoTelefono || '');
    setFormStatus(client.estado);
    setFormObservations(client.observaciones || '');
    setIsClientModalOpen(true);
  };

  // Save client
  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const campaignsList = formCampaigns
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const nowIso = new Date().toISOString();
    const today = new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const clientToSave: Client = {
      id: editingClient ? editingClient.id : `cli-${Date.now()}`,
      nombreComercial: formName.trim(),
      campañas: campaignsList.length > 0 ? campaignsList : ['Pensiones'],
      contactoNombre: formContactName.trim() || undefined,
      contactoEmail: formContactEmail.trim() || undefined,
      contactoTelefono: formContactPhone.trim() || undefined,
      estado: formStatus,
      fechaAlta: editingClient ? editingClient.fechaAlta : today,
      observaciones: formObservations.trim() || undefined,
      createdAt: editingClient ? editingClient.createdAt : nowIso,
      updatedAt: nowIso,
    };

    storageService.upsertClient(clientToSave, 'Administrador');
    setIsClientModalOpen(false);
    onRefresh();
  };

  // Filtered clients
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      if (statusFilter !== 'all' && c.estado !== statusFilter) return false;
      if (campaignFilter !== 'all' && !c.campañas.includes(campaignFilter)) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = c.nombreComercial.toLowerCase().includes(term);
        const matchesContact = c.contactoNombre?.toLowerCase().includes(term);
        const matchesCampaign = c.campañas.some((camp) => camp.toLowerCase().includes(term));
        if (!matchesName && !matchesContact && !matchesCampaign) return false;
      }

      return true;
    });
  }, [clients, statusFilter, campaignFilter, searchTerm]);

  // Unique campaigns for filter
  const uniqueCampaigns = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => c.campañas.forEach((camp) => set.add(camp)));
    return Array.from(set);
  }, [clients]);

  // Stats for the client in history modal
  const clientHistoryDeliveries = useMemo(() => {
    if (!selectedClientForHistory) return [];
    return deliveries.filter(
      (d) =>
        d.clienteId === selectedClientForHistory.id ||
        d.destinatario.toLowerCase().includes(selectedClientForHistory.nombreComercial.toLowerCase())
    );
  }, [selectedClientForHistory, deliveries]);

  const clientHistoryDistributions = useMemo(() => {
    if (!selectedClientForHistory) return [];
    return distributions.filter(
      (dist) =>
        dist.clienteId === selectedClientForHistory.id ||
        dist.clienteNombre.toLowerCase().includes(selectedClientForHistory.nombreComercial.toLowerCase())
    );
  }, [selectedClientForHistory, distributions]);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Building className="w-5 h-5 text-indigo-400" />
            <span>Directorio de Clientes y Destinatarios</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Administra los destinatarios a quienes se distribuyen y entregan los leads en cada campaña y plaza.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Cliente</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por cliente, contacto o campaña..."
            className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'activo' | 'inactivo')}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">Todos los estados</option>
            <option value="activo">Solo Activos</option>
            <option value="inactivo">Inactivos</option>
          </select>

          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">Todas las campañas</option>
            {uniqueCampaigns.map((camp) => (
              <option key={camp} value={camp}>
                {camp}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => {
          const clientDelivCount = deliveries
            .filter(
              (d) =>
                d.clienteId === client.id ||
                d.destinatario.toLowerCase().includes(client.nombreComercial.toLowerCase())
            )
            .reduce((sum, d) => sum + d.leadsCount, 0);

          const clientDistCount = distributions
            .filter(
              (dist) =>
                dist.clienteId === client.id ||
                dist.clienteNombre.toLowerCase().includes(client.nombreComercial.toLowerCase())
            )
            .reduce((sum, dist) => sum + dist.cantidad, 0);

          return (
            <div
              key={client.id}
              className={`rounded-2xl border p-5 shadow-lg transition-all space-y-4 ${
                client.estado === 'activo'
                  ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  : 'bg-slate-950/60 border-slate-900 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                    <span>{client.nombreComercial}</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Alta: {client.fechaAlta}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      client.estado === 'activo'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {client.estado === 'activo' ? 'Activo' : 'Inactivo'}
                  </span>

                  <button
                    onClick={() => handleOpenEdit(client)}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title="Editar cliente"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Campaigns */}
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  Campañas / Productos:
                </span>
                <div className="flex flex-wrap gap-1">
                  {client.campañas.map((camp) => (
                    <span
                      key={camp}
                      className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-medium text-indigo-300 flex items-center gap-1"
                    >
                      <Tag className="w-2.5 h-2.5 text-indigo-400" />
                      {camp}
                    </span>
                  ))}
                </div>
              </div>

              {/* Contact info if present */}
              {(client.contactoNombre || client.contactoTelefono || client.contactoEmail) && (
                <div className="text-[11px] text-slate-400 space-y-1 pt-2 border-t border-slate-800/80">
                  {client.contactoNombre && (
                    <div className="text-slate-300 font-medium">Contacto: {client.contactoNombre}</div>
                  )}
                  {client.contactoTelefono && (
                    <div className="flex items-center gap-1 text-slate-400">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{client.contactoTelefono}</span>
                    </div>
                  )}
                  {client.contactoEmail && (
                    <div className="flex items-center gap-1 text-slate-400">
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span>{client.contactoEmail}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Summary of historical deliveries & distributions */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-center">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Distribuidos
                  </span>
                  <span className="text-sm font-bold text-indigo-300">
                    {clientDistCount.toLocaleString('es-MX')} leads
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Entregas Archivo
                  </span>
                  <span className="text-sm font-bold text-emerald-400">
                    {clientDelivCount.toLocaleString('es-MX')} leads
                  </span>
                </div>
              </div>

              {/* History Button */}
              <button
                onClick={() => setSelectedClientForHistory(client)}
                className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <History className="w-3.5 h-3.5 text-indigo-400" />
                <span>Consultar Entregas Históricas</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal Create/Edit Client */}
      {isClientModalOpen && (
        <Modal
          isOpen={isClientModalOpen}
          onClose={() => setIsClientModalOpen(false)}
          title={editingClient ? 'Editar Cliente' : 'Nuevo Cliente Destinatario'}
          subtitle="Administra los datos comerciales y de contacto del destinatario."
        >
          <form onSubmit={handleSaveClient} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nombre Comercial del Cliente *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ej: TKM Reina & Frank"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Campañas / Productos Asociados (Separados por coma) *
              </label>
              <input
                type="text"
                value={formCampaigns}
                onChange={(e) => setFormCampaigns(e.target.value)}
                placeholder="Ej: Pensiones, Retiro Activo"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Persona de Contacto (Opcional)
                </label>
                <input
                  type="text"
                  value={formContactName}
                  onChange={(e) => setFormContactName(e.target.value)}
                  placeholder="Ej: Frank & Reina"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Teléfono de Contacto (Opcional)
                </label>
                <input
                  type="text"
                  value={formContactPhone}
                  onChange={(e) => setFormContactPhone(e.target.value)}
                  placeholder="Ej: +525512345678"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Correo Electrónico (Opcional)
              </label>
              <input
                type="email"
                value={formContactEmail}
                onChange={(e) => setFormContactEmail(e.target.value)}
                placeholder="contacto@cliente.com"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Estado del Cliente
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormStatus('activo')}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                    formStatus === 'activo'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Activo
                </button>
                <button
                  type="button"
                  onClick={() => setFormStatus('inactivo')}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                    formStatus === 'inactivo'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Inactivo (Desactivado)
                </button>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Nota: Desactivar un cliente no elimina su historial ni sus reportes previos.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Observaciones y Especificaciones
              </label>
              <textarea
                value={formObservations}
                onChange={(e) => setFormObservations(e.target.value)}
                rows={2}
                placeholder="Canal preferido, especificaciones de leads..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsClientModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20"
              >
                Guardar Cliente
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* History Modal for Selected Client */}
      {selectedClientForHistory && (
        <Modal
          isOpen={Boolean(selectedClientForHistory)}
          onClose={() => setSelectedClientForHistory(null)}
          title={`Historial de Entregas y Distribución: ${selectedClientForHistory.nombreComercial}`}
          subtitle={`Campañas asociadas: ${selectedClientForHistory.campañas.join(', ')}`}
          maxWidth="4xl"
        >
          <div className="space-y-6">
            {/* Distributions Section */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2">
                Movimientos de Distribución Registrados ({clientHistoryDistributions.length})
              </h4>
              {clientHistoryDistributions.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                  No hay movimientos de distribución registrados para este cliente.
                </div>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 font-semibold">
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Ciudad</th>
                        <th className="px-3 py-2">Campaña</th>
                        <th className="px-3 py-2 text-right">Leads</th>
                        <th className="px-3 py-2">Responsable</th>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2">Observaciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {clientHistoryDistributions.map((dist) => (
                        <tr key={dist.id} className="hover:bg-slate-900/40">
                          <td className="px-3 py-2 font-mono">{dist.fechaEnvio}</td>
                          <td className="px-3 py-2 font-semibold text-slate-100">{dist.ciudad}</td>
                          <td className="px-3 py-2">{dist.campaña}</td>
                          <td className="px-3 py-2 text-right font-bold text-indigo-300 font-mono">
                            {dist.cantidad}
                          </td>
                          <td className="px-3 py-2 text-slate-400">{dist.responsable}</td>
                          <td className="px-3 py-2 text-[10px]">
                            {dist.tipoRegistro === 'vinculado_archivo' ? (
                              <span className="text-emerald-400">Vinculado a archivo</span>
                            ) : (
                              <span className="text-slate-400">Manual</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-[11px] text-slate-400 truncate max-w-xs">
                            {dist.observaciones || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Confirmed deliveries section */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">
                Entregas Confirmadas con Archivo Exportado ({clientHistoryDeliveries.length})
              </h4>
              {clientHistoryDeliveries.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                  No hay entregas vinculadas a archivos exportados aún.
                </div>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 font-semibold">
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Semana</th>
                        <th className="px-3 py-2">Ciudad</th>
                        <th className="px-3 py-2 text-right">Leads</th>
                        <th className="px-3 py-2">Archivo</th>
                        <th className="px-3 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {clientHistoryDeliveries.map((del) => (
                        <tr key={del.id} className="hover:bg-slate-900/40">
                          <td className="px-3 py-2 font-mono">{del.fechaEntrega}</td>
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-400">{del.semanaOperativa}</td>
                          <td className="px-3 py-2 font-semibold text-slate-100">{del.ciudad}</td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-400 font-mono">
                            {del.leadsCount}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-400 truncate max-w-xs">
                            {del.fileName}
                          </td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold text-[10px]">
                              {del.estado}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
