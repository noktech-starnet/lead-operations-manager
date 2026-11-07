export type LeadStatus = 'accepted' | 'rejected' | 'pending_review';

export type ReviewReason =
  | 'VALID'
  | 'NOMBRE_SIN_APELLIDO'
  | 'APELLIDO_INCOMPLETO'
  | 'POSIBLE_NEGOCIO'
  | 'POSIBLE_PERFIL_O_ANOMALO'
  | 'CARACTERES_INVALIDOS'
  | 'NOMBRE_VACIO'
  | 'TELEFONO_INVALIDO'
  | 'TELEFONO_INCOMPLETO'
  | 'TELEFONO_CARACTERES_NO_NUMERICOS'
  | 'CIUDAD_NO_IDENTIFICADA'
  | 'CIUDAD_AMBIGUA'
  | 'CONFLICTO_CIUDADES'
  | 'DUPLICADO_CONSOLIDADO'
  | 'DATOS_CONTRADICTORIOS'
  | 'OTRO';

export interface LeadOccurrence {
  occurrenceId: string;
  batchId: string;
  batchName: string;
  sourceFile: string;
  sourceType: string;
  rawAdset: string;
  rawName: string;
  rawPhone: string;
  detectedCity: string | null;
  createdTime?: string;
  importedAt: string;
}

