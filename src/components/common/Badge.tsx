import React from 'react';
import { LeadStatus, ReviewReason } from '../../types';

interface BadgeProps {
  status?: LeadStatus;
  reason?: ReviewReason;
  text?: string;
  variant?: 'green' | 'amber' | 'rose' | 'blue' | 'purple' | 'slate';
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<{ status: LeadStatus; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  if (status === 'accepted') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${sizeClasses}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        Aceptado
      </span>
    );
  }

  if (status === 'pending_review') {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 ${sizeClasses}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
        Pendiente
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20 ${sizeClasses}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
      Rechazado
    </span>
  );
};

export const ReasonBadge: React.FC<{ reason: ReviewReason }> = ({ reason }) => {
  const map: Record<ReviewReason, { label: string; color: string }> = {
    VALID: { label: 'Válido', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
    NOMBRE_SIN_APELLIDO: { label: 'Sin apellido', color: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
    APELLIDO_INCOMPLETO: { label: 'Apellido incompleto', color: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
    POSIBLE_NEGOCIO: { label: 'Posible negocio', color: 'bg-orange-500/10 text-orange-300 border-orange-500/20' },
    POSIBLE_PERFIL_O_ANOMALO: { label: 'Perfil / Anómalo', color: 'bg-purple-500/10 text-purple-300 border-purple-500/20' },
    CARACTERES_INVALIDOS: { label: 'Caracteres inválidos', color: 'bg-rose-500/10 text-rose-300 border-rose-500/20' },
    NOMBRE_VACIO: { label: 'Nombre vacío', color: 'bg-rose-500/10 text-rose-300 border-rose-500/20' },
    TELEFONO_INVALIDO: { label: 'Teléfono inválido', color: 'bg-rose-500/10 text-rose-300 border-rose-500/20' },
    TELEFONO_INCOMPLETO: { label: 'Teléfono incompleto', color: 'bg-rose-500/10 text-rose-300 border-rose-500/20' },
    TELEFONO_CARACTERES_NO_NUMERICOS: { label: 'Tel con letras', color: 'bg-rose-500/10 text-rose-300 border-rose-500/20' },
    CIUDAD_NO_IDENTIFICADA: { label: 'Ciudad desconocida', color: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
    CIUDAD_AMBIGUA: { label: 'Ciudad ambigua', color: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20' },
    CONFLICTO_CIUDADES: { label: 'Conflicto ciudades', color: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' },
    DUPLICADO_CONSOLIDADO: { label: 'Duplicado consolidado', color: 'bg-blue-500/10 text-blue-300 border-blue-500/20' },
    DATOS_CONTRADICTORIOS: { label: 'Datos contradictorios', color: 'bg-purple-500/10 text-purple-300 border-purple-500/20' },
    OTRO: { label: 'Revisión', color: 'bg-slate-500/10 text-slate-300 border-slate-500/20' },
  };

  const item = map[reason] || { label: reason, color: 'bg-slate-500/10 text-slate-300 border-slate-500/20' };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${item.color}`}>
      {item.label}
    </span>
  );
};
