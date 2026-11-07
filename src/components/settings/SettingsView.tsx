import React, { useState } from 'react';
import {
  Settings,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  Check,
  RefreshCw,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  History,
  ShieldCheck,
  Database,
  Globe,
  Tag,
  Save,
  UploadCloud,
  FileCheck,
  UserCheck,
} from 'lucide-react';
import { CityAlias, WeeklyGoal, AuditLog } from '../../types';
import { storageService, AppSettings } from '../../services/storageService';
import { Modal } from '../common/Modal';
import {
  createSampleMetaAdsWorkbook,
  createPensionesDum8OctWorkbook,
} from '../../utils/sampleDataGenerator';
import { triggerDownload } from '../../utils/exporter';

interface SettingsViewProps {
  cityCatalog: CityAlias[];
  goals: WeeklyGoal[];
  onRefresh: () => void;
  currentUserRole: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  cityCatalog,
  goals,
  onRefresh,
  currentUserRole,
}) => {
  const [activeTab, setActiveTab] = useState<
    'cities' | 'goals' | 'general' | 'migration' | 'audit' | 'samples'
  >('cities');

  // App settings state
  const [settings, setSettings] = useState<AppSettings>(() => storageService.getSettings());
  const [isSavedAlert, setIsSavedAlert] = useState(false);

  // Migration status
  const [migrationStatus, setMigrationStatus] = useState<{
    msg: string;
    isError?: boolean;
    counts?: Record<string, number>;
  } | null>(null);

  // City modal state
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [cityForm, setCityForm] = useState<{
    id?: string;
    canonicalCity: string;
    state: string;
    aliases: string;
    isActive: boolean;
  }>({
    canonicalCity: '',
    state: '',
    aliases: '',
    isActive: true,
  });

  // Goal modal state
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalForm, setGoalForm] = useState<{
    semanaOperativa: string;
    ciudad: string;
    metaProcesamiento: number;
    metaEntrega: number;
  }>({
    semanaOperativa: '2026-W41',
    ciudad: cityCatalog[0]?.canonicalCity || 'Monterrey',
    metaProcesamiento: 300,
    metaEntrega: 250,
  });

  // Audit logs
  const auditLogs = storageService.getAuditLogs();

  // Save general settings
  const handleSaveGeneralSettings = (e: React.FormEvent) => {
    e.preventDefault();
    storageService.saveSettings(settings);
    setIsSavedAlert(true);
    setTimeout(() => setIsSavedAlert(false), 3000);
  };

  // Open City Modal
  const handleOpenAddCity = () => {
    setCityForm({
      canonicalCity: '',
      state: '',
      aliases: '',
      isActive: true,
    });
    setIsCityModalOpen(true);
  };

  const handleOpenEditCity = (city: CityAlias) => {
    setCityForm({
      id: city.id,
      canonicalCity: city.canonicalCity,
      state: city.state,
      aliases: city.aliases.join(', '),
      isActive: city.isActive,
    });
    setIsCityModalOpen(true);
  };

  const handleSaveCity = () => {
    if (!cityForm.canonicalCity.trim()) return;

    const aliasList = cityForm.aliases
      .split(',')
      .map((a) => a.trim().toUpperCase())
      .filter(Boolean);

    const updatedCatalog = [...cityCatalog];

    if (cityForm.id) {
      const idx = updatedCatalog.findIndex((c) => c.id === cityForm.id);
      if (idx !== -1) {
        updatedCatalog[idx] = {
          ...updatedCatalog[idx],
          canonicalCity: cityForm.canonicalCity.trim(),
          state: cityForm.state.trim(),
          aliases: aliasList,
          isActive: cityForm.isActive,
        };
      }
    } else {
      updatedCatalog.push({
        id: `city-${Date.now()}`,
        canonicalCity: cityForm.canonicalCity.trim(),
        state: cityForm.state.trim(),
        aliases: aliasList,
        isActive: true,
      });
    }

    storageService.saveCities(updatedCatalog);
    setIsCityModalOpen(false);
    onRefresh();
  };

  // Toggle active city
  const handleToggleCityActive = (id: string) => {
    const updated = cityCatalog.map((c) => (c.id === id ? { ...c, isActive: !c.isActive } : c));
    storageService.saveCities(updated);
    onRefresh();
  };

  // Save Goal
  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `${goalForm.semanaOperativa}_${goalForm.ciudad}`;
    storageService.upsertGoal({
      id,
      semanaOperativa: goalForm.semanaOperativa,
      ciudad: goalForm.ciudad,
      metaProcesamiento: goalForm.metaProcesamiento,
      metaEntrega: goalForm.metaEntrega,
    });
    setIsGoalModalOpen(false);
    onRefresh();
  };

  // Backup / Export entire DB to JSON
  const handleExportBackup = () => {
    const jsonStr = storageService.exportCompleteDatabaseJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const filename = `respaldo_completo_lom_${new Date().toISOString().slice(0, 10)}.json`;
    triggerDownload(blob, filename);
  };

  // Restore DB from JSON
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = storageService.importAndVerifyDatabaseJson(content, 'Administrador');
      if (res.success) {
        setMigrationStatus({
          msg: res.message,
          counts: res.counts,
        });
        onRefresh();
      } else {
        setMigrationStatus({
          msg: res.message,
          isError: true,
        });
      }
    };
    reader.readAsText(file);
  };

  // Clear data
  const handleResetData = () => {
    if (
      confirm(
        '¿Estás seguro de que deseas restablecer todos los leads y lotes? Se conservará el catálogo de ciudades por defecto.'
      )
    ) {
      storageService.clearAll();
      onRefresh();
      alert('Datos restablecidos correctamente.');
    }
  };

  // Download sample files directly to disk for manual inspection
  const downloadSampleMeta = () => {
    const blob = createSampleMetaAdsWorkbook();
    triggerDownload(blob, 'ejemplo_meta_ads_leads.xlsx');
  };

  const downloadSampleRow2 = () => {
    const blob = createPensionesDum8OctWorkbook();
    triggerDownload(blob, 'pensionesdum8oct.xlsx');
  };

  return (
    <div className="space-y-6">
      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('cities')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'cities'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <MapPin className="w-4 h-4 text-indigo-400" />
          <span>Catálogo de Ciudades ({cityCatalog.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('goals')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'goals'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Tag className="w-4 h-4 text-emerald-400" />
          <span>Metas Semanales</span>
        </button>

        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'general'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Settings className="w-4 h-4 text-cyan-400" />
          <span>Parámetros Operativos</span>
        </button>

        <button
          onClick={() => setActiveTab('migration')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'migration'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Database className="w-4 h-4 text-emerald-400" />
          <span>Respaldo y Migración Firestore</span>
        </button>

        <button
          onClick={() => setActiveTab('samples')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'samples'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-amber-400" />
          <span>Archivos de Ejemplo</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'audit'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <History className="w-4 h-4 text-purple-400" />
          <span>Auditoría Permanente ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: CITIES & ALIASES */}
      {activeTab === 'cities' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-400" />
                <span>Catálogo Oficial de Ciudades y Alias de Adset</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Define las abreviaturas y términos clave para reconocer automáticamente la ciudad dentro de los nombres de conjuntos de anuncios (adset_name).
              </p>
            </div>

            <button
              onClick={handleOpenAddCity}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Ciudad</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {cityCatalog.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all text-xs space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-100">{c.canonicalCity}</span>
                    <span className="text-[11px] text-slate-400">({c.state})</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleCityActive(c.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                        c.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {c.isActive ? 'Activa' : 'Inactiva'}
                    </button>
                    <button
                      onClick={() => handleOpenEditCity(c)}
                      className="p-1 text-slate-400 hover:text-slate-200"
                      title="Editar ciudad y alias"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                    Alias Reconocidos:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {c.aliases.map((alias) => (
                      <span
                        key={alias}
                        className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-indigo-300"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: WEEKLY GOALS */}
      {activeTab === 'goals' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-400" />
                <span>Configuración de Metas Semanales</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Establece la meta semanal de procesamiento (Indicador 1) y meta semanal de entrega (Indicador 2) para cada ciudad.
              </p>
            </div>

            <button
              onClick={() => setIsGoalModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Establecer Meta</span>
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 font-semibold">
                  <th className="px-4 py-3">Semana Operativa</th>
                  <th className="px-4 py-3">Ciudad</th>
                  <th className="px-4 py-3 text-emerald-400">Meta Semanal Procesamiento</th>
                  <th className="px-4 py-3 text-indigo-400">Meta Semanal Entrega</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {goals.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-900/40">
                    <td className="px-4 py-2.5 font-mono">{g.semanaOperativa}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-100">{g.ciudad}</td>
                    <td className="px-4 py-2.5 font-mono text-emerald-400 font-semibold">
                      {g.metaProcesamiento.toLocaleString('es-MX')} leads
                    </td>
                    <td className="px-4 py-2.5 font-mono text-indigo-400 font-semibold">
                      {g.metaEntrega.toLocaleString('es-MX')} leads
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => {
                          setGoalForm({
                            semanaOperativa: g.semanaOperativa,
                            ciudad: g.ciudad,
                            metaProcesamiento: g.metaProcesamiento,
                            metaEntrega: g.metaEntrega,
                          });
                          setIsGoalModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: MIGRATION & FIREBASE PERSISTENCE */}
      {activeTab === 'migration' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <span>Protocolo de Respaldo y Migración Controlada a Firestore</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Para cumplir con el requisito obligatorio de conservación permanente del histórico, el aplicativo cuenta con un motor de respaldo completo e importación verificable.
                </p>
              </div>
            </div>

            {migrationStatus && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-1 ${
                  migrationStatus.isError
                    ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                    : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  {migrationStatus.isError ? <AlertTriangle className="w-4 h-4" /> : <FileCheck className="w-4 h-4" />}
                  <span>{migrationStatus.msg}</span>
                </div>
                {migrationStatus.counts && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px]">
                    <div>Leads restaurados: <strong>{migrationStatus.counts.leads}</strong></div>
                    <div>Clientes: <strong>{migrationStatus.counts.clients}</strong></div>
                    <div>Distribuciones: <strong>{migrationStatus.counts.distributions}</strong></div>
                    <div>Reportes: <strong>{migrationStatus.counts.reports}</strong></div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Export Backup Card */}
              <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Download className="w-5 h-5 text-indigo-400" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">
                      1. Exportar Respaldo Completo de Base de Datos
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      Descarga un archivo JSON con leads, clientes, distribuciones, reportes y auditoría
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Genera una copia íntegra con marca de tiempo y versión de esquema lista para almacenar fuera del navegador o migrar a Firestore.
                </p>
                <button
                  onClick={handleExportBackup}
                  className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Archivo JSON de Respaldo</span>
                </button>
              </div>

              {/* Restore / Import Card */}
              <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">
                      2. Restaurar o Migrar Respaldo
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      Carga y verifica un archivo JSON de respaldo
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  Verifica las cantidades, la consistencia de los datos y conserva la trazabilidad de la migración en los registros de auditoría.
                </p>
                <label className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer">
                  <UploadCloud className="w-4 h-4" />
                  <span>Cargar y Verificar Archivo de Respaldo</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Architecture information */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-2 mt-4">
              <span className="font-bold text-slate-200 block">
                Arquitectura de Persistencia y Seguridad (Reglas ABAC):
              </span>
              <p>
                El archivo <code>firebase-blueprint.json</code> y las reglas de seguridad <code>firestore.rules</code> han sido actualizados con las colecciones <code>/clients</code>, <code>/distributions</code>, <code>/weeklyReports</code> y <code>/reconciliations</code>. El sistema opera con persistencia local de alta disponibilidad y soporte de exportación/importación integral verificable.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB: GENERAL OPERATIONAL PARAMETERS */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveGeneralSettings}
            className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4"
          >
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Settings className="w-5 h-5 text-cyan-400" />
              <span>Parámetros Operativos del Sistema</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre Predeterminado de Campaña
                </label>
                <input
                  type="text"
                  value={settings.defaultCampaign}
                  onChange={(e) => setSettings({ ...settings, defaultCampaign: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Zona Horaria Operativa
                </label>
                <input
                  type="text"
                  value={settings.timezone}
                  disabled
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-400 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Configurado para hora estándar de la Ciudad de México (evita desplazamientos de fecha)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              {isSavedAlert ? (
                <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Parámetros guardados con éxito
                </span>
              ) : (
                <span />
              )}
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Parámetros</span>
              </button>
            </div>
          </form>

          {/* Reset button card */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-200 block">Restablecer Datos Locales</span>
              <span className="text-[11px] text-slate-400">
                Borra únicamente los datos locales manteniendo los catálogos por defecto.
              </span>
            </div>
            <button
              type="button"
              onClick={handleResetData}
              className="px-3.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Restablecer</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB: SAMPLES */}
      {activeTab === 'samples' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
              <span>Descarga de Archivos de Prueba Reales</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Descarga estos archivos Excel directamente a tu equipo para probar el flujo de importación, detección de fila 2, normalización +52 y deduplicación.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-6 h-6 text-indigo-400" />
                <div>
                  <h4 className="text-xs font-bold text-slate-200">
                    Formato Meta Ads estándar (.xlsx)
                  </h4>
                  <span className="text-[11px] text-slate-400">12 registros de prueba</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Contiene columnas <code>adset_name</code>, <code>full_name</code>, <code>phone_number</code>, teléfonos con prefijo <code>p:</code>, casos de prueba para nombres sin apellido ("Emilio"), iniciales ("María G.") y negocios ("Globitos X").
              </p>
              <button
                onClick={downloadSampleMeta}
                className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Descargar ejemplo_meta_ads_leads.xlsx</span>
              </button>
            </div>

            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-6 h-6 text-cyan-400" />
                <div>
                  <h4 className="text-xs font-bold text-slate-200">
                    Archivo de Referencia pensionesdum8oct.xlsx
                  </h4>
                  <span className="text-[11px] text-slate-400">Encabezados en Fila 2</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Reproduce exactamente el caso operativo de la referencia: fila 1 con banner de reporte, fila 2 con encabezados <code>adset_name</code>, <code>nombre_y_apellidos</code>, <code>número_de_teléfono</code> y columnas técnicas a excluir.
              </p>
              <button
                onClick={downloadSampleRow2}
                className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Descargar pensionesdum8oct.xlsx</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <History className="w-5 h-5 text-purple-400" />
              <span>Historial General de Operaciones y Auditoría Permanente</span>
            </h3>
            <span className="text-xs text-slate-400">{auditLogs.length} eventos registrados</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-4 py-2.5">Fecha y Hora</th>
                  <th className="px-4 py-2.5">Acción</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Detalles</th>
                  <th className="px-4 py-2.5">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No hay registros de auditoría aún.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/40">
                      <td className="px-4 py-2 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('es-MX')}
                      </td>
                      <td className="px-4 py-2 font-semibold text-slate-200">{log.action}</td>
                      <td className="px-4 py-2 uppercase text-[10px] text-slate-400 font-mono">
                        {log.entityType}
                      </td>
                      <td className="px-4 py-2 text-[11px] max-w-md">{log.details}</td>
                      <td className="px-4 py-2 text-slate-400 text-[11px]">{log.user}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* City Edit/Add Modal */}
      {isCityModalOpen && (
        <Modal
          isOpen={isCityModalOpen}
          onClose={() => setIsCityModalOpen(false)}
          title={cityForm.id ? 'Editar Ciudad y Alias' : 'Agregar Nueva Ciudad'}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nombre Canónico de la Ciudad *
              </label>
              <input
                type="text"
                value={cityForm.canonicalCity}
                onChange={(e) => setCityForm({ ...cityForm, canonicalCity: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                placeholder="Ej: Acapulco"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Estado de la República
              </label>
              <input
                type="text"
                value={cityForm.state}
                onChange={(e) => setCityForm({ ...cityForm, state: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                placeholder="Ej: Guerrero"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Alias de Adset (Separados por coma) *
              </label>
              <textarea
                value={cityForm.aliases}
                onChange={(e) => setCityForm({ ...cityForm, aliases: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                placeholder="ACA, ACAPULCO, GUERRERO, GRO, COSTERA"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Cualquiera de estos términos encontrados en el adset_name asociará el lead a esta ciudad.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCityModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveCity}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20"
              >
                Guardar Ciudad
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Goal Edit/Add Modal */}
      {isGoalModalOpen && (
        <Modal
          isOpen={isGoalModalOpen}
          onClose={() => setIsGoalModalOpen(false)}
          title="Establecer Meta Semanal para Ciudad"
        >
          <form onSubmit={handleSaveGoal} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Semana Operativa *
              </label>
              <input
                type="text"
                value={goalForm.semanaOperativa}
                onChange={(e) => setGoalForm({ ...goalForm, semanaOperativa: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                placeholder="2026-W41"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Ciudad *
              </label>
              <select
                value={goalForm.ciudad}
                onChange={(e) => setGoalForm({ ...goalForm, ciudad: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                {cityCatalog.map((c) => (
                  <option key={c.canonicalCity} value={c.canonicalCity}>
                    {c.canonicalCity}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Meta Procesamiento (1)
                </label>
                <input
                  type="number"
                  min="0"
                  value={goalForm.metaProcesamiento}
                  onChange={(e) =>
                    setGoalForm({ ...goalForm, metaProcesamiento: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Meta Entrega (2)
                </label>
                <input
                  type="number"
                  min="0"
                  value={goalForm.metaEntrega}
                  onChange={(e) =>
                    setGoalForm({ ...goalForm, metaEntrega: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsGoalModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20"
              >
                Guardar Meta
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