export interface Lead {
  id: string; // Typically normalized phone as canonical identifier
  normalizedPhone: string; // +52XXXXXXXXXX
  rawPhone: string;
  nombre: string;
  rawNombre: string;
  ciudad: string; // Normalized city or empty if unknown
  rawAdset: string;
  campaign: string;
  fechaAlta: string; // Format DD/MM/YYYY
  status: LeadStatus;
  reviewReason: ReviewReason;
  reviewDetail?: string;
  reviewHistory: {
    timestamp: string;
    previousStatus: LeadStatus;
    newStatus: LeadStatus;
    action: string;
    reason: string;
    user: string;
  }[];
  firstOccurrenceBatchId: string;
  firstOccurrenceDate: string;
  occurrences: LeadOccurrence[];
  cityConflict?: {
    firstCity: string;
    conflictingCity: string;
    details: string;
  };
  manualOverride?: boolean;
  exportedCount: number;
  deliveredCount: number;
  lastExportedAt?: string;
  lastDeliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CityAlias {
  id: string;
  canonicalCity: string;
  state: string;
  aliases: string[]; // e.g. ["MTY", "MONTERREY", "REGIO"]
  isActive: boolean;
}

export interface ProcessingBatch {
  id: string;
  name: string;
  fechaAlta: string; // DD/MM/YYYY
  campaign: string; // e.g. "Pensiones"
  sourceType: 'meta_ads' | 'external_row2' | 'custom';
  fileNames: string[];
  totalRowsRead: number;
  totalUniqueLeads: number;
  acceptedLeadsCount: number;
  pendingReviewCount: number;
  rejectedCount: number;
  duplicatesFound: number;
  cityConflictsFound: number;
  status: 'completado' | 'en_proceso' | 'fallido';
  createdAt: string;
}

export interface Delivery {
  id: string;
  batchId?: string;
  ciudad: string;
  campaña: string;
  destinatario: string; // e.g. "TKM Reina & Frank", "Call Center Vapi"
  clienteId?: string;
  fechaEntrega: string; // DD/MM/YYYY
  leadsCount: number;
  exportedLeadsCount: number;
  fileName: string;
  formato: 'standard' | 'polaris' | 'vapi';
  semanaOperativa: string; // e.g. "2026-W41"
  observaciones?: string;
  estado: 'confirmada' | 'pendiente_acuse' | 'parcial';
  leadIds: string[]; // phone numbers or IDs
  createdAt: string;
}

export interface WeeklyGoal {
  id: string; // weekId + '_' + canonicalCity
  semanaOperativa: string; // e.g. "2026-W41"
  ciudad: string;
  metaProcesamiento: number;
  metaEntrega: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  entityType: 'lead' | 'batch' | 'delivery' | 'alias' | 'goal' | 'client' | 'distribution' | 'report' | 'reconciliation' | 'migration';
  entityId: string;
  details: string;
  reason?: string;
  user: string;
}

export interface ColumnMapping {
  adsetColumn: string;
  nameColumn: string;
  phoneColumn: string;
  createdTimeColumn?: string;
  headerRowIndex: number; // 0-indexed: 0 means row 1, 1 means row 2
}

export type ExportFormat = 'standard' | 'polaris' | 'vapi';

// --- NUEVOS MODELOS PARA LOS MÓDULOS DE CLIENTES, DISTRIBUCIÓN, REPORTES Y CONCILIACIÓN ---

export interface Client {
  id: string;
  nombreComercial: string; // e.g. "TKM Reina & Frank"
  campañas: string[]; // e.g. ["Pensiones"]
  contactoNombre?: string;
  contactoEmail?: string;
  contactoTelefono?: string;
  estado: 'activo' | 'inactivo';
  fechaAlta: string; // DD/MM/YYYY
  observaciones?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadDistribution {
  id: string;
  fechaEnvio: string; // DD/MM/YYYY e.g. "28/09/2026"
  clienteId: string;
  clienteNombre: string;
  campaña: string;
  ciudad: string;
  cantidad: number;
  responsable: string; // Persona que realizó la distribución (e.g. "Reina & Frank", "Carlos Ruiz")
  archivoOrigen?: string;
  deliveryId?: string; // Reference to delivery / export
  tipoRegistro: 'vinculado_archivo' | 'manual_sin_detalle';
  phones?: string[]; // Lista exacta de teléfonos cuando está disponible
  observaciones?: string;
  createdAt: string;
}

export interface WeeklyReportRow {
  fecha: string; // Display format e.g. "28-sep" o "28/09/2026"
  fechaIso?: string;
  ciudad: string;
  cliente?: string;
  campaña?: string;
  leads: number;
}

export interface WeeklyReport {
  id: string;
  numeroSemana: number; // e.g. 40
  año: number; // e.g. 2026
  semanaOperativa: string; // e.g. "2026-W40"
  rangoFechas: string; // e.g. "28 septiembre - 4 octubre"
  tipoReporte: 'individual_cliente' | 'campaña' | 'ciudad' | 'responsable' | 'consolidado';
  clienteId?: string;
  clienteNombre?: string;
  campaña?: string;
  ciudad?: string;
  responsable?: string;
  filas: WeeklyReportRow[];
  totalLeads: number;
  generadoPor: string;
  generadoEn: string;
  estado: 'generado' | 'corregido';
  correcciones?: {
    fecha: string;
    motivo: string;
    usuario: string;
    totalAnterior: number;
  }[];
}

export interface ReconciliationResult {
  id: string;
  semanaOperativa: string;
  proveedor: string;
  campaña: string;
  ciudad?: string;
  deliveryIds: string[];
  dumpFileName: string;
  totalEnviadosComparables: number;
  totalDumpValidos: number;
  coincidenciasCount: number;
  faltantesCount: number;
  noIdentificadosCount: number;
  duplicadosDumpCount: number;
  invalidosDumpCount: number;
  discrepanciasCount: number;
  tasaCoincidencia: number | null; // percentage
  detalles: {
    coincidencias: {
      phone: string;
      nombreEnviado?: string;
      nombreDump?: string;
      ciudadEnviada?: string;
      ciudadDump?: string;
      deliveryId?: string;
    }[];
    faltantes: {
      phone: string;
      nombre?: string;
      ciudad?: string;
      deliveryId?: string;
      fechaEnvio?: string;
    }[];
    noIdentificados: {
      phone: string;
      nombre?: string;
      ciudad?: string;
      rawPhone?: string;
    }[];
    duplicados: {
      phone: string;
      repeticiones: number;
      nombres?: string[];
    }[];
    invalidos: {
      rawPhone: string;
      motivo: string;
      filaIndex: number;
    }[];
    discrepancias: {
      phone: string;
      campo: string;
      valorEnviado: string;
      valorDump: string;
    }[];
  };
  fechaEjecucion: string;
  ejecutadoPor: string;
  observaciones?: string;
}

export type UserRole = 'admin' | 'distribucion' | 'conciliacion';

export interface UserProfile {
  id: string;
  nombre: string;
  email: string;
  roles: UserRole[];
  currentActiveRole: UserRole;
}
