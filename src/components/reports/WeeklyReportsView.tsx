import { useAuth } from '../auth/AuthGate';
import { canWrite } from '../../services/access';
import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  FileText,
  Calendar,
  Building,
  Printer,
  Download,
  Save,
  CheckCircle,
  Clock,
  Filter,
  Eye,
  Layers,
  ArrowRight,
  Sparkles,
  History,
  AlertTriangle,
} from 'lucide-react';
import { LeadDistribution, Client, WeeklyReport, WeeklyReportRow } from '../../types';
import { storageService } from '../../services/storageService';
import { triggerDownload } from '../../utils/exporter';
import { Modal } from '../common/Modal';

interface WeeklyReportsViewProps {
  distributions: LeadDistribution[];
  clients: Client[];
  weeklyReports: WeeklyReport[];
  onRefresh: () => void;
  currentUserRole: string;
}

export const WeeklyReportsView: React.FC<WeeklyReportsViewProps> = ({
  distributions,
  clients,
  weeklyReports,
  onRefresh,
  currentUserRole,
}) => {
  const canEdit = canWrite(useAuth().profile.roles, 'weeklyReports');
  const [activeTab, setActiveTab] = useState<'generador' | 'historico'>('generador');

  // Generator Filters
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(40);
  const [dateRangeText, setDateRangeText] = useState('28 septiembre - 4 octubre');
  const [reportType, setReportType] = useState<
    'individual_cliente' | 'campaña' | 'ciudad' | 'responsable' | 'consolidado'
  >('individual_cliente');

  const [selectedClientId, setSelectedClientId] = useState<string>(
    clients[0]?.id || 'cli-tkm-reina-frank'
  );
  const [selectedCampaign, setSelectedCampaign] = useState<string>('Pensiones');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedResponsible, setSelectedResponsible] = useState<string>('all');

  // Saved success alert
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Selected historic report for viewing
  const [viewingHistoricReport, setViewingHistoricReport] = useState<WeeklyReport | null>(null);

  // Correction modal state
  const [isCorrectModalOpen, setIsCorrectModalOpen] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionTargetReport, setCorrectionTargetReport] = useState<WeeklyReport | null>(null);

  // Week options
  const weekOptions = [
    { num: 39, label: 'Semana 39 (21 septiembre - 27 septiembre)', range: '21 septiembre - 27 septiembre' },
    { num: 40, label: 'Semana 40 (28 septiembre - 4 octubre)', range: '28 septiembre - 4 octubre' },
    { num: 41, label: 'Semana 41 (05 octubre - 11 octubre)', range: '05 octubre - 11 octubre' },
    { num: 42, label: 'Semana 42 (12 octubre - 18 octubre)', range: '12 octubre - 18 octubre' },
  ];

  const handleWeekChange = (num: number) => {
    setSelectedWeekNum(num);
    const opt = weekOptions.find((w) => w.num === num);
    if (opt) setDateRangeText(opt.range);
  };

  // Helper to format date label for report table (e.g. "28/09/2026" -> "28-sep")
  const formatDateForReport = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length >= 2) {
      const day = parts[0];
      const monthNum = parseInt(parts[1], 10);
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const monthName = months[monthNum - 1] || parts[1];
      return `${day}-${monthName}`;
    }
    return dateStr;
  };

  // Filter distributions matching the selected parameters
  const relevantMovements = useMemo(() => {
    return distributions.filter((d) => {
      // Filter by client if individual report
      if (reportType === 'individual_cliente' && d.clienteId !== selectedClientId) {
        return false;
      }
      // Filter by campaign
      if (selectedCampaign !== 'all' && d.campaña.toLowerCase() !== selectedCampaign.toLowerCase()) {
        return false;
      }
      // Filter by city
      if (selectedCity !== 'all' && d.ciudad.toLowerCase() !== selectedCity.toLowerCase()) {
        return false;
      }
      // Filter by responsible
      if (selectedResponsible !== 'all' && d.responsable.toLowerCase() !== selectedResponsible.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [
    distributions,
    reportType,
    selectedClientId,
    selectedCampaign,
    selectedCity,
    selectedResponsible,
  ]);

  // Aggregate rows: group by date and city
  const generatedRows: WeeklyReportRow[] = useMemo(() => {
    const groupMap = new Map<string, { fecha: string; ciudad: string; cliente?: string; campaña?: string; leads: number }>();

    relevantMovements.forEach((mov) => {
      const dateKey = formatDateForReport(mov.fechaEnvio);
      const groupKey = `${mov.fechaEnvio}_${mov.ciudad}_${mov.clienteNombre}_${mov.campaña}`;

      const existing = groupMap.get(groupKey);
      if (existing) {
        existing.leads += mov.cantidad;
      } else {
        groupMap.set(groupKey, {
          fecha: dateKey,
          ciudad: mov.ciudad,
          cliente: mov.clienteNombre,
          campaña: mov.campaña,
          leads: mov.cantidad,
        });
      }
    });

    return Array.from(groupMap.values());
  }, [relevantMovements]);

  // Total leads in the report
  const totalReportLeads = useMemo(() => {
    return generatedRows.reduce((sum, r) => sum + r.leads, 0);
  }, [generatedRows]);

  // Client info for active report
  const activeClient = clients.find((c) => c.id === selectedClientId);
  const activeClientName = activeClient ? activeClient.nombreComercial : 'TKM Reina & Frank';

  // Filename generator
  const getReportFilename = (extension: 'xlsx' | 'csv'): string => {
    const cleanClient = activeClientName.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanCamp = (selectedCampaign !== 'all' ? selectedCampaign : 'Consolidado').replace(/[^a-zA-Z0-9]/g, '_');
    return `${cleanClient}_${cleanCamp}_Semana_${selectedWeekNum}_${selectedYear}.${extension}`;
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = (reportData = generatedRows, total = totalReportLeads, clientName = activeClientName) => {
    const headerData = [
      [`Semana ${selectedWeekNum} (${dateRangeText})`],
      [`Cliente: ${reportType === 'individual_cliente' ? clientName : 'Consolidado Clientes'}`],
      [`Campaña: ${selectedCampaign.toUpperCase()}`],
      [''],
      ['Fecha', 'Ciudad', 'Leads'],
    ];

    const bodyData = reportData.map((r) => [r.fecha, r.ciudad, r.leads]);
    bodyData.push(['TOTAL', '', total]);

    const fullSheetData = [...headerData, ...bodyData];

    const ws = XLSX.utils.aoa_to_sheet(fullSheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Semana_${selectedWeekNum}`);

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    triggerDownload(blob, getReportFilename('xlsx'));
  };

  // Export to CSV
  const handleExportCsv = (reportData = generatedRows, total = totalReportLeads) => {
    const rows = [
      ['Fecha', 'Ciudad', 'Leads'],
      ...reportData.map((r) => [r.fecha, r.ciudad, String(r.leads)]),
      ['TOTAL', '', String(total)],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, getReportFilename('csv'));
  };

  // Save to Immutable Report History
  const handleSaveToHistory = async () => {
    if (generatedRows.length === 0) {
      alert('No hay movimientos para generar este reporte.');
      return;
    }

    const reportId = `rep-${selectedYear}-W${selectedWeekNum}-${selectedClientId}-${Date.now()}`;
    const newReport: WeeklyReport = {
      id: reportId,
      numeroSemana: selectedWeekNum,
      año: selectedYear,
      semanaOperativa: `${selectedYear}-W${selectedWeekNum}`,
      rangoFechas: dateRangeText,
      tipoReporte: reportType,
      clienteId: reportType === 'individual_cliente' ? selectedClientId : undefined,
      clienteNombre: reportType === 'individual_cliente' ? activeClientName : 'Consolidado General',
      campaña: selectedCampaign,
      filas: generatedRows,
      totalLeads: totalReportLeads,
      generadoPor: 'Reina & Frank (Responsable)',
      generadoEn: new Date().toISOString(),
      estado: 'generado',
    };

    storageService.addWeeklyReport(newReport, 'Responsable Distribución');
    try { await storageService.flush(); } catch { return; }
    setSavedSuccessMsg(`Reporte guardado en histórico inmutable con ID: ${reportId}`);
    setTimeout(() => setSavedSuccessMsg(null), 4000);
    onRefresh();
  };

  // Printable view trigger
  const handlePrintReport = () => {
    window.print();
  };

  // Unique cities from distributions
  const uniqueCities = useMemo(() => {
    const set = new Set<string>();
    distributions.forEach((d) => set.add(d.ciudad));
    return Array.from(set);
  }, [distributions]);

  // Unique responsibles from distributions
  const uniqueResponsibles = useMemo(() => {
    const set = new Set<string>();
    distributions.forEach((d) => set.add(d.responsable));
    return Array.from(set);
  }, [distributions]);

  return (
    <div className="space-y-6">
      {/* Top Navigation Tabs: Generador vs Histórico */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('generador')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'generador'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4 text-indigo-400" />
          <span>Generador de Reportes Semanales</span>
        </button>

        <button
          onClick={() => setActiveTab('historico')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'historico'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4 text-purple-400" />
          <span>Histórico Permanente de Reportes ({weeklyReports.length})</span>
        </button>
      </div>

      {activeTab === 'generador' && (
        <div className="space-y-6">
          {/* Controls Card */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                  <span>Configuración del Reporte Semanal</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Selecciona la semana operativa, cliente y parámetros para agrupar los movimientos registrados.
                </p>
              </div>

              {savedSuccessMsg && (
                <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle className="w-4 h-4" />
                  <span>{savedSuccessMsg}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Semana Operativa *
                </label>
                <select
                  value={selectedWeekNum}
                  onChange={(e) => handleWeekChange(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-semibold focus:outline-none focus:border-indigo-500"
                >
                  {weekOptions.map((w) => (
                    <option key={w.num} value={w.num}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Rango de Fechas
                </label>
                <input
                  type="text"
                  value={dateRangeText}
                  onChange={(e) => setDateRangeText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tipo de Reporte *
                </label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="individual_cliente">Individual por Cliente</option>
                  <option value="campaña">Por Campaña</option>
                  <option value="ciudad">Por Ciudad</option>
                  <option value="responsable">Por Responsable</option>
                  <option value="consolidado">Consolidado Todos los Clientes</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cliente Destinatario
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  disabled={reportType === 'consolidado'}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 disabled:opacity-50 focus:outline-none focus:border-indigo-500"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombreComercial}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Campaña / Producto
                </label>
                <input
                  type="text"
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Filtrar Ciudad (Opcional)
                </label>
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">Todas las ciudades</option>
                  {uniqueCities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Filtrar Responsable (Opcional)
                </label>
                <select
                  value={selectedResponsible}
                  onChange={(e) => setSelectedResponsible(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">Todos los responsables</option>
                  {uniqueResponsibles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleSaveToHistory}
                  disabled={!canEdit || generatedRows.length === 0}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar en Histórico</span>
                </button>
              </div>
            </div>
          </div>

          {/* VISUAL REPORT PREVIEW (Matches reference format) */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8 shadow-2xl space-y-6 max-w-3xl mx-auto print:max-w-none print:shadow-none print:border-none print:p-0">
            {/* Action Bar for Download / Print */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 print:hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Vista Previa Oficial del Reporte
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportExcel()}
                  disabled={generatedRows.length === 0}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar Excel (.xlsx)</span>
                </button>

                <button
                  onClick={() => handleExportCsv()}
                  disabled={generatedRows.length === 0}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>

                <button
                  onClick={handlePrintReport}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / PDF</span>
                </button>
              </div>
            </div>

            {/* Official Report Card Rendering */}
            <div className="space-y-4 bg-slate-950 p-6 rounded-2xl border border-slate-800 print:bg-white print:text-black print:border-black print:p-4">
              {/* Header Badge */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-900/80 to-slate-900 border border-indigo-700/40 text-slate-100 print:bg-gray-100 print:text-black print:border-gray-300">
                <h2 className="text-base font-extrabold tracking-tight">
                  Semana {selectedWeekNum} ({dateRangeText})
                </h2>
              </div>

              {/* Client Ribbon */}
              <div className="px-4 py-2.5 rounded-lg bg-indigo-950/40 border-l-4 border-indigo-500 text-slate-200 print:bg-gray-50 print:text-black">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 print:text-gray-600 block text-[10px]">
                  Cliente Destinatario
                </span>
                <span className="text-sm font-bold text-white print:text-black">
                  {reportType === 'individual_cliente' ? activeClientName : 'Consolidado General de Clientes'}
                </span>
              </div>

              {/* Campaign Ribbon */}
              <div className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 print:bg-gray-50 print:text-black">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Campaña / Producto
                </span>
                <span className="text-xs font-extrabold uppercase text-indigo-300 print:text-black">
                  {selectedCampaign}
                </span>
              </div>

              {/* Table of Movements */}
              <div className="pt-2">
                <span className="text-xs font-bold text-slate-300 block mb-2 print:text-black">
                  Conteo por fecha:
                </span>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 print:border-gray-400 print:bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950 text-slate-300 font-bold print:bg-gray-200 print:text-black">
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Ciudad</th>
                        {reportType === 'consolidado' && <th className="px-4 py-3">Cliente</th>}
                        <th className="px-4 py-3 text-right">Leads</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-slate-200 print:text-black print:divide-gray-300">
                      {generatedRows.length === 0 ? (
                        <tr>
                          <td colSpan={reportType === 'consolidado' ? 4 : 3} className="px-4 py-8 text-center text-slate-400">
                            No se encontraron movimientos registrados para esta combinación de semana, cliente y campaña.
                          </td>
                        </tr>
                      ) : (
                        generatedRows.map((r, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/50 print:hover:bg-transparent">
                            <td className="px-4 py-2.5 font-mono">{r.fecha}</td>
                            <td className="px-4 py-2.5 font-semibold text-slate-100 print:text-black">
                              {r.ciudad}
                            </td>
                            {reportType === 'consolidado' && (
                              <td className="px-4 py-2.5 text-slate-400 print:text-gray-700">{r.cliente}</td>
                            )}
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-300 print:text-black">
                              {r.leads}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {/* TOTAL ROW */}
                    {generatedRows.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-slate-700 bg-slate-950 text-slate-100 font-extrabold text-sm print:bg-gray-100 print:text-black">
                          <td className="px-4 py-3">TOTAL</td>
                          <td className="px-4 py-3"></td>
                          {reportType === 'consolidado' && <td className="px-4 py-3"></td>}
                          <td className="px-4 py-3 text-right font-mono text-emerald-400 print:text-black text-base">
                            {totalReportLeads.toLocaleString('es-MX')}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HISTÓRICO PERMANENTE DE REPORTES */}
      {activeTab === 'historico' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <History className="w-5 h-5 text-purple-400" />
                <span>Histórico Inmutable de Reportes Semanales</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Consulta y descarga copias exactas de reportes generados previamente. Si se registra una corrección posterior, queda documentada sin destruir el dato histórico original.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950">
                    <th className="px-4 py-3">Semana / Año</th>
                    <th className="px-4 py-3">Rango Fechas</th>
                    <th className="px-4 py-3">Cliente / Tipo</th>
                    <th className="px-4 py-3">Campaña</th>
                    <th className="px-4 py-3 text-right font-bold text-indigo-300">Total Leads</th>
                    <th className="px-4 py-3">Generado Por</th>
                    <th className="px-4 py-3">Fecha Generación</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {weeklyReports.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                        <p className="font-semibold text-slate-300">No hay reportes semanales archivados</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Genera un reporte en la pestaña anterior y haz clic en "Guardar en Histórico".
                        </p>
                      </td>
                    </tr>
                  ) : (
                    weeklyReports.map((rep) => (
                      <tr key={rep.id} className="hover:bg-slate-950/40">
                        <td className="px-4 py-3 font-bold text-slate-100">
                          Semana {rep.numeroSemana} ({rep.año})
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{rep.rangoFechas}</td>
                        <td className="px-4 py-3 font-medium text-slate-200">
                          {rep.clienteNombre || 'Consolidado'}
                        </td>
                        <td className="px-4 py-3">{rep.campaña || '—'}</td>
                        <td className="px-4 py-3 text-right font-mono font-extrabold text-emerald-400 text-sm">
                          {rep.totalLeads.toLocaleString('es-MX')}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{rep.generadoPor}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                          {new Date(rep.generadoEn).toLocaleString('es-MX')}
                        </td>
                        <td className="px-4 py-3">
                          {rep.estado === 'corregido' ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-semibold text-[10px] border border-amber-500/20">
                              Corregido ({rep.correcciones?.length})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold text-[10px] border border-emerald-500/20">
                              Original Inmutable
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewingHistoricReport(rep)}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
                              title="Ver reporte exacto"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ver</span>
                            </button>
                            <button
                              onClick={() =>
                                handleExportExcel(rep.filas, rep.totalLeads, rep.clienteNombre || 'Consolidado')
                              }
                              className="p-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300"
                              title="Descargar Excel"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              disabled={!canEdit}
                              onClick={() => {
                                setCorrectionTargetReport(rep);
                                setCorrectionReason('');
                                setIsCorrectModalOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-amber-600/20 text-slate-400 hover:text-amber-300 text-[10px]"
                              title="Registrar corrección documentada"
                            >
                              Corregir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Viewing Historical Report Modal */}
      {viewingHistoricReport && (
        <Modal
          isOpen={Boolean(viewingHistoricReport)}
          onClose={() => setViewingHistoricReport(null)}
          title={`Reporte Histórico: Semana ${viewingHistoricReport.numeroSemana} (${viewingHistoricReport.rangoFechas})`}
          subtitle={`Cliente: ${viewingHistoricReport.clienteNombre} | Campaña: ${viewingHistoricReport.campaña}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-400">Generado por:</span>{' '}
                <strong className="text-slate-200">{viewingHistoricReport.generadoPor}</strong>
              </div>
              <div className="text-slate-400 font-mono text-[11px]">
                {new Date(viewingHistoricReport.generadoEn).toLocaleString('es-MX')}
              </div>
            </div>

            {viewingHistoricReport.correcciones && viewingHistoricReport.correcciones.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200 space-y-1">
                <span className="font-bold flex items-center gap-1 text-amber-300">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Historial de Correcciones Registradas:
                </span>
                {viewingHistoricReport.correcciones.map((corr, cIdx) => (
                  <div key={cIdx} className="text-[11px] text-amber-300/80">
                    • {new Date(corr.fecha).toLocaleString('es-MX')} por {corr.usuario}: "{corr.motivo}" (Total anterior: {corr.totalAnterior})
                  </div>
                ))}
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900 text-slate-300 font-bold">
                    <th className="px-4 py-2.5">Fecha</th>
                    <th className="px-4 py-2.5">Ciudad</th>
                    <th className="px-4 py-2.5 text-right">Leads</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-200">
                  {viewingHistoricReport.filas.map((f, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 font-mono">{f.fecha}</td>
                      <td className="px-4 py-2 font-semibold text-slate-100">{f.ciudad}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-indigo-300">{f.leads}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-700 bg-slate-900 font-extrabold text-sm">
                    <td className="px-4 py-2.5">TOTAL</td>
                    <td className="px-4 py-2.5"></td>
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-400">
                      {viewingHistoricReport.totalLeads}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() =>
                  handleExportExcel(
                    viewingHistoricReport.filas,
                    viewingHistoricReport.totalLeads,
                    viewingHistoricReport.clienteNombre || 'Cliente'
                  )
                }
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar Copia Excel</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Correction Modal */}
      {isCorrectModalOpen && correctionTargetReport && (
        <Modal
          isOpen={isCorrectModalOpen}
          onClose={() => setIsCorrectModalOpen(false)}
          title={`Registrar Corrección: Reporte Semana ${correctionTargetReport.numeroSemana}`}
          subtitle="Documenta el motivo de ajuste sin alterar la trazabilidad del reporte original."
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-300">
              Por requerimiento de auditoría, las correcciones a reportes generados no deben realizarse silenciosamente. Indica el motivo para archivar la enmienda.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Motivo de la Corrección o Ajuste *
              </label>
              <textarea
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                rows={3}
                placeholder="Ej: Se ajustó conteo de Acapulco del 30-sep por acuse de recepción corregido de 36 a 38 leads."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCorrectModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!correctionReason.trim()) {
                    alert('Por favor especifica el motivo de la corrección.');
                    return;
                  }
                  storageService.correctWeeklyReport(
                    correctionTargetReport.id,
                    correctionReason,
                    correctionTargetReport.filas,
                    correctionTargetReport.totalLeads,
                    'Administrador'
                  );
                  setIsCorrectModalOpen(false);
                  onRefresh();
                }}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
              >
                Guardar Enmienda en Histórico
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
