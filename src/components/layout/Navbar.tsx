import React from 'react';
import {
  Calendar,
  Clock,
  Sparkles,
  Database,
  RefreshCw,
  PlusCircle,
} from 'lucide-react';
import { NavTab } from './Sidebar';

interface NavbarProps {
  currentTab: NavTab;
  onOpenImport: () => void;
  onRefresh: () => void;
  totalLeads: number;
  totalBatches: number;
  canImport: boolean;
  email: string;
  onSignOut: () => void;
}

const TAB_TITLES: Record<NavTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard Ejecutivo y Ciclo de Leads',
    subtitle: 'Seguimiento integrado: leads válidos procesados, entregas confirmadas, distribuciones y conciliaciones.',
  },
  clients: {
    title: 'Directorio de Clientes y Destinatarios',
    subtitle: 'Administración de receptores de leads, campañas asignadas y consulta de histórico de entregas.',
  },
  distribution: {
    title: 'Distribución Operativa de Leads',
    subtitle: 'Bitácora de movimientos de envío por cliente, plaza, campaña y responsable con verificación de origen.',
  },
  reports: {
    title: 'Reportes Semanales Automáticos',
    subtitle: 'Generación por cliente, campaña o consolidados con conteo por fecha, formato de referencia y guardado inmutable.',
  },
  reconciliation: {
    title: 'Conciliación Semanal de Leads',
    subtitle: 'Cotejo automatizado de dump del proveedor contra entregas confirmadas con reporte en 7 hojas Excel.',
  },
  import: {
    title: 'Importación y Procesamiento de Archivos',
    subtitle: 'Carga de lotes Meta Ads y fuentes externas con mapeo dinámico y detección de encabezados en fila 2.',
  },
  review: {
    title: 'Centro de Depuración y Auditoría',
    subtitle: 'Bandeja operativa para validación de nombres, teléfonos +52, normalización de ciudades y resolución de conflictos.',
  },
  cities: {
    title: 'Distribución de Leads por Ciudad',
    subtitle: 'Clasificación territorial consolidada de acuerdo a las reglas de adset y alias configurados.',
  },
  exports: {
    title: 'Generación y Exportación de Archivos',
    subtitle: 'Descarga en formato Estándar (4 columnas), Polaris y VAPI con particionamiento de lote y nomenclatura oficial.',
  },
  deliveries: {
    title: 'Control de Entregas e Historial Operativo',
    subtitle: 'Registro manual y acuse de entregas reales a clientes o equipos comerciales con control de discrepancias.',
  },
  settings: {
    title: 'Configuración, Migración e Histórico',
    subtitle: 'Catálogos, metas, respaldo/migración completa de base de datos y auditoría de cambios.',
  },
};

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onOpenImport,
  onRefresh,
  totalLeads,
  totalBatches,
  canImport,
  email,
  onSignOut,
}) => {
  const currentInfo = TAB_TITLES[currentTab] || {
    title: 'Lead Operations Manager',
    subtitle: 'Sistema integral de depuración, distribución y control de leads.',
  };

  const currentDate = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-6 py-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2">
            {currentInfo.title}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{currentInfo.subtitle}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
<div className="text-xs text-slate-400"><span className="block max-w-40 truncate" title={email}>{email}</span><button onClick={onSignOut} className="text-indigo-300 hover:text-indigo-200 mt-1">Cerrar sesión</button></div>
          {/* Quick Date Display */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span className="capitalize">{currentDate}</span>
          </div>

          {/* Quick Storage Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              <strong className="text-slate-100">{totalLeads.toLocaleString('es-MX')}</strong> leads (
              {totalBatches} {totalBatches === 1 ? 'lote' : 'lotes'})
            </span>
          </div>

          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Actualizar datos"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {canImport && currentTab !== 'import' && (
            <button
              onClick={onOpenImport}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all hover:shadow-indigo-600/40"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nuevo Lote</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
