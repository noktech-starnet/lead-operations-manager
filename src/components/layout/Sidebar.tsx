import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  CheckCircle2,
  MapPin,
  Download,
  Truck,
  Settings,
  Layers,
  ShieldCheck,
  Building,
  Send,
  FileText,
  FileCheck2,
  UserCheck,
} from 'lucide-react';
import { UserRole } from '../../types';

export type NavTab =
  | 'dashboard'
  | 'clients'
  | 'distribution'
  | 'reports'
  | 'reconciliation'
  | 'import'
  | 'review'
  | 'cities'
  | 'exports'
  | 'deliveries'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  pendingReviewCount: number;
  acceptedCount: number;
  currentUserRole: UserRole;
  allowedRoles: UserRole[];
  onRoleChange: (role: UserRole) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  pendingReviewCount,
  acceptedCount,
  currentUserRole,
  allowedRoles,
  onRoleChange,
}) => {
  const navItems = [
    {
      section: 'Visión General',
      items: [
        {
          id: 'dashboard' as NavTab,
          label: 'Dashboard',
          icon: LayoutDashboard,
          badge: null,
        },
      ],
    },
    {
      section: 'Distribución & Reportes',
      items: [
        {
          id: 'clients' as NavTab,
          label: 'Clientes',
          icon: Building,
          badge: null,
        },
        {
          id: 'distribution' as NavTab,
          label: 'Distribución de leads',
          icon: Send,
          badge: null,
        },
        {
          id: 'reports' as NavTab,
          label: 'Reportes semanales',
          icon: FileText,
          badge: null,
        },
        {
          id: 'reconciliation' as NavTab,
          label: 'Conciliación semanal',
          icon: FileCheck2,
          badge: null,
        },
      ],
    },
    {
      section: 'Procesamiento de Archivos',
      items: [
        {
          id: 'import' as NavTab,
          label: 'Importación de archivos',
          icon: UploadCloud,
          badge: null,
        },
        {
          id: 'review' as NavTab,
          label: 'Centro de depuración',
          icon: CheckCircle2,
          badge:
            pendingReviewCount > 0
              ? { count: pendingReviewCount, color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' }
              : null,
        },
        {
          id: 'cities' as NavTab,
          label: 'Leads por ciudad',
          icon: MapPin,
          badge: null,
        },
        {
          id: 'exports' as NavTab,
          label: 'Exportaciones',
          icon: Download,
          badge:
            acceptedCount > 0
              ? { count: acceptedCount, color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' }
              : null,
        },
        {
          id: 'deliveries' as NavTab,
          label: 'Entregas e historial',
          icon: Truck,
          badge: null,
        },
      ],
    },
    {
      section: 'Sistema',
      items: [
        {
          id: 'settings' as NavTab,
          label: 'Configuración & Histórico',
          icon: Settings,
          badge: null,
        },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Layers className="w-5 h-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 tracking-tight leading-none">
              Lead Operations
            </h1>
            <p className="text-[11px] font-medium text-slate-400 mt-1 uppercase tracking-wider">
              Manager v2.5
            </p>
          </div>
        </div>
      </div>

      {/* Role Switcher Badge */}
      <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-950/40">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
          <span className="flex items-center gap-1 font-semibold uppercase tracking-wider text-[10px]">
            <UserCheck className="w-3 h-3 text-indigo-400" />
            Rol Operativo:
          </span>
        </div>
        <select
          value={currentUserRole}
          onChange={(e) => onRoleChange(e.target.value as UserRole)}
          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-200 focus:outline-none focus:border-indigo-500"
        >
          {allowedRoles.includes('admin') && <option value="admin">Administrador (Todos los módulos)</option>}
          {allowedRoles.includes('distribucion') && <option value="distribucion">Responsable de Distribución</option>}
          {allowedRoles.includes('conciliacion') && <option value="conciliacion">Responsable de Conciliación</option>}
        </select>
      </div>

      {/* Nav Menu */}
      <nav className="p-3 space-y-4 flex-1 overflow-y-auto">
        {navItems.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {group.section}
            </div>
            {group.items.filter(item => (item.id !== 'settings' || allowedRoles.includes('admin')) && (!['import','review','exports'].includes(item.id) || allowedRoles.some(role => role === 'admin' || role === 'distribucion'))).map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-300'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${item.badge.color}`}
                    >
                      {item.badge.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/60">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="truncate">
            <span className="block font-medium text-slate-300">Auditoría Permanente</span>
            <span className="text-[10px] text-slate-400">Histórico inmutable activo</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
