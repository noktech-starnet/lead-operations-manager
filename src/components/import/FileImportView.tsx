import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  Layers,
  Sparkles,
  Trash2,
  FileText,
  Clock,
  ChevronDown,
  Table,
} from 'lucide-react';
import { ColumnMapping, ProcessingBatch } from '../../types';
import {
  parseFileForPreview,
  extractRecordsFromFile,
  ParsedSheetPreview,
} from '../../utils/fileParser';
import {
  processAndDeduplicateLeads,
  RawInputRecord,
} from '../../utils/deduplicator';
import { storageService } from '../../services/storageService';
import {
  createSampleMetaAdsWorkbook,
  createPensionesDum8OctWorkbook,
} from '../../utils/sampleDataGenerator';

interface FileImportViewProps {
  onImportComplete: () => void;
  onNavigateToReview: () => void;
}

interface UploadedFileItem {
  id: string;
  file: File;
  preview?: ParsedSheetPreview;
  mapping: ColumnMapping;
  isConfigured: boolean;
  error?: string;
}

export const FileImportView: React.FC<FileImportViewProps> = ({
  onImportComplete,
  onNavigateToReview,
}) => {
  // Format current date as DD/MM/YYYY
  const todayStr = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const [batchName, setBatchName] = useState(`Lote_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`);
  const [fechaAlta, setFechaAlta] = useState(todayStr());
  const [campaign, setCampaign] = useState('Pensiones');
  const [sourceType, setSourceType] = useState<'meta_ads' | 'external_row2' | 'custom'>('meta_ads');

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<{ step: string; percent: number } | null>(null);
  const [lastBatchResult, setLastBatchResult] = useState<ProcessingBatch | null>(null);
  const [selectedFileForConfig, setSelectedFileForConfig] = useState<UploadedFileItem | null>(null);

  // Handle source preset change
  const handleSourceTypeChange = (type: 'meta_ads' | 'external_row2' | 'custom') => {
    setSourceType(type);
    const savedMappings = storageService.getMappings();
    const preset = savedMappings[type];

    if (preset) {
      setUploadedFiles((prev) =>
        prev.map((item) => ({
          ...item,
          mapping: { ...preset },
        }))
      );
    }
  };

  // Add files
  const handleFilesAdded = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newItems: UploadedFileItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const preview = await parseFileForPreview(file);

        // If source is external_row2, force default to row 2 (index 1)
        let initialHeaderRow = preview.detectedHeaderRow;
        if (sourceType === 'external_row2') {
          initialHeaderRow = 1;
        }

        const mapping: ColumnMapping = {
          ...preview.suggestedMapping,
          headerRowIndex: initialHeaderRow,
        };

        const isConfigured = Boolean(
          mapping.adsetColumn && mapping.nameColumn && mapping.phoneColumn
        );

        newItems.push({
          id: `f-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
          file,
          preview,
          mapping,
          isConfigured,
        });
      } catch (err) {
        newItems.push({
          id: `f-${Date.now()}-${i}`,
          file,
          mapping: {
            adsetColumn: '',
            nameColumn: '',
            phoneColumn: '',
            headerRowIndex: 0,
          },
          isConfigured: false,
          error: (err as Error).message || 'Error al analizar el archivo',
        });
      }
    }

    setUploadedFiles((prev) => [...prev, ...newItems]);
    if (newItems.length > 0 && !selectedFileForConfig) {
      setSelectedFileForConfig(newItems[0]);
    }
  };

  // Quick loaders for realistic sample files
  const handleLoadSampleMeta = async () => {
    const blob = createSampleMetaAdsWorkbook();
    const file = new File([blob], 'meta_ads_leads_octubre.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    setBatchName(`Lote_MetaAds_${fechaAlta.replace(/\//g, '')}`);
    setSourceType('meta_ads');
    await handleFilesAdded([file] as unknown as FileList);
  };

  const handleLoadSampleRow2 = async () => {
    const blob = createPensionesDum8OctWorkbook();
    const file = new File([blob], 'pensionesdum8oct.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    setBatchName(`Lote_Externo_Dum8Oct_${fechaAlta.replace(/\//g, '')}`);
    setSourceType('external_row2');
    await handleFilesAdded([file] as unknown as FileList);
  };

  // Remove file
  const handleRemoveFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
    if (selectedFileForConfig?.id === id) {
      setSelectedFileForConfig(null);
    }
  };

  // Update mapping for active file
  const handleUpdateMapping = (field: keyof ColumnMapping, value: string | number) => {
    if (!selectedFileForConfig) return;

    const updatedMapping = {
      ...selectedFileForConfig.mapping,
      [field]: value,
    };

    const isConfigured = Boolean(
      updatedMapping.adsetColumn && updatedMapping.nameColumn && updatedMapping.phoneColumn
    );

    const updatedItem = {
      ...selectedFileForConfig,
      mapping: updatedMapping,
      isConfigured,
    };

    setSelectedFileForConfig(updatedItem);
    setUploadedFiles((prev) =>
      prev.map((item) => (item.id === selectedFileForConfig.id ? updatedItem : item))
    );

    // Save as preset for this source type
    storageService.saveMapping(sourceType, updatedMapping);
  };

  // Process and ingest batch
  const handleProcessBatch = async () => {
    if (uploadedFiles.length === 0) return;

    // Validate that all files have required mappings
    const unconfigured = uploadedFiles.filter((f) => !f.isConfigured);
    if (unconfigured.length > 0) {
      alert(`El archivo "${unconfigured[0].file.name}" requiere configurar las columnas obligatorias (Ciudad, Nombre y Teléfono).`);
      setSelectedFileForConfig(unconfigured[0]);
      return;
    }

    setIsProcessing(true);
    setProcessingProgress({ step: 'Extrayendo registros de los archivos...', percent: 20 });

    try {
      const allExtractedRecords: RawInputRecord[] = [];

      for (let i = 0; i < uploadedFiles.length; i++) {
        const item = uploadedFiles[i];
        setProcessingProgress({
          step: `Leyendo archivo ${i + 1} de ${uploadedFiles.length}: ${item.file.name}...`,
          percent: 20 + Math.round(((i + 1) / uploadedFiles.length) * 30),
        });

        const records = await extractRecordsFromFile(item.file, item.mapping, sourceType);
        allExtractedRecords.push(...records);
      }

      setProcessingProgress({
        step: `Depurando, normalizando y deduplicando ${allExtractedRecords.length} registros...`,
        percent: 65,
      });

      // Small async tick for responsive UI
      await new Promise((r) => setTimeout(r, 150));

      const existingLeadsMap = storageService.getLeadsMap();
      const cityCatalog = storageService.getCities();
      const batchId = `batch-${Date.now()}`;

      const dedupeResult = processAndDeduplicateLeads(
        allExtractedRecords,
        batchId,
        batchName,
        fechaAlta,
        campaign,
        existingLeadsMap,
        cityCatalog
      );

      setProcessingProgress({ step: 'Guardando datos en la base persistente...', percent: 90 });

      // Persist leads
      storageService.saveLeads(dedupeResult.consolidatedLeads);

      // Create batch record
      const newBatch: ProcessingBatch = {
        id: batchId,
        name: batchName,
        fechaAlta,
        campaign,
        sourceType,
        fileNames: uploadedFiles.map((f) => f.file.name),
        totalRowsRead: allExtractedRecords.length,
        totalUniqueLeads: dedupeResult.consolidatedLeads.length,
        acceptedLeadsCount: dedupeResult.acceptedCount,
        pendingReviewCount: dedupeResult.pendingReviewCount,
        rejectedCount: dedupeResult.rejectedCount,
        duplicatesFound: dedupeResult.duplicateCount,
        cityConflictsFound: dedupeResult.cityConflictCount,
        status: 'completado',
        createdAt: new Date().toISOString(),
      };

      storageService.saveBatch(newBatch);
      setLastBatchResult(newBatch);

      setProcessingProgress({ step: '¡Procesamiento completado con éxito!', percent: 100 });
      setUploadedFiles([]);
      setSelectedFileForConfig(null);

      onImportComplete();
    } catch (err) {
      alert(`Error durante el procesamiento: ${(err as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const batches = storageService.getBatches();

  return (
    <div className="space-y-6">
      {/* Batch Header Configuration Card */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Crear Lote de Procesamiento</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Configura los metadatos operativos antes de cargar los archivos Excel o CSV.
              </p>
            </div>
          </div>

          {/* Realistic Test Loaders */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadSampleMeta}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-all"
              title="Cargar archivo de ejemplo con formato Meta Ads"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Probar Meta Ads</span>
            </button>
            <button
              type="button"
              onClick={handleLoadSampleRow2}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition-all"
              title="Cargar archivo de referencia pensionesdum8oct.xlsx con encabezados en fila 2"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
              <span>Probar pensionesdum8oct.xlsx</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nombre del Lote
            </label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              placeholder="Ej: Lote_Semana_41_Pensiones"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Fecha de Alta</span>
              <span className="text-[10px] text-indigo-400 font-normal">Operativa (DD/MM/YYYY)</span>
            </label>
            <input
              type="text"
              value={fechaAlta}
              onChange={(e) => setFechaAlta(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
              placeholder="09/10/2026"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Campaña / Producto
            </label>
            <input
              type="text"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              placeholder="Pensiones"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Tipo de Fuente
            </label>
            <select
              value={sourceType}
              onChange={(e) =>
                handleSourceTypeChange(e.target.value as 'meta_ads' | 'external_row2' | 'custom')
              }
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="meta_ads">Meta Ads (Encabezados en Fila 1)</option>
              <option value="external_row2">Fuente Externa (Encabezados en Fila 2 - pensionesdum8oct)</option>
              <option value="custom">Otra Fuente Externa (Mapeo Personalizado)</option>
            </select>
          </div>
        </div>

        {sourceType === 'external_row2' && (
          <div className="mt-4 p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <strong>Modo pensionesdum8oct.xlsx activo:</strong> La primera fila se tratará como título informativo y se descartará. Los encabezados se leerán automáticamente de la <strong>fila 2</strong>. Las columnas técnicas <code>phone_number_verified</code> y <code>lead_status</code> serán excluidas del archivo de entrega final estándar.
            </div>
          </div>
        )}
      </div>

      {/* Upload Dropzone */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl">
        <label
          htmlFor="file-dropzone"
          className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-indigo-500/60 rounded-xl p-8 cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition-all group"
        >
          <div className="p-4 rounded-2xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-110 transition-transform">
            <UploadCloud className="w-8 h-8" />
          </div>
          <span className="mt-3 text-sm font-bold text-slate-200">
            Arrastra tus archivos XLSX, XLS o CSV aquí
          </span>
          <span className="text-xs text-slate-400 mt-1">
            Puedes seleccionar múltiples archivos para consolidarlos dentro de este mismo lote
          </span>
          <input
            id="file-dropzone"
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFilesAdded(e.target.files)}
            className="hidden"
          />
        </label>

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Archivos en cola para este lote ({uploadedFiles.length})
              </h4>
              <span className="text-xs text-slate-400">
                Haz clic en un archivo para revisar su mapeo y previsualización
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {uploadedFiles.map((item) => {
                const isSelected = selectedFileForConfig?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedFileForConfig(item)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-950/30 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 truncate">
                        <FileSpreadsheet className="w-5 h-5 text-indigo-400 shrink-0" />
                        <div className="truncate">
                          <p className="text-xs font-bold text-slate-200 truncate">{item.file.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {item.preview ? `${item.preview.totalRows} filas detectadas` : 'Cargando...'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile(item.id);
                        }}
                        className="text-slate-400 hover:text-rose-400 p-1"
                        title="Eliminar archivo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">
                        Encabezado: Fila {item.mapping.headerRowIndex + 1}
                      </span>
                      {item.isConfigured ? (
                        <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                          <CheckCircle className="w-3.5 h-3.5" /> Mapeo Listo
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1 font-semibold">
                          <AlertCircle className="w-3.5 h-3.5" /> Configurar
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Column Mapping & Sheet Preview for Selected File */}
      {selectedFileForConfig && selectedFileForConfig.preview && (
        <div className="rounded-2xl bg-slate-900 border border-indigo-500/30 p-6 shadow-xl space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                Configuración de Columnas
              </span>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mt-0.5">
                <span>{selectedFileForConfig.file.name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-normal">
                  Hoja: {selectedFileForConfig.preview.sheetName}
                </span>
              </h3>
            </div>

            {/* Header row selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-300 font-semibold">
                Fila de Encabezados:
              </label>
              <select
                value={selectedFileForConfig.mapping.headerRowIndex}
                onChange={(e) =>
                  handleUpdateMapping('headerRowIndex', parseInt(e.target.value, 10))
                }
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value={0}>Fila 1 (Estándar)</option>
                <option value={1}>Fila 2 (Ignorar título de reporte - pensionesdum8oct)</option>
                <option value={2}>Fila 3</option>
                <option value={3}>Fila 4</option>
              </select>
            </div>
          </div>

          {/* Mapping dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>Columna de Ciudad / Adset *</span>
                <span className="text-[10px] text-slate-400 font-normal">Para normalizar ciudad</span>
              </label>
              <select
                value={selectedFileForConfig.mapping.adsetColumn}
                onChange={(e) => handleUpdateMapping('adsetColumn', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg bg-slate-950 border text-xs focus:outline-none ${
                  selectedFileForConfig.mapping.adsetColumn
                    ? 'border-slate-800 text-slate-100'
                    : 'border-amber-500/50 text-amber-300'
                }`}
              >
                <option value="">-- Seleccionar Columna --</option>
                {selectedFileForConfig.preview.availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>Columna de Nombre Completo *</span>
                <span className="text-[10px] text-slate-400 font-normal">Para depurar y apellidos</span>
              </label>
              <select
                value={selectedFileForConfig.mapping.nameColumn}
                onChange={(e) => handleUpdateMapping('nameColumn', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg bg-slate-950 border text-xs focus:outline-none ${
                  selectedFileForConfig.mapping.nameColumn
                    ? 'border-slate-800 text-slate-100'
                    : 'border-amber-500/50 text-amber-300'
                }`}
              >
                <option value="">-- Seleccionar Columna --</option>
                {selectedFileForConfig.preview.availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>Columna de Teléfono *</span>
                <span className="text-[10px] text-slate-400 font-normal">Para normalizar +52</span>
              </label>
              <select
                value={selectedFileForConfig.mapping.phoneColumn}
                onChange={(e) => handleUpdateMapping('phoneColumn', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg bg-slate-950 border text-xs focus:outline-none ${
                  selectedFileForConfig.mapping.phoneColumn
                    ? 'border-slate-800 text-slate-100'
                    : 'border-amber-500/50 text-amber-300'
                }`}
              >
                <option value="">-- Seleccionar Columna --</option>
                {selectedFileForConfig.preview.availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Raw Sheet Preview Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-indigo-400" />
                Previsualización de filas del archivo (Primeras 8 filas reales)
              </span>
              <span className="text-[11px] text-slate-400">
                Fila destacada en azul es la fila de encabezados seleccionada
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 max-h-56">
              <table className="w-full text-left border-collapse text-[11px]">
                <tbody>
                  {selectedFileForConfig.preview.rawRows.slice(0, 8).map((row, rIdx) => {
                    const isHeaderRow = rIdx === selectedFileForConfig.mapping.headerRowIndex;
                    return (
                      <tr
                        key={rIdx}
                        className={`border-b border-slate-800/60 ${
                          isHeaderRow
                            ? 'bg-indigo-950/40 text-indigo-200 font-bold'
                            : 'hover:bg-slate-900/50 text-slate-300'
                        }`}
                      >
                        <td className="px-3 py-2 text-slate-400 font-mono text-[10px] border-r border-slate-800/80 w-12">
                          #{rIdx + 1}
                        </td>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-3 py-2 whitespace-nowrap max-w-xs truncate">
                            {cell !== null && cell !== undefined ? String(cell) : ''}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation & Processing Button */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-indigo-950/20 border border-indigo-500/30">
          <div>
            <h4 className="text-sm font-bold text-slate-100">¿Listo para procesar el lote?</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Se ejecutarán automáticamente la depuración de nombres, normalización +52 de teléfonos, clasificación por ciudad y deduplicación.
            </p>
          </div>

          <button
            onClick={handleProcessBatch}
            disabled={isProcessing || uploadedFiles.some((f) => !f.isConfigured)}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 shrink-0"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Procesando...</span>
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4" />
                <span>Confirmar y Procesar Lote</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Progress status */}
      {isProcessing && processingProgress && (
        <div className="rounded-xl bg-slate-900 border border-indigo-500/40 p-4 space-y-2">
          <div className="flex justify-between text-xs font-medium text-slate-300">
            <span>{processingProgress.step}</span>
            <span>{processingProgress.percent}%</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${processingProgress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Last Processed Result Card */}
      {lastBatchResult && (
        <div className="rounded-2xl bg-emerald-950/20 border border-emerald-500/30 p-6 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <h4 className="text-sm font-bold text-emerald-200">
                  Lote "{lastBatchResult.name}" procesado con éxito
                </h4>
                <p className="text-xs text-emerald-400/80">
                  Fecha de alta asignada: {lastBatchResult.fechaAlta} | Campaña: {lastBatchResult.campaign}
                </p>
              </div>
            </div>
            <button
              onClick={onNavigateToReview}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <span>Ir al Centro de Depuración</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="block text-[10px] text-slate-400 uppercase font-semibold">Leídos</span>
              <span className="text-lg font-bold text-slate-100">{lastBatchResult.totalRowsRead}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="block text-[10px] text-emerald-400 uppercase font-semibold">Aceptados</span>
              <span className="text-lg font-bold text-emerald-400">{lastBatchResult.acceptedLeadsCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="block text-[10px] text-amber-400 uppercase font-semibold">En Revisión</span>
              <span className="text-lg font-bold text-amber-400">{lastBatchResult.pendingReviewCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="block text-[10px] text-rose-400 uppercase font-semibold">Rechazados</span>
              <span className="text-lg font-bold text-rose-400">{lastBatchResult.rejectedCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="block text-[10px] text-blue-400 uppercase font-semibold">Duplicados</span>
              <span className="text-lg font-bold text-blue-400">{lastBatchResult.duplicatesFound}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="block text-[10px] text-indigo-400 uppercase font-semibold">Conflictos Cd.</span>
              <span className="text-lg font-bold text-indigo-400">{lastBatchResult.cityConflictsFound}</span>
            </div>
          </div>
        </div>
      )}

      {/* Past Batches History Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-bold text-slate-100">Historial de Lotes Importados ({batches.length})</h4>
          </div>
        </div>

        {batches.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No hay lotes importados aún. Utiliza los botones "Probar Meta Ads" o "Probar pensionesdum8oct.xlsx" para cargar los primeros datos.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-900/60">
                  <th className="px-4 py-3">Nombre del Lote</th>
                  <th className="px-4 py-3">Fecha de Alta</th>
                  <th className="px-4 py-3">Fuente</th>
                  <th className="px-4 py-3">Archivos</th>
                  <th className="px-4 py-3">Filas Leídas</th>
                  <th className="px-4 py-3 text-emerald-400">Válidos</th>
                  <th className="px-4 py-3 text-amber-400">En Revisión</th>
                  <th className="px-4 py-3 text-rose-400">Rechazados</th>
                  <th className="px-4 py-3">Duplicados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-900/40 text-slate-300">
                    <td className="px-4 py-3 font-semibold text-slate-100">{b.name}</td>
                    <td className="px-4 py-3 font-mono">{b.fechaAlta}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300">
                        {b.sourceType === 'meta_ads'
                          ? 'Meta Ads'
                          : b.sourceType === 'external_row2'
                          ? 'Fila 2 (Dum)'
                          : 'Personalizado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 truncate max-w-xs">
                      {b.fileNames.join(', ')}
                    </td>
                    <td className="px-4 py-3 font-semibold">{b.totalRowsRead.toLocaleString('es-MX')}</td>
                    <td className="px-4 py-3 text-emerald-400 font-bold">{b.acceptedLeadsCount}</td>
                    <td className="px-4 py-3 text-amber-400 font-bold">{b.pendingReviewCount}</td>
                    <td className="px-4 py-3 text-rose-400 font-bold">{b.rejectedCount}</td>
                    <td className="px-4 py-3 text-blue-400">{b.duplicatesFound}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
