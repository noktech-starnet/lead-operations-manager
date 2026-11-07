import React, { useState, useMemo } from 'react';
import {
  Download,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Clock,
  Layers,
  MapPin,
  Calendar,
  Check,
  Send,
  Eye,
} from 'lucide-react';
import { Lead, ExportFormat, Delivery } from '../../types';
import {
  generateExportFiles,
  triggerDownload,
  getFormattedFilename,
  GeneratedExportFile,
} from '../../utils/exporter';
import { storageService } from '../../services/storageService';

interface ExportsViewProps {
  leads: Lead[];
  preselectedCity?: string;
  onDeliveryCreated?: () => void;
}

export const ExportsView: React.FC<ExportsViewProps> = ({
  leads,
  preselectedCity,
  onDeliveryCreated,
}) => {
  // Cities with valid leads
  const citiesWithValidLeads = useMemo(() => {
    const map = new Map<string, number>();
    leads.forEach((l) => {
      if (l.status === 'accepted' && l.ciudad) {
        map.set(l.ciudad, (map.get(l.ciudad) || 0) + 1);
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  // Initial selected city
  const initialCity =
    preselectedCity || (citiesWithValidLeads.length > 0 ? citiesWithValidLeads[0][0] : 'Monterrey');

  const [selectedCity, setSelectedCity] = useState<string>(initialCity);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [format, setFormat] = useState<ExportFormat>('standard');
  const [fileType, setFileType] = useState<'xlsx' | 'csv'>('xlsx');
  const [campaign, setCampaign] = useState('Pensiones');
  const [batchSplitSize, setBatchSplitSize] = useState<number>(0); // 0 = no split
  const [fechaAlta, setFechaAlta] = useState(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  });

  // Generated files preview
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedExportFile[] | null>(null);
  const [exportedSuccess, setExportedSuccess] = useState<boolean>(false);

  // Quick delivery registration modal/state
  const [showDeliveryModal, setShowDeliveryModal] = useState<boolean>(false);
  const [deliveryRecipient, setDeliveryRecipient] = useState('Call Center Pensiones');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Batches
  const batches = storageService.getBatches();

  // Filter valid leads for this export selection
  const exportableLeads = useMemo(() => {
    return leads.filter((l) => {
      if (l.status !== 'accepted') return false;
      if (selectedCity && l.ciudad.toLowerCase() !== selectedCity.toLowerCase()) return false;
      if (selectedBatchId !== 'all' && l.firstOccurrenceBatchId !== selectedBatchId) return false;
      return true;
    });
  }, [leads, selectedCity, selectedBatchId]);

  // Live preview filename
  const previewFilename = useMemo(() => {
    return getFormattedFilename(selectedCity || 'Export', campaign, fechaAlta, fileType);
  }, [selectedCity, campaign, fechaAlta, fileType]);

  // Handle Export Generation
  const handleGenerateExports = async () => {
    if (exportableLeads.length === 0) return;

    const files = generateExportFiles(
      exportableLeads,
      format,
      selectedCity,
      campaign,
      fechaAlta,
      batchSplitSize,
      fileType
    );


    // Update exportedCount on leads
    const nowIso = new Date().toISOString();
    const leadIds = new Set(exportableLeads.map((l) => l.id));
    const allLeads = storageService.getLeads();

    allLeads.forEach((l) => {
      if (leadIds.has(l.id)) {
        l.exportedCount = (l.exportedCount || 0) + 1;
        l.lastExportedAt = nowIso;
      }
    });
    storageService.saveLeads(allLeads);
    try { await storageService.flush(); } catch { return; }
    setGeneratedFiles(files);
    setExportedSuccess(true);
  };

  // Download all generated files
  const handleDownloadAll = () => {
    if (!generatedFiles) return;
    generatedFiles.forEach((file) => {
      triggerDownload(file.dataBlob, file.filename);
    });
  };

  // Register delivery
  const handleConfirmDelivery = async () => {
    if (!generatedFiles || generatedFiles.length === 0) return;

    // Operational week
    const now = new Date();
    const weekYear = now.getFullYear();
    // Rough week calculation for W41
    const weekNum = 'W41';
    const semanaOperativa = `${weekYear}-${weekNum}`;

    const delivery: Delivery = {
      id: `del-${Date.now()}`,
      batchId: selectedBatchId !== 'all' ? selectedBatchId : undefined,
      ciudad: selectedCity,
      campaña: campaign,
      destinatario: deliveryRecipient,
      fechaEntrega: fechaAlta,
      leadsCount: exportableLeads.length,
      exportedLeadsCount: exportableLeads.length,
      fileName: previewFilename,
      formato: format,
      semanaOperativa,
      observaciones: deliveryNotes,
      estado: 'confirmada',
      leadIds: exportableLeads.map((l) => l.id),
      createdAt: new Date().toISOString(),
    };

    storageService.saveDelivery(delivery);
    try { await storageService.flush(); } catch { return; }
    setShowDeliveryModal(false);
    if (onDeliveryCreated) onDeliveryCreated();
    alert(`¡Entrega de ${delivery.leadsCount} leads registrada exitosamente!`);
  };

  return (
    <div className="space-y-6">
      {/* Export Configuration Card */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-6">
        <div className="border-b border-slate-800/80 pb-4">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-400" />
            <span>Configuración de Exportación</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Genera archivos descargables XLSX o CSV que cumplen rigurosamente con la estructura operativa y las 4 columnas estándar.
          </p>
        </div>

        {/* Configuration grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* City selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Ciudad a Exportar</span>
              <span className="text-[11px] text-emerald-400 font-normal">
                {exportableLeads.length} leads válidos
              </span>
            </label>
            <select
              value={selectedCity}
              onChange={(e) => {
                setSelectedCity(e.target.value);
                setGeneratedFiles(null);
                setExportedSuccess(false);
              }}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              {citiesWithValidLeads.length === 0 ? (
                <option value="">No hay leads válidos en ninguna ciudad</option>
              ) : (
                citiesWithValidLeads.map(([city, count]) => (
                  <option key={city} value={city}>
                    {city} ({count} leads válidos)
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Batch selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Lote de Registros
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => {
                setSelectedBatchId(e.target.value);
                setGeneratedFiles(null);
              }}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Todos los lotes acumulados</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.fechaAlta})
                </option>
              ))}
            </select>
          </div>

          {/* Fecha de Alta */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Fecha de Alta (Columna 'Fecha')</span>
              <span className="text-[10px] text-indigo-400 font-normal">DD/MM/YYYY</span>
            </label>
            <input
              type="text"
              value={fechaAlta}
              onChange={(e) => {
                setFechaAlta(e.target.value);
                setGeneratedFiles(null);
              }}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
              placeholder="09/10/2026"
            />
          </div>

          {/* Campaign Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nombre de Campaña
            </label>
            <input
              type="text"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              placeholder="Pensiones"
            />
          </div>

          {/* Batch split limit */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Tamaño de Lote (Partición)
            </label>
            <select
              value={batchSplitSize}
              onChange={(e) => {
                setBatchSplitSize(parseInt(e.target.value, 10));
                setGeneratedFiles(null);
              }}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value={0}>Sin límite (1 solo archivo completo)</option>
              <option value={1000}>1,000 registros por archivo</option>
              <option value={3000}>3,000 registros por archivo</option>
              <option value={5000}>5,000 registros por archivo</option>
            </select>
          </div>

          {/* File type (.xlsx vs .csv) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Tipo de Archivo
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFileType('xlsx')}
                className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                  fileType === 'xlsx'
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={() => setFileType('csv')}
                className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                  fileType === 'csv'
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                CSV (.csv)
              </button>
            </div>
          </div>
        </div>

        {/* Export Format Selector */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <label className="block text-xs font-semibold text-slate-300">
            Formato de Columnas de Salida
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Standard Format */}
            <div
              onClick={() => {
                setFormat('standard');
                setGeneratedFiles(null);
              }}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                format === 'standard'
                  ? 'bg-indigo-950/40 border-indigo-500 text-slate-100 ring-1 ring-indigo-500'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs">Formato Estándar Oficial</span>
                {format === 'standard' && <Check className="w-4 h-4 text-indigo-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Exactamente 4 columnas en este orden:
              </p>
              <div className="mt-2 font-mono text-[11px] text-indigo-300 bg-slate-900 px-2 py-1 rounded">
                Fecha | Ciudad | Nombre | Teléfono
              </div>
            </div>

            {/* Polaris Format */}
            <div
              onClick={() => {
                setFormat('polaris');
                setGeneratedFiles(null);
              }}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                format === 'polaris'
                  ? 'bg-indigo-950/40 border-indigo-500 text-slate-100 ring-1 ring-indigo-500'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs">Formato Polaris</span>
                {format === 'polaris' && <Check className="w-4 h-4 text-indigo-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Una sola columna de teléfono normalizado:
              </p>
              <div className="mt-2 font-mono text-[11px] text-indigo-300 bg-slate-900 px-2 py-1 rounded">
                phone
              </div>
            </div>

            {/* VAPI Format */}
            <div
              onClick={() => {
                setFormat('vapi');
                setGeneratedFiles(null);
              }}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                format === 'vapi'
                  ? 'bg-indigo-950/40 border-indigo-500 text-slate-100 ring-1 ring-indigo-500'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs">Formato VAPI</span>
                {format === 'vapi' && <Check className="w-4 h-4 text-indigo-400" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Dos columnas para discador y agente de voz:
              </p>
              <div className="mt-2 font-mono text-[11px] text-indigo-300 bg-slate-900 px-2 py-1 rounded">
                phone | Lead_Name
              </div>
            </div>
          </div>
        </div>

        {/* Filename Preview Box */}
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
              Nombre de Archivo Oficial (Conforme a la regla de nomenclatura)
            </span>
            <span className="text-sm font-mono font-bold text-indigo-300 mt-0.5 block">
              {previewFilename}
            </span>
          </div>

          <button
            onClick={handleGenerateExports}
            disabled={exportableLeads.length === 0}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 shrink-0 justify-center"
          >
            <Download className="w-4 h-4" />
            <span>Generar y Previsualizar Archivo ({exportableLeads.length} leads)</span>
          </button>
        </div>
      </div>

      {/* Generated Files & Download Tray */}
      {generatedFiles && generatedFiles.length > 0 && (
        <div className="rounded-2xl bg-indigo-950/30 border border-indigo-500/40 p-6 shadow-xl space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-bold text-white">
                  {generatedFiles.length === 1
                    ? 'Archivo listo para descargar'
                    : `${generatedFiles.length} particiones listas para descargar`}
                </h4>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                Total de leads listos: <strong>{exportableLeads.length}</strong> | Formato: {format.toUpperCase()} ({fileType.toUpperCase()})
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadAll}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Descargar {generatedFiles.length > 1 ? 'Todos los Archivos' : 'Archivo'}</span>
              </button>

              <button
                onClick={() => setShowDeliveryModal(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>Registrar Entrega de este Archivo</span>
              </button>
            </div>
          </div>

          {/* List of generated chunks */}
          <div className="space-y-2 pt-2">
            {generatedFiles.map((f, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span className="font-mono font-bold text-slate-100">{f.filename}</span>
                  <span className="text-slate-400">({f.rowCount} leads)</span>
                </div>

                <button
                  onClick={() => triggerDownload(f.dataBlob, f.filename)}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </button>
              </div>
            ))}
          </div>

          {/* Pre-export Table Sample */}
          <div className="pt-3 border-t border-slate-800/80">
            <span className="text-[11px] font-semibold text-slate-400 block mb-2">
              Muestra de filas en el archivo generado (Primeros 5 registros):
            </span>
            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400">
                    {format === 'standard' && (
                      <>
                        <th className="px-3 py-2 font-mono">Fecha</th>
                        <th className="px-3 py-2">Ciudad</th>
                        <th className="px-3 py-2">Nombre</th>
                        <th className="px-3 py-2 font-mono">Teléfono</th>
                      </>
                    )}
                    {format === 'polaris' && <th className="px-3 py-2 font-mono">phone</th>}
                    {format === 'vapi' && (
                      <>
                        <th className="px-3 py-2 font-mono">phone</th>
                        <th className="px-3 py-2">Lead_Name</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {exportableLeads.slice(0, 5).map((l, i) => (
                    <tr key={i} className="hover:bg-slate-900/40">
                      {format === 'standard' && (
                        <>
                          <td className="px-3 py-2 font-mono text-slate-400">{l.fechaAlta}</td>
                          <td className="px-3 py-2 font-semibold">{l.ciudad}</td>
                          <td className="px-3 py-2">{l.nombre}</td>
                          <td className="px-3 py-2 font-mono text-emerald-400">{l.normalizedPhone}</td>
                        </>
                      )}
                      {format === 'polaris' && (
                        <td className="px-3 py-2 font-mono text-emerald-400">{l.normalizedPhone}</td>
                      )}
                      {format === 'vapi' && (
                        <>
                          <td className="px-3 py-2 font-mono text-emerald-400">{l.normalizedPhone}</td>
                          <td className="px-3 py-2">{l.nombre}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal to Register Delivery right after Export */}
      {showDeliveryModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-400" />
              <span>Registrar Entrega Operativa de Leads</span>
            </h3>
            <p className="text-xs text-slate-400">
              Registra el envío de este archivo al destinatario o cliente para alimentar el Indicador B del Dashboard semanal.
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Destinatario / Cliente / Equipo
                </label>
                <input
                  type="text"
                  value={deliveryRecipient}
                  onChange={(e) => setDeliveryRecipient(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  placeholder="Ej: Call Center Vapi, Dirección Comercial..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Ciudad</span>
                  <span className="font-bold text-slate-100">{selectedCity}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">Leads a Entregar</span>
                  <span className="font-bold text-emerald-400">{exportableLeads.length} leads</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Observaciones de Entrega
                </label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  placeholder="Notas adicionales, canal de entrega, etc..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowDeliveryModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300 hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelivery}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-bold shadow-lg shadow-emerald-600/20"
              >
                Confirmar Registro de Entrega
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
