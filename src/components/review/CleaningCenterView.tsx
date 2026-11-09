import React, { useState, useMemo } from 'react';
import {
  CheckCircle,
  XCircle,
  Edit2,
  Eye,
  Filter,
  Search,
  AlertTriangle,
  RotateCcw,
  CheckSquare,
  Square,
  ChevronDown,
  History,
  Phone,
  MapPin,
  User,
  Layers,
  FileText,
  Calendar,
  Plus,
} from 'lucide-react';
import { Lead, LeadStatus, ReviewReason, CityAlias } from '../../types';
import { StatusBadge, ReasonBadge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { Pagination } from '../common/Pagination';
import { storageService } from '../../services/storageService';
import { normalizeMexicanPhone } from '../../utils/phoneNormalizer';
import { cleanAndValidateName } from '../../utils/nameCleaner';

interface CleaningCenterViewProps {
  leads: Lead[];
  cityCatalog: CityAlias[];
  onRefresh: () => void;
  canManageCities: boolean;
}

export const CleaningCenterView: React.FC<CleaningCenterViewProps> = ({
  leads,
  cityCatalog,
  onRefresh,
  canManageCities,
}) => {
  const [isAddingCity, setIsAddingCity] = useState(false);
  const [cityForm, setCityForm] = useState({ name: '', state: '', aliases: '' });
  const [cityError, setCityError] = useState('');
  const openAddCity = () => {
    setCityForm({ name: '', state: '', aliases: '' });
    setCityError('');
    setIsAddingCity(true);
  };
  const handleAddCity = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageCities) return;
    const name = cityForm.name.trim().replace(/\s+/g, ' ');
    const key = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
    const catalog = storageService.getCities();
    if (!name) {
      setCityError('Escribe el nombre de la ciudad.');
      return;
    }
    if (catalog.some(city => key(city.canonicalCity) === key(name))) {
      setCityError('Esta ciudad ya existe en el catálogo. Puedes seleccionarla al editar el lead.');
      return;
    }
    const aliases = Array.from(new Set([name, ...cityForm.aliases.split(',')]
      .map(alias => alias.trim().toUpperCase()).filter(Boolean)));
    try {
      storageService.saveCities([...catalog, {
        id: `city-${crypto.randomUUID()}`, canonicalCity: name,
        state: cityForm.state.trim(), aliases, isActive: true,
      }]);
      if (editingLead) setEditForm(previous => ({ ...previous, ciudad: name }));
      setIsAddingCity(false);
      onRefresh();
    } catch (error) {
      setCityError(error instanceof Error ? error.message : 'No se pudo guardar la ciudad.');
    }
  };

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [batchFilter, setBatchFilter] = useState<string>('all');
  const [hasConflictFilter, setHasConflictFilter] = useState<boolean>(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Selection for bulk actions
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Modals state
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [viewingLeadOccurrences, setViewingLeadOccurrences] = useState<Lead | null>(null);
  const [bulkActionModal, setBulkActionModal] = useState<{
    isOpen: boolean;
    targetStatus: LeadStatus;
    reason: string;
  }>({
    isOpen: false,
    targetStatus: 'accepted',
    reason: 'Aprobación manual verificada',
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    nombre: '',
    phone: '',
    ciudad: '',
    status: 'accepted' as LeadStatus,
    reasonNote: '',
  });

  // Extract unique batches and cities for filters
  const uniqueBatches = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.firstOccurrenceBatchId) set.add(l.firstOccurrenceBatchId);
    });
    return Array.from(set);
  }, [leads]);

  const uniqueCities = useMemo(() => {
    const set = new Set<string>(cityCatalog.map(city => city.canonicalCity));
    leads.forEach((l) => {
      if (l.ciudad) set.add(l.ciudad);
    });
    return Array.from(set).sort();
  }, [leads, cityCatalog]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      // Search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = l.nombre?.toLowerCase().includes(term);
        const matchesPhone = l.normalizedPhone?.toLowerCase().includes(term) || l.rawPhone?.toLowerCase().includes(term);
        const matchesAdset = l.rawAdset?.toLowerCase().includes(term);
        const matchesCity = l.ciudad?.toLowerCase().includes(term);
        if (!matchesName && !matchesPhone && !matchesAdset && !matchesCity) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all' && l.status !== statusFilter) {
        return false;
      }

      // City
      if (cityFilter !== 'all' && l.ciudad !== cityFilter) {
        return false;
      }

      // Reason
      if (reasonFilter !== 'all' && l.reviewReason !== reasonFilter) {
        return false;
      }

      // Batch
      if (batchFilter !== 'all' && l.firstOccurrenceBatchId !== batchFilter) {
        return false;
      }

      // City conflict
      if (hasConflictFilter && !l.cityConflict) {
        return false;
      }

      return true;
    });
  }, [leads, searchTerm, statusFilter, cityFilter, reasonFilter, batchFilter, hasConflictFilter]);

  // Paginated chunk
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLeads.slice(start, start + itemsPerPage);
  }, [filteredLeads, currentPage]);

  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage) || 1;

  // Handle single action accept
  const handleQuickAccept = (lead: Lead) => {
    const updated: Lead = {
      ...lead,
      status: 'accepted',
      reviewReason: 'VALID',
      reviewDetail: 'Aprobado manualmente desde el Centro de Depuración',
    };
    storageService.updateLead(updated, 'ACEPTACION_MANUAL', 'Aprobado por el operador', 'Operador');
    onRefresh();
  };

  // Handle single action reject
  const handleQuickReject = (lead: Lead) => {
    const updated: Lead = {
      ...lead,
      status: 'rejected',
      reviewDetail: 'Rechazado manualmente desde el Centro de Depuración',
    };
    storageService.updateLead(updated, 'RECHAZO_MANUAL', 'Rechazado por el operador', 'Operador');
    onRefresh();
  };

  // Open Edit Modal
  const openEditModal = (lead: Lead) => {
    setEditingLead(lead);
    setEditForm({
      nombre: lead.nombre,
      phone: lead.normalizedPhone || lead.rawPhone,
      ciudad: lead.ciudad,
      status: lead.status,
      reasonNote: lead.reviewDetail || '',
    });
  };

  // Save Edit
  const handleSaveEdit = () => {
    if (!editingLead) return;

    const phoneRes = normalizeMexicanPhone(editForm.phone);
    const nameRes = cleanAndValidateName(editForm.nombre);

    const updated: Lead = {
      ...editingLead,
      nombre: editForm.nombre.trim(),
      normalizedPhone: phoneRes.isValid ? phoneRes.normalized : editingLead.normalizedPhone,
      rawPhone: editForm.phone.trim(),
      ciudad: editForm.ciudad.trim(),
      status: editForm.status,
      reviewDetail: editForm.reasonNote || 'Modificación manual de datos por el operador',
      manualOverride: true,
    };

    if (editForm.status === 'accepted') {
      updated.reviewReason = 'VALID';
    }

    storageService.updateLead(
      updated,
      'EDICION_MANUAL',
      `Campos actualizados: Nombre "${updated.nombre}", Tel "${updated.normalizedPhone}", Cd "${updated.ciudad}". Motivo: ${editForm.reasonNote}`,
      'Operador'
    );

    setEditingLead(null);
    onRefresh();
  };

  // Bulk selection toggles
  const handleToggleSelectAll = () => {
    if (selectedLeadIds.length === paginatedLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(paginatedLeads.map((l) => l.id));
    }
  };

  const handleToggleSelectLead = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Bulk action execution
  const executeBulkAction = () => {
    if (selectedLeadIds.length === 0) return;
    storageService.bulkUpdateLeadStatus(
      selectedLeadIds,
      bulkActionModal.targetStatus,
      bulkActionModal.reason
    );
    setSelectedLeadIds([]);
    setBulkActionModal((prev) => ({ ...prev, isOpen: false }));
    onRefresh();
  };

  return (
    <div className="space-y-5">
      {canManageCities && (
        <div className="flex justify-end">
          <button type="button" onClick={openAddCity} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-bold">
            <Plus className="w-4 h-4" /> Agregar ciudad
          </button>
        </div>
      )}
      {/* Search and Filters Bar */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Buscar por nombre, teléfono, adset o ciudad..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Quick status tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <button
              onClick={() => {
                setStatusFilter('all');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-slate-100 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos ({leads.length})
            </button>
            <button
              onClick={() => {
                setStatusFilter('pending_review');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                statusFilter === 'pending_review'
                  ? 'bg-amber-500/20 text-amber-300 shadow border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pendientes ({leads.filter((l) => l.status === 'pending_review').length})
            </button>
            <button
              onClick={() => {
                setStatusFilter('accepted');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                statusFilter === 'accepted'
                  ? 'bg-emerald-500/20 text-emerald-300 shadow border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Aceptados ({leads.filter((l) => l.status === 'accepted').length})
            </button>
            <button
              onClick={() => {
                setStatusFilter('rejected');
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                statusFilter === 'rejected'
                  ? 'bg-rose-500/20 text-rose-300 shadow border border-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Rechazados ({leads.filter((l) => l.status === 'rejected').length})
            </button>
          </div>
        </div>

        {/* Detailed Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Filtrar por Ciudad
            </label>
            <select
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Todas las Ciudades</option>
              {uniqueCities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Motivo de Validación / Rechazo
            </label>
            <select
              value={reasonFilter}
              onChange={(e) => {
                setReasonFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Todos los Motivos</option>
              <option value="VALID">Válido (Aceptado)</option>
              <option value="NOMBRE_SIN_APELLIDO">Nombre sin apellido</option>
              <option value="APELLIDO_INCOMPLETO">Apellido incompleto / inicial</option>
              <option value="POSIBLE_NEGOCIO">Posible nombre de negocio</option>
              <option value="POSIBLE_PERFIL_O_ANOMALO">Perfil o anómalo</option>
              <option value="CARACTERES_INVALIDOS">Caracteres inválidos / Emojis</option>
              <option value="TELEFONO_INVALIDO">Teléfono inválido</option>
              <option value="TELEFONO_INCOMPLETO">Teléfono incompleto (&lt;10 dígitos)</option>
              <option value="TELEFONO_CARACTERES_NO_NUMERICOS">Teléfono con letras</option>
              <option value="CIUDAD_NO_IDENTIFICADA">Ciudad no identificada</option>
              <option value="CIUDAD_AMBIGUA">Ciudad ambigua</option>
              <option value="CONFLICTO_CIUDADES">Conflicto entre ciudades</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Lote de Origen
            </label>
            <select
              value={batchFilter}
              onChange={(e) => {
                setBatchFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Todos los Lotes</option>
              {uniqueBatches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setHasConflictFilter((prev) => !prev);
                setCurrentPage(1);
              }}
              className={`w-full px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                hasConflictFilter
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-indigo-400" />
              <span>Solo Conflictos de Ciudad</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk actions bar if items selected */}
      {selectedLeadIds.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="font-bold text-indigo-200">
              {selectedLeadIds.length} leads seleccionados
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setBulkActionModal({
                  isOpen: true,
                  targetStatus: 'accepted',
                  reason: 'Aprobación masiva verificada por operador',
                })
              }
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Aceptar Seleccionados</span>
            </button>
            <button
              onClick={() =>
                setBulkActionModal({
                  isOpen: true,
                  targetStatus: 'rejected',
                  reason: 'Rechazo masivo por operador',
                })
              }
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Rechazar Seleccionados</span>
            </button>
            <button
              onClick={() => setSelectedLeadIds([])}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Master Operational Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/80">
                <th className="px-3 py-3 w-10 text-center">
                  <button
                    onClick={handleToggleSelectAll}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    {selectedLeadIds.length === paginatedLeads.length && paginatedLeads.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Nombre</th>
                <th className="px-3 py-3">Teléfono Normalizado</th>
                <th className="px-3 py-3">Tel. Original</th>
                <th className="px-3 py-3">Ciudad Normalizada</th>
                <th className="px-3 py-3">Adset Original</th>
                <th className="px-3 py-3">Fecha Alta</th>
                <th className="px-3 py-3">Motivo / Diagnóstico</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {paginatedLeads.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-300">No se encontraron leads con los filtros actuales</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Ajusta los términos de búsqueda o los selectores de ciudad y estado.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead) => {
                  const isSelected = selectedLeadIds.includes(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-slate-950/40 transition-colors ${
                        isSelected ? 'bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => handleToggleSelectLead(lead.id)}
                          className="text-slate-400 hover:text-slate-200"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Estado */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <StatusBadge status={lead.status} size="sm" />
                        {lead.cityConflict && (
                          <span
                            className="block mt-1 text-[10px] text-indigo-400 font-bold"
                            title={lead.cityConflict.details}
                          >
                            ⚠️ Conflicto Cd.
                          </span>
                        )}
                      </td>

                      {/* Nombre */}
                      <td className="px-3 py-2.5 font-medium text-slate-100 whitespace-nowrap">
                        <div>{lead.nombre || <span className="text-rose-400 italic">Vacío</span>}</div>
                        {lead.nombre !== lead.rawNombre && (
                          <div className="text-[10px] text-slate-400 truncate max-w-xs" title={lead.rawNombre}>
                            Orig: {lead.rawNombre}
                          </div>
                        )}
                      </td>

                      {/* Teléfono Normalizado */}
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                        {lead.normalizedPhone ? (
                          <span className="text-emerald-400 font-semibold">{lead.normalizedPhone}</span>
                        ) : (
                          <span className="text-rose-400 font-bold">INVÁLIDO</span>
                        )}
                      </td>

                      {/* Teléfono Original */}
                      <td className="px-3 py-2.5 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                        {lead.rawPhone}
                      </td>

                      {/* Ciudad Normalizada */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {lead.ciudad ? (
                          <span className="font-semibold text-slate-200 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-indigo-400" />
                            {lead.ciudad}
                          </span>
                        ) : (
                          <span className="text-amber-400 italic">No clasificada</span>
                        )}
                      </td>

                      {/* Adset Original */}
                      <td className="px-3 py-2.5 text-slate-400 text-[11px] truncate max-w-[160px]" title={lead.rawAdset}>
                        {lead.rawAdset || 'N/A'}
                      </td>

                      {/* Fecha Alta */}
                      <td className="px-3 py-2.5 font-mono text-slate-300 whitespace-nowrap text-[11px]">
                        {lead.fechaAlta}
                      </td>

                      {/* Motivo Diagnóstico */}
                      <td className="px-3 py-2.5 max-w-xs">
                        <div className="flex flex-col gap-1">
                          <ReasonBadge reason={lead.reviewReason} />
                          {lead.reviewDetail && (
                            <span className="text-[10px] text-slate-400 line-clamp-1" title={lead.reviewDetail}>
                              {lead.reviewDetail}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {lead.status !== 'accepted' && (
                            <button
                              onClick={() => handleQuickAccept(lead)}
                              className="p-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                              title="Aceptar lead"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {lead.status !== 'rejected' && (
                            <button
                              onClick={() => handleQuickReject(lead)}
                              className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                              title="Rechazar lead"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(lead)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                            title="Editar datos"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setViewingLeadOccurrences(lead)}
                            className="p-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-colors"
                            title="Ver trazabilidad y auditoría"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredLeads.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Edit Lead Modal */}
      {editingLead && !isAddingCity && (
        <Modal
          isOpen={Boolean(editingLead)}
          onClose={() => setEditingLead(null)}
          title="Modificar Registro de Lead"
          subtitle={`Identificador: ${editingLead.id} | Lote: ${editingLead.firstOccurrenceBatchId}`}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nombre del Lead
              </label>
              <input
                type="text"
                value={editForm.nombre}
                onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                placeholder="Nombre y al menos un apellido"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Teléfono (Se normalizará a formato +52XXXXXXXXXX)
              </label>
              <input
                type="text"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                placeholder="+52XXXXXXXXXX o 10 dígitos"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Ciudad Normalizada
              </label>
              <select
                value={editForm.ciudad}
                onChange={(e) => setEditForm({ ...editForm, ciudad: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="">-- Sin Ciudad / Desconocida --</option>
                {cityCatalog.map((c) => (
                  <option key={c.canonicalCity} value={c.canonicalCity}>
                    {c.canonicalCity} ({c.state})
                  </option>
                ))}
              </select>
              {canManageCities && (
                <button type="button" onClick={openAddCity} className="mt-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                  + Agregar ciudad al catálogo
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Estado Operativo
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, status: 'accepted' })}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                    editForm.status === 'accepted'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Aceptado
                </button>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, status: 'pending_review' })}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                    editForm.status === 'pending_review'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  En Revisión
                </button>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, status: 'rejected' })}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                    editForm.status === 'rejected'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Rechazado
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Motivo del Cambio / Observación (Quedará en auditoría)
              </label>
              <textarea
                value={editForm.reasonNote}
                onChange={(e) => setEditForm({ ...editForm, reasonNote: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                placeholder="Indica el motivo de la corrección o autorización manual..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setEditingLead(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-bold transition-colors shadow-lg shadow-indigo-600/20"
              >
                Guardar Cambios y Registrar Auditoría
              </button>
            </div>
          </div>
        </Modal>
      )}

      {isAddingCity && (
        <Modal isOpen onClose={() => setIsAddingCity(false)} title="Agregar nueva ciudad" subtitle="Estará disponible en el catálogo y al editar leads." maxWidth="lg">
          <form onSubmit={handleAddCity} className="space-y-4">
            <div>
              <label htmlFor="new-city-name" className="block text-xs text-slate-300 mb-1">Nombre de la ciudad *</label>
              <input id="new-city-name" autoFocus required value={cityForm.name} onChange={event => setCityForm({ ...cityForm, name: event.target.value })} className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm" placeholder="Ej: Aguascalientes" />
            </div>
            <div>
              <label htmlFor="new-city-state" className="block text-xs text-slate-300 mb-1">Estado</label>
              <input id="new-city-state" value={cityForm.state} onChange={event => setCityForm({ ...cityForm, state: event.target.value })} className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm" placeholder="Ej: Aguascalientes" />
            </div>
            <div>
              <label htmlFor="new-city-aliases" className="block text-xs text-slate-300 mb-1">Alias de adset (separados por comas)</label>
              <input id="new-city-aliases" value={cityForm.aliases} onChange={event => setCityForm({ ...cityForm, aliases: event.target.value })} className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm" placeholder="Ej: AGS, AGUASCALIENTES" />
              <p className="text-xs text-slate-400 mt-1">El nombre de la ciudad se incluye como alias automáticamente para futuras importaciones.</p>
            </div>
            {cityError && <p role="alert" className="text-sm text-rose-400">{cityError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsAddingCity(false)} className="px-4 py-2 rounded-lg bg-slate-800 text-xs">Cancelar</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold">Guardar ciudad</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Occurrences & Audit Trail Modal */}
      {viewingLeadOccurrences && (
        <Modal
          isOpen={Boolean(viewingLeadOccurrences)}
          onClose={() => setViewingLeadOccurrences(null)}
          title="Trazabilidad y Auditoría del Lead"
          subtitle={`Teléfono: ${viewingLeadOccurrences.normalizedPhone || viewingLeadOccurrences.rawPhone} | Nombre: ${viewingLeadOccurrences.nombre}`}
          maxWidth="4xl"
        >
          <div className="space-y-6">
            {/* Occurrences list */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2">
                Apariciones en Fuentes ({viewingLeadOccurrences.occurrences.length})
              </h4>
              <div className="space-y-2">
                {viewingLeadOccurrences.occurrences.map((occ, idx) => (
                  <div
                    key={occ.occurrenceId || idx}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>
                        Archivo: <strong className="text-slate-200">{occ.sourceFile}</strong>
                      </span>
                      <span>{new Date(occ.importedAt).toLocaleString('es-MX')}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-slate-300">
                      <div>
                        <span className="text-slate-400">Adset:</span> {occ.rawAdset}
                      </div>
                      <div>
                        <span className="text-slate-400">Nombre leído:</span> {occ.rawName}
                      </div>
                      <div>
                        <span className="text-slate-400">Teléfono leído:</span> {occ.rawPhone}
                      </div>
                    </div>
                    {occ.createdTime && (
                      <div className="text-[10px] text-slate-400">
                        Marca temporal de origen: {occ.createdTime}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* City Conflict Details if applicable */}
            {viewingLeadOccurrences.cityConflict && (
              <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/40 text-xs text-indigo-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-indigo-300">
                  <AlertTriangle className="w-4 h-4 text-indigo-400" />
                  <span>Conflicto Registrado entre Ciudades</span>
                </div>
                <p>{viewingLeadOccurrences.cityConflict.details}</p>
              </div>
            )}

            {/* Audit History Timeline */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Historial de Acciones y Modificaciones
              </h4>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {viewingLeadOccurrences.reviewHistory?.map((h, hIdx) => (
                  <div
                    key={hIdx}
                    className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs flex items-start justify-between gap-3"
                  >
                    <div>
                      <span className="font-semibold text-slate-200">{h.action}</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">{h.reason}</p>
                    </div>
                    <div className="text-right text-[10px] text-slate-400 shrink-0">
                      <div>{new Date(h.timestamp).toLocaleString('es-MX')}</div>
                      <div>Por: {h.user}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk Action Confirmation Modal */}
      {bulkActionModal.isOpen && (
        <Modal
          isOpen={bulkActionModal.isOpen}
          onClose={() => setBulkActionModal((prev) => ({ ...prev, isOpen: false }))}
          title={`Confirmar Acción Masiva: ${
            bulkActionModal.targetStatus === 'accepted' ? 'Aceptar' : 'Rechazar'
          } ${selectedLeadIds.length} Leads`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-300">
              Esta acción modificará simultáneamente el estado de{' '}
              <strong className="text-white">{selectedLeadIds.length}</strong> registros
              seleccionados. Quedará un registro en la auditoría general.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Motivo de la acción masiva
              </label>
              <input
                type="text"
                value={bulkActionModal.reason}
                onChange={(e) =>
                  setBulkActionModal((prev) => ({ ...prev, reason: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setBulkActionModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeBulkAction}
                className={`px-4 py-2 rounded-lg text-white text-xs font-bold shadow-lg ${
                  bulkActionModal.targetStatus === 'accepted'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                }`}
              >
                Confirmar Acción
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
