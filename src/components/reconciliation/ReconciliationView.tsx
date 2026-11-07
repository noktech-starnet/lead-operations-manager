import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  FileCheck2,
  UploadCloud,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  Layers,
  ArrowRight,
  Sparkles,
  HelpCircle,
  History,
  Building,
  Calendar,
  Percent,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Delivery, ReconciliationResult, Lead } from '../../types';
import { normalizeMexicanPhone } from '../../utils/phoneNormalizer';
import { storageService } from '../../services/storageService';
import { triggerDownload } from '../../utils/exporter';
import { Modal } from '../common/Modal';

interface ReconciliationViewProps {
  deliveries: Delivery[];
  reconciliations: ReconciliationResult[];
  leads: Lead[];
  onRefresh: () => void;
  currentUserRole: string;
}

export const ReconciliationView: React.FC<ReconciliationViewProps> = ({
  deliveries,
  reconciliations,
  leads,
  onRefresh,
  currentUserRole,
}) => {
  const [activeTab, setActiveTab] = useState<'nueva' | 'historico'>('nueva');

  // Step 1: Selection of deliveries
  const [selectedWeek, setSelectedWeek] = useState('2026-W41');
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [selectedCampaign, setSelectedCampaign] = useState('all');
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<string[]>([]);

  // Step 2: Dump file
  const [dumpFile, setDumpFile] = useState<File | null>(null);
  const [dumpHeaders, setDumpHeaders] = useState<string[]>([]);
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
  const [rawDumpRows, setRawDumpRows] = useState<(string | number | null | undefined)[][]>([]);

  // Column mapping for dump
  const [phoneCol, setPhoneCol] = useState('');
  const [nameCol, setNameCol] = useState('');
  const [cityCol, setCityCol] = useState('');
  const [externalIdCol, setExternalIdCol] = useState('');

  // Step 3: Execution and Active Result
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeResult, setActiveResult] = useState<ReconciliationResult | null>(null);
  const [selectedDetailTab, setSelectedDetailTab] = useState<
    'resumen' | 'coincidencias' | 'faltantes' | 'no_identificados' | 'duplicados' | 'invalidos' | 'discrepancias'
  >('resumen');

  // Unique delivery filters
  const uniqueWeeks = useMemo(() => {
    const set = new Set<string>();
    deliveries.forEach((d) => set.add(d.semanaOperativa));
    return Array.from(set).sort();
  }, [deliveries]);

  const uniqueProviders = useMemo(() => {
    const set = new Set<string>();
    deliveries.forEach((d) => set.add(d.destinatario));
    return Array.from(set);
  }, [deliveries]);

  const uniqueCampaigns = useMemo(() => {
    const set = new Set<string>();
    deliveries.forEach((d) => set.add(d.campaña));
    return Array.from(set);
  }, [deliveries]);

  // Filtered deliveries for step 1
  const availableDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      if (selectedWeek !== 'all' && d.semanaOperativa !== selectedWeek) return false;
      if (selectedProvider !== 'all' && d.destinatario !== selectedProvider) return false;
      if (selectedCampaign !== 'all' && d.campaña !== selectedCampaign) return false;
      return true;
    });
  }, [deliveries, selectedWeek, selectedProvider, selectedCampaign]);

  // Leads/Phones map sent in the selected deliveries
  const selectedDeliveriesSentPhonesMap = useMemo(() => {
    const map = new Map<string, { phone: string; deliveryId: string; ciudad: string; fechaEnvio: string }>();
    const leadsMap = storageService.getLeadsMap();

    selectedDeliveryIds.forEach((delId) => {
      const del = deliveries.find((d) => d.id === delId);
      if (!del) return;

      // Check if delivery has detailed phone list
      if (del.leadIds && del.leadIds.length > 0) {
        del.leadIds.forEach((leadIdOrPhone) => {
          // Could be ID or normalized phone
          const lead = leadsMap.get(leadIdOrPhone);
          const normPhone = lead?.normalizedPhone || (leadIdOrPhone.startsWith('+52') ? leadIdOrPhone : null);
          if (normPhone) {
            map.set(normPhone, {
              phone: normPhone,
              deliveryId: del.id,
              ciudad: del.ciudad,
              fechaEnvio: del.fechaEntrega,
            });
          }
        });
      }
    });

    return map;
  }, [selectedDeliveryIds, deliveries]);

  // Check if any selected delivery is missing individual phone detail
  const uncomparableDeliveriesCount = useMemo(() => {
    return selectedDeliveryIds.filter((delId) => {
      const del = deliveries.find((d) => d.id === delId);
      return !del || !del.leadIds || del.leadIds.length === 0;
    }).length;
  }, [selectedDeliveryIds, deliveries]);

  // Toggle delivery selection
  const handleToggleDelivery = (id: string) => {
    setSelectedDeliveryIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllDeliveries = () => {
    if (selectedDeliveryIds.length === availableDeliveries.length) {
      setSelectedDeliveryIds([]);
    } else {
      setSelectedDeliveryIds(availableDeliveries.map((d) => d.id));
    }
  };

  // Dump file uploaded
  const handleDumpFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDumpFile(file);
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheet, {
        header: 1,
        defval: '',
        blankrows: false,
      });

      setRawDumpRows(rawRows.slice(0, 10));

      // Heuristic for header row
      let detectedHeaderIdx = 0;
      if (rawRows.length > 1) {
        const row0 = (rawRows[0] || []).filter(Boolean);
        const row1 = (rawRows[1] || []).filter(Boolean);
        if (row0.length <= 2 && row1.length > 2) {
          detectedHeaderIdx = 1;
        }
      }

      setHeaderRowIdx(detectedHeaderIdx);

      const headerRow = (rawRows[detectedHeaderIdx] || []).map((c, i) => String(c || `Columna_${i + 1}`).trim());
      setDumpHeaders(headerRow);

      // Auto-suggest columns
      headerRow.forEach((col) => {
        const norm = col.toLowerCase().replace(/[^a-z0-9]/g, '_');
        if (!phoneCol && (norm.includes('phone') || norm.includes('tel') || norm.includes('celular') || norm.includes('numero'))) {
          setPhoneCol(col);
        }
        if (!nameCol && (norm.includes('name') || norm.includes('nombre') || norm.includes('lead'))) {
          setNameCol(col);
        }
        if (!cityCol && (norm.includes('city') || norm.includes('ciudad') || norm.includes('plaza') || norm.includes('adset'))) {
          setCityCol(col);
        }
      });
    } catch (err) {
      alert(`Error al leer el archivo dump: ${(err as Error).message}`);
    }
  };

  // Quick Load Realistic Provider Dump for Testing
  const handleLoadSampleDump = () => {
    // Generate realistic sample dump matching some sent leads
    const sentPhones = Array.from(selectedDeliveriesSentPhonesMap.keys());
    const matchedCount = Math.min(sentPhones.length, 3);
    const matchedPhones = sentPhones.slice(0, matchedCount);

    const rows: (string | number)[][] = [
      ['DUMP SEMANAL PROVEEDOR EXTERNO - RETORNO CALL CENTER', '', '', '', ''],
      ['phone_number', 'full_name', 'ciudad', 'status_contacto', 'fecha_llamada'],
    ];

    // 1. Matched leads
    matchedPhones.forEach((phone, idx) => {
      rows.push([phone, `Lead Contactado ${idx + 1}`, 'Acapulco', 'INTERESADO', '2026-10-09']);
    });

    // 2. Duplicate inside dump
    if (matchedPhones.length > 0) {
      rows.push([matchedPhones[0], 'Lead Contactado 1 (Reintento)', 'Acapulco', 'VOLVER_A_LLAMAR', '2026-10-09']);
    }

    // 3. Unidentified phone (in dump but was never sent)
    rows.push(['+525599887766', 'Prospecto Externo Desconocido', 'CDMX', 'NUEVO', '2026-10-09']);
    rows.push(['p:8112349988', 'Cliente No Registrado', 'Monterrey', 'CONTACTADO', '2026-10-09']);

    // 4. Invalid phone
    rows.push(['12345', 'Numero Invalido Corto', 'Puebla', 'NO_CONTESTA', '2026-10-09']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dump_Retorno');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const file = new File([blob], 'dump_proveedor_semana41.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const fakeEvent = {
      target: { files: [file] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    handleDumpFileChange(fakeEvent);
  };

  // Run Reconciliation Engine
  const handleExecuteReconciliation = async () => {
    if (selectedDeliveryIds.length === 0) {
      alert('Debes seleccionar al menos una entrega confirmada para comparar.');
      return;
    }

    if (!dumpFile || !phoneCol) {
      alert('Debes cargar un archivo dump y seleccionar la columna de teléfono.');
      return;
    }

    setIsProcessing(true);

    try {
      // Parse entire dump
      const data = await dumpFile.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const allRows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(sheet, {
        header: 1,
        defval: '',
        blankrows: false,
      });

      const headerRow = allRows[headerRowIdx] || [];
      const colMap = new Map<string, number>();
      headerRow.forEach((c, i) => colMap.set(String(c).trim(), i));

      const phoneIdx = colMap.get(phoneCol) ?? -1;
      const nameIdx = nameCol ? colMap.get(nameCol) ?? -1 : -1;
      const cityIdx = cityCol ? colMap.get(cityCol) ?? -1 : -1;

      if (phoneIdx === -1) {
        throw new Error(`No se encontró la columna de teléfono "${phoneCol}"`);
      }

      // 1. Data structures for results
      const sentMap = new Map(selectedDeliveriesSentPhonesMap);
      const dumpPhonesMap = new Map<string, { count: number; rawRows: any[] }>();
      const invalidDumpRecords: { rawPhone: string; motivo: string; filaIndex: number }[] = [];

      for (let r = headerRowIdx + 1; r < allRows.length; r++) {
        const row = allRows[r];
        if (!row || row.length === 0) continue;

        const rawPhone = String(row[phoneIdx] || '').trim();
        if (!rawPhone) continue;

        const rawName = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
        const rawCity = cityIdx !== -1 ? String(row[cityIdx] || '').trim() : '';

        // Normalize using exact same Mexican phone normalizer
        const normRes = normalizeMexicanPhone(rawPhone);

        if (!normRes.isValid) {
          invalidDumpRecords.push({
            rawPhone,
            motivo: normRes.rejectionReason || 'No cumple formato mexicano de 10 dígitos',
            filaIndex: r + 1,
          });
        } else {
          const norm = normRes.normalized;
          const existing = dumpPhonesMap.get(norm);
          if (existing) {
            existing.count++;
            existing.rawRows.push({ rawName, rawCity, rowIdx: r + 1 });
          } else {
            dumpPhonesMap.set(norm, {
              count: 1,
              rawRows: [{ rawName, rawCity, rowIdx: r + 1 }],
            });
          }
        }
      }

      // 2. Classify: Coincidencias, Faltantes, No identificados, Duplicados, Discrepancias
      const coincidencias: any[] = [];
      const faltantes: any[] = [];
      const noIdentificados: any[] = [];
      const duplicados: any[] = [];
      const discrepancias: any[] = [];

      // Check sent leads against dump
      sentMap.forEach((sentInfo, sentPhone) => {
        const dumpMatch = dumpPhonesMap.get(sentPhone);
        if (dumpMatch) {
          const firstDumpRow = dumpMatch.rawRows[0];
          coincidencias.push({
            phone: sentPhone,
            nombreDump: firstDumpRow?.rawName,
            ciudadEnviada: sentInfo.ciudad,
            ciudadDump: firstDumpRow?.rawCity,
            deliveryId: sentInfo.deliveryId,
          });

          // Discrepancy check on city if available
          if (
            firstDumpRow?.rawCity &&
            sentInfo.ciudad &&
            firstDumpRow.rawCity.toLowerCase() !== sentInfo.ciudad.toLowerCase()
          ) {
            discrepancias.push({
              phone: sentPhone,
              campo: 'Ciudad',
              valorEnviado: sentInfo.ciudad,
              valorDump: firstDumpRow.rawCity,
            });
          }
        } else {
          faltantes.push({
            phone: sentPhone,
            ciudad: sentInfo.ciudad,
            deliveryId: sentInfo.deliveryId,
            fechaEnvio: sentInfo.fechaEnvio,
          });
        }
      });

      // Check dump leads that were NOT in sentMap
      dumpPhonesMap.forEach((dumpInfo, dumpPhone) => {
        if (!sentMap.has(dumpPhone)) {
          const firstDumpRow = dumpInfo.rawRows[0];
          noIdentificados.push({
            phone: dumpPhone,
            nombre: firstDumpRow?.rawName,
            ciudad: firstDumpRow?.rawCity,
          });
        }

        // Duplicate inside dump check
        if (dumpInfo.count > 1) {
          duplicados.push({
            phone: dumpPhone,
            repeticiones: dumpInfo.count,
            nombres: dumpInfo.rawRows.map((r) => r.rawName).filter(Boolean),
          });
        }
      });

      // 3. Compute indicators
      const totalEnviadosComparables = sentMap.size;
      const totalDumpValidos = dumpPhonesMap.size;
      const coincidenciasCount = coincidencias.length;
      const tasaCoincidencia =
        totalEnviadosComparables > 0
          ? Math.round((coincidenciasCount / totalEnviadosComparables) * 100)
          : null;

      const providerLabel = selectedProvider !== 'all' ? selectedProvider : 'Proveedor Externo';

      const recResult: ReconciliationResult = {
        id: `rec-${Date.now()}`,
        semanaOperativa: selectedWeek,
        proveedor: providerLabel,
        campaña: selectedCampaign !== 'all' ? selectedCampaign : 'Pensiones',
        deliveryIds: selectedDeliveryIds,
        dumpFileName: dumpFile.name,
        totalEnviadosComparables,
        totalDumpValidos,
        coincidenciasCount,
        faltantesCount: faltantes.length,
        noIdentificadosCount: noIdentificados.length,
        duplicadosDumpCount: duplicados.length,
        invalidosDumpCount: invalidDumpRecords.length,
        discrepanciasCount: discrepancias.length,
        tasaCoincidencia,
        detalles: {
          coincidencias,
          faltantes,
          noIdentificados,
          duplicados,
          invalidos: invalidDumpRecords,
          discrepancias,
        },
        fechaEjecucion: new Date().toISOString(),
        ejecutadoPor: 'Responsable Conciliación',
      };

      storageService.addReconciliation(recResult);
      setActiveResult(recResult);
      onRefresh();
    } catch (err) {
      alert(`Error en la conciliación: ${(err as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Export 7-sheet Excel file (.xlsx)
  const handleExport7SheetExcel = (result: ReconciliationResult) => {
    const wb = XLSX.utils.book_new();

    // 1. Resumen Sheet
    const resumenData = [
      ['REPORTE DE CONCILIACIÓN SEMANAL DE LEADS'],
      ['Semana Operativa:', result.semanaOperativa],
      ['Proveedor / Destinatario:', result.proveedor],
      ['Campaña:', result.campaña],
      ['Archivo Dump:', result.dumpFileName],
      ['Fecha de Ejecución:', new Date(result.fechaEjecucion).toLocaleString('es-MX')],
      ['Ejecutado Por:', result.ejecutadoPor],
      [''],
      ['INDICADORES CLAVE', 'CANTIDAD'],
      ['Total Leads Enviados Comparables (Entregas Seleccionadas)', result.totalEnviadosComparables],
      ['Total Teléfonos Válidos Únicos en Dump', result.totalDumpValidos],
      ['Coincidencias Únicas (Enviados encontrados en Dump)', result.coincidenciasCount],
      ['Enviados que NO aparecen en Dump (Faltantes)', result.faltantesCount],
      ['No identificados como enviados (En Dump pero no enviados)', result.noIdentificadosCount],
      ['Duplicados dentro del Dump', result.duplicadosDumpCount],
      ['Registros Inválidos en Dump', result.invalidosDumpCount],
      ['Discrepancias detectadas', result.discrepanciasCount],
      ['Tasa de Coincidencia (%)', result.tasaCoincidencia !== null ? `${result.tasaCoincidencia}%` : 'N/A'],
    ];
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(wb, wsResumen, '1_Resumen');

    // 2. Coincidencias Sheet
    const coincData = [
      ['Teléfono Normalizado', 'Ciudad Enviada', 'Ciudad en Dump', 'Nombre en Dump', 'ID Entrega'],
      ...result.detalles.coincidencias.map((c) => [
        c.phone,
        c.ciudadEnviada || '',
        c.ciudadDump || '',
        c.nombreDump || '',
        c.deliveryId || '',
      ]),
    ];
    const wsCoinc = XLSX.utils.aoa_to_sheet(coincData);
    XLSX.utils.book_append_sheet(wb, wsCoinc, '2_Coincidencias');

    // 3. Faltantes Sheet
    const faltData = [
      ['Teléfono Enviado Faltante', 'Ciudad', 'ID Entrega Origen', 'Fecha de Envío'],
      ...result.detalles.faltantes.map((f) => [
        f.phone,
        f.ciudad || '',
        f.deliveryId || '',
        f.fechaEnvio || '',
      ]),
    ];
    const wsFalt = XLSX.utils.aoa_to_sheet(faltData);
    XLSX.utils.book_append_sheet(wb, wsFalt, '3_Faltantes');

    // 4. No Identificados Sheet
    const noIdentData = [
      ['Teléfono en Dump', 'Nombre en Dump', 'Ciudad en Dump'],
      ...result.detalles.noIdentificados.map((n) => [n.phone, n.nombre || '', n.ciudad || '']),
    ];
    const wsNoIdent = XLSX.utils.aoa_to_sheet(noIdentData);
    XLSX.utils.book_append_sheet(wb, wsNoIdent, '4_No_Identificados');

    // 5. Duplicados Sheet
    const dupData = [
      ['Teléfono', 'Repeticiones en Dump', 'Nombres Registrados'],
      ...result.detalles.duplicados.map((d) => [d.phone, d.repeticiones, (d.nombres || []).join(' / ')]),
    ];
    const wsDup = XLSX.utils.aoa_to_sheet(dupData);
    XLSX.utils.book_append_sheet(wb, wsDup, '5_Duplicados');

    // 6. Inválidos Sheet
    const invData = [
      ['Teléfono Original en Dump', 'Motivo de Rechazo', 'Fila en Archivo'],
      ...result.detalles.invalidos.map((i) => [i.rawPhone, i.motivo, i.filaIndex]),
    ];
    const wsInv = XLSX.utils.aoa_to_sheet(invData);
    XLSX.utils.book_append_sheet(wb, wsInv, '6_Invalidos');

    // 7. Discrepancias Sheet
    const discData = [
      ['Teléfono', 'Campo con Diferencia', 'Valor Enviado Original', 'Valor en Dump Proveedor'],
      ...result.detalles.discrepancias.map((d) => [d.phone, d.campo, d.valorEnviado, d.valorDump]),
    ];
    const wsDisc = XLSX.utils.aoa_to_sheet(discData);
    XLSX.utils.book_append_sheet(wb, wsDisc, '7_Discrepancias');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const filename = `Conciliacion_${result.semanaOperativa}_${result.proveedor.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    triggerDownload(blob, filename);
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation Tabs: Nueva Conciliación vs Histórico */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('nueva')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'nueva'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCheck2 className="w-4 h-4 text-indigo-400" />
          <span>Ejecutar Nueva Conciliación</span>
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
          <span>Histórico de Conciliaciones ({reconciliations.length})</span>
        </button>
      </div>

      {activeTab === 'nueva' && (
        <div className="space-y-6">
          {/* STEP 1: Seleccionar Entregas Confirmadas */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                  Paso 1 de 2
                </span>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mt-0.5">
                  <CheckCircle className="w-5 h-5 text-indigo-400" />
                  <span>Seleccionar Entregas Confirmadas para Comparar</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  La conciliación compara estrictamente contra los teléfonos de las entregas seleccionadas (no contra toda la base).
                </p>
              </div>

              {/* Sample test dump button */}
              <button
                type="button"
                onClick={handleLoadSampleDump}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors self-start sm:self-auto"
                title="Cargar un archivo dump de prueba con coincidencias y faltantes"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Cargar Dump de Prueba</span>
              </button>
            </div>

            {/* Delivery Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Semana Operativa
                </label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none"
                >
                  <option value="all">Todas las semanas</option>
                  {uniqueWeeks.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Destinatario / Proveedor
                </label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none"
                >
                  <option value="all">Todos los destinatarios</option>
                  {uniqueProviders.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Campaña
                </label>
                <select
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none"
                >
                  <option value="all">Todas las campañas</option>
                  {uniqueCampaigns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Deliveries checklist table */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-x-auto max-h-56">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold sticky top-0">
                    <th className="px-3 py-2 w-10 text-center">
                      <button onClick={handleSelectAllDeliveries} className="text-slate-400 hover:text-white">
                        {selectedDeliveryIds.length === availableDeliveries.length && availableDeliveries.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Semana</th>
                    <th className="px-3 py-2">Destinatario</th>
                    <th className="px-3 py-2">Ciudad</th>
                    <th className="px-3 py-2">Campaña</th>
                    <th className="px-3 py-2 text-right">Leads</th>
                    <th className="px-3 py-2">Archivo</th>
                    <th className="px-3 py-2">Trazabilidad de Teléfonos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {availableDeliveries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        No hay entregas disponibles con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    availableDeliveries.map((del) => {
                      const isSelected = selectedDeliveryIds.includes(del.id);
                      const hasPhoneList = Boolean(del.leadIds && del.leadIds.length > 0);
                      return (
                        <tr
                          key={del.id}
                          onClick={() => handleToggleDelivery(del.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-indigo-950/30 text-white' : 'hover:bg-slate-900/50'
                          }`}
                        >
                          <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => handleToggleDelivery(del.id)}>
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-indigo-400" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-2 font-mono">{del.fechaEntrega}</td>
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-400">{del.semanaOperativa}</td>
                          <td className="px-3 py-2 font-bold text-slate-100">{del.destinatario}</td>
                          <td className="px-3 py-2 font-semibold text-slate-300">{del.ciudad}</td>
                          <td className="px-3 py-2 text-slate-400">{del.campaña}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-400">
                            {del.leadsCount}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-400 truncate max-w-xs">
                            {del.fileName}
                          </td>
                          <td className="px-3 py-2">
                            {hasPhoneList ? (
                              <span className="text-emerald-400 font-semibold text-[10px] flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> {del.leadIds.length} teléfonos vinculados
                              </span>
                            ) : (
                              <span className="text-amber-400 font-medium text-[10px] flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Solo cantidad (Sin detalle)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Selection status summary */}
            <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
              <span>
                Entregas seleccionadas: <strong>{selectedDeliveryIds.length}</strong> | Total de teléfonos comparables:{' '}
                <strong className="text-emerald-400">{selectedDeliveriesSentPhonesMap.size}</strong>
              </span>

              {uncomparableDeliveriesCount > 0 && (
                <span className="text-amber-400 flex items-center gap-1 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {uncomparableDeliveriesCount} entrega(s) sin lista de teléfonos no son conciliables por registro.
                </span>
              )}
            </div>
          </div>

          {/* STEP 2: Cargar y Mapear Dump */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
              Paso 2 de 2
            </span>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-indigo-400" />
              <span>Importar Archivo Dump del Proveedor y Mapear Columnas</span>
            </h3>

            {/* Dropzone input */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <label className="flex-1 w-full border-2 border-dashed border-slate-800 hover:border-indigo-500 rounded-xl p-4 cursor-pointer bg-slate-950 flex items-center justify-center gap-3 text-xs text-slate-300">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                <span>
                  {dumpFile ? dumpFile.name : 'Haz clic para seleccionar el archivo dump (.xlsx, .xls, .csv)'}
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleDumpFileChange}
                  className="hidden"
                />
              </label>

              {dumpHeaders.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 font-semibold whitespace-nowrap">
                    Fila de Encabezados:
                  </label>
                  <select
                    value={headerRowIdx}
                    onChange={(e) => setHeaderRowIdx(parseInt(e.target.value, 10))}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
                  >
                    <option value={0}>Fila 1</option>
                    <option value={1}>Fila 2 (Ignorar título)</option>
                    <option value={2}>Fila 3</option>
                  </select>
                </div>
              )}
            </div>

            {/* Mapping dropdowns */}
            {dumpHeaders.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Columna de Teléfono *
                  </label>
                  <select
                    value={phoneCol}
                    onChange={(e) => setPhoneCol(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    required
                  >
                    <option value="">-- Seleccionar --</option>
                    {dumpHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Columna de Nombre (Opcional)
                  </label>
                  <select
                    value={nameCol}
                    onChange={(e) => setNameCol(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none"
                  >
                    <option value="">-- Opcional --</option>
                    {dumpHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Columna de Ciudad (Opcional)
                  </label>
                  <select
                    value={cityCol}
                    onChange={(e) => setCityCol(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none"
                  >
                    <option value="">-- Opcional --</option>
                    {dumpHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleExecuteReconciliation}
                    disabled={isProcessing || !phoneCol || selectedDeliveryIds.length === 0}
                    className="w-full py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5"
                  >
                    {isProcessing ? (
                      <span>Conciliando...</span>
                    ) : (
                      <>
                        <FileCheck2 className="w-4 h-4" />
                        <span>Ejecutar Conciliación</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ACTIVE RECONCILIATION RESULTS */}
          {activeResult && (
            <div className="rounded-2xl bg-slate-900 border border-indigo-500/30 p-6 shadow-2xl space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    Conciliación Completada
                  </span>
                  <h3 className="text-base font-bold text-white flex items-center gap-2 mt-0.5">
                    <span>{activeResult.proveedor}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal">
                      {activeResult.semanaOperativa}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Archivo dump: <strong className="text-slate-200">{activeResult.dumpFileName}</strong>
                  </p>
                </div>

                <button
                  onClick={() => handleExport7SheetExcel(activeResult)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/30"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Reporte Excel Completo (7 Hojas)</span>
                </button>
              </div>

              {/* KPI INDICATORS GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 text-center">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Enviados</span>
                  <span className="text-base font-extrabold text-slate-100">
                    {activeResult.totalEnviadosComparables}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Dump Válidos</span>
                  <span className="text-base font-extrabold text-slate-100">
                    {activeResult.totalDumpValidos}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30">
                  <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Coincidencias</span>
                  <span className="text-base font-extrabold text-emerald-400">
                    {activeResult.coincidenciasCount}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-rose-500/30">
                  <span className="text-[10px] text-rose-400 uppercase font-semibold block">Faltantes</span>
                  <span className="text-base font-extrabold text-rose-400">
                    {activeResult.faltantesCount}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30">
                  <span className="text-[10px] text-amber-400 uppercase font-semibold block">No Identificados</span>
                  <span className="text-base font-extrabold text-amber-300">
                    {activeResult.noIdentificadosCount}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-purple-400 uppercase font-semibold block">Duplicados</span>
                  <span className="text-base font-extrabold text-purple-300">
                    {activeResult.duplicadosDumpCount}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-rose-400 uppercase font-semibold block">Inválidos</span>
                  <span className="text-base font-extrabold text-rose-400">
                    {activeResult.invalidosDumpCount}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/40">
                  <span className="text-[10px] text-indigo-300 uppercase font-bold block">Tasa Coincidencia</span>
                  <span className="text-base font-black text-indigo-300">
                    {activeResult.tasaCoincidencia !== null ? `${activeResult.tasaCoincidencia}%` : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Subtabs for Detail Exploration */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto text-xs">
                  <button
                    onClick={() => setSelectedDetailTab('resumen')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                      selectedDetailTab === 'resumen'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Resumen
                  </button>
                  <button
                    onClick={() => setSelectedDetailTab('coincidencias')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                      selectedDetailTab === 'coincidencias'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Coincidencias ({activeResult.coincidenciasCount})
                  </button>
                  <button
                    onClick={() => setSelectedDetailTab('faltantes')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                      selectedDetailTab === 'faltantes'
                        ? 'bg-rose-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Faltantes ({activeResult.faltantesCount})
                  </button>
                  <button
                    onClick={() => setSelectedDetailTab('no_identificados')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                      selectedDetailTab === 'no_identificados'
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    No Identificados ({activeResult.noIdentificadosCount})
                  </button>
                  <button
                    onClick={() => setSelectedDetailTab('duplicados')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                      selectedDetailTab === 'duplicados'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Duplicados ({activeResult.duplicadosDumpCount})
                  </button>
                  <button
                    onClick={() => setSelectedDetailTab('invalidos')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                      selectedDetailTab === 'invalidos'
                        ? 'bg-rose-800 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Inválidos ({activeResult.invalidosDumpCount})
                  </button>
                </div>

                {/* Subtab Content: Coincidencias */}
                {selectedDetailTab === 'coincidencias' && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-x-auto max-h-64">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900 text-slate-300 font-semibold sticky top-0">
                          <th className="px-3 py-2">Teléfono Normalizado</th>
                          <th className="px-3 py-2">Ciudad Enviada</th>
                          <th className="px-3 py-2">Ciudad Dump</th>
                          <th className="px-3 py-2">Nombre en Dump</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {activeResult.detalles.coincidencias.map((c, i) => (
                          <tr key={i} className="hover:bg-slate-900/40">
                            <td className="px-3 py-2 font-mono text-emerald-400 font-semibold">{c.phone}</td>
                            <td className="px-3 py-2">{c.ciudadEnviada || '—'}</td>
                            <td className="px-3 py-2 text-slate-400">{c.ciudadDump || '—'}</td>
                            <td className="px-3 py-2 text-slate-400">{c.nombreDump || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Subtab Content: Faltantes */}
                {selectedDetailTab === 'faltantes' && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-x-auto max-h-64">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900 text-slate-300 font-semibold sticky top-0">
                          <th className="px-3 py-2">Teléfono Enviado Faltante</th>
                          <th className="px-3 py-2">Ciudad Original</th>
                          <th className="px-3 py-2">Fecha Envío</th>
                          <th className="px-3 py-2">Entrega Origen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {activeResult.detalles.faltantes.map((f, i) => (
                          <tr key={i} className="hover:bg-slate-900/40">
                            <td className="px-3 py-2 font-mono text-rose-400 font-semibold">{f.phone}</td>
                            <td className="px-3 py-2">{f.ciudad || '—'}</td>
                            <td className="px-3 py-2 font-mono text-slate-400">{f.fechaEnvio || '—'}</td>
                            <td className="px-3 py-2 font-mono text-slate-400 text-[11px]">{f.deliveryId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Subtab Content: No Identificados */}
                {selectedDetailTab === 'no_identificados' && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-x-auto max-h-64">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900 text-slate-300 font-semibold sticky top-0">
                          <th className="px-3 py-2">Teléfono en Dump</th>
                          <th className="px-3 py-2">Nombre Leído</th>
                          <th className="px-3 py-2">Ciudad en Dump</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {activeResult.detalles.noIdentificados.map((n, i) => (
                          <tr key={i} className="hover:bg-slate-900/40">
                            <td className="px-3 py-2 font-mono text-amber-300 font-semibold">{n.phone}</td>
                            <td className="px-3 py-2">{n.nombre || '—'}</td>
                            <td className="px-3 py-2 text-slate-400">{n.ciudad || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Subtab Content: Duplicados */}
                {selectedDetailTab === 'duplicados' && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-x-auto max-h-64">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900 text-slate-300 font-semibold sticky top-0">
                          <th className="px-3 py-2">Teléfono</th>
                          <th className="px-3 py-2">Repeticiones en Dump</th>
                          <th className="px-3 py-2">Nombres Reportados</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {activeResult.detalles.duplicados.map((d, i) => (
                          <tr key={i} className="hover:bg-slate-900/40">
                            <td className="px-3 py-2 font-mono text-purple-300 font-semibold">{d.phone}</td>
                            <td className="px-3 py-2 font-bold text-white">{d.repeticiones} veces</td>
                            <td className="px-3 py-2 text-slate-400 text-[11px]">{(d.nombres || []).join(' / ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Subtab Content: Inválidos */}
                {selectedDetailTab === 'invalidos' && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-x-auto max-h-64">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900 text-slate-300 font-semibold sticky top-0">
                          <th className="px-3 py-2">Teléfono en Dump</th>
                          <th className="px-3 py-2">Motivo de Rechazo</th>
                          <th className="px-3 py-2">Fila</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {activeResult.detalles.invalidos.map((inv, i) => (
                          <tr key={i} className="hover:bg-slate-900/40">
                            <td className="px-3 py-2 font-mono text-rose-400">{inv.rawPhone}</td>
                            <td className="px-3 py-2 text-slate-300">{inv.motivo}</td>
                            <td className="px-3 py-2 font-mono text-slate-400">#{inv.filaIndex}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Subtab Content: Resumen general */}
                {selectedDetailTab === 'resumen' && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
                    <p className="font-semibold text-slate-200">
                      Diagnóstico del Proceso de Conciliación:
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                      Se compararon exitosamente <strong>{activeResult.totalEnviadosComparables}</strong> números únicos entregados contra <strong>{activeResult.totalDumpValidos}</strong> registros válidos del proveedor. Se confirmaron <strong>{activeResult.coincidenciasCount} coincidencias exactas</strong> (Tasa de efectividad: <strong>{activeResult.tasaCoincidencia}%</strong>). Existen <strong>{activeResult.faltantesCount} leads</strong> que fueron entregados pero no fueron reportados en el dump del proveedor.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HISTÓRICO DE CONCILIACIONES */}
      {activeTab === 'historico' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <History className="w-5 h-5 text-purple-400" />
                <span>Historial Permanente de Conciliaciones</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Consulta y descarga los reportes multi-hoja de conciliaciones anteriores. Cada corrida queda guardada como un registro independiente e inmutable.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950">
                    <th className="px-4 py-3">Semana</th>
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3">Archivo Dump</th>
                    <th className="px-4 py-3 text-right">Enviados</th>
                    <th className="px-4 py-3 text-right text-emerald-400 font-bold">Coincidencias</th>
                    <th className="px-4 py-3 text-right text-rose-400 font-bold">Faltantes</th>
                    <th className="px-4 py-3 text-right text-indigo-300 font-bold">Tasa (%)</th>
                    <th className="px-4 py-3">Fecha Ejecución</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {reconciliations.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                        <p className="font-semibold text-slate-300">No hay conciliaciones archivadas aún</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Ejecuta una conciliación en la pestaña "Ejecutar Nueva Conciliación" para generar el primer registro.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    reconciliations.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-950/40">
                        <td className="px-4 py-3 font-mono font-bold text-slate-200">
                          {rec.semanaOperativa}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-100">{rec.proveedor}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400 truncate max-w-xs">
                          {rec.dumpFileName}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">{rec.totalEnviadosComparables}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">
                          {rec.coincidenciasCount}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-rose-400">
                          {rec.faltantesCount}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-extrabold text-indigo-300">
                          {rec.tasaCoincidencia !== null ? `${rec.tasaCoincidencia}%` : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                          {new Date(rec.fechaEjecucion).toLocaleString('es-MX')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleExport7SheetExcel(rec)}
                            className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1 ml-auto"
                            title="Descargar libro Excel con las 7 hojas de resultados"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Excel (7 Hojas)</span>
                          </button>
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
    </div>
  );
};
