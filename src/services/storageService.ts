import { cloudStore } from './cloudStore';
import {
  Lead,
  ProcessingBatch,
  Delivery,
  CityAlias,
  WeeklyGoal,
  AuditLog,
  ColumnMapping,
  LeadStatus,
  Client,
  LeadDistribution,
  WeeklyReport,
  ReconciliationResult,
  UserProfile,
  UserRole,
} from '../types';
import { DEFAULT_CITY_CATALOG } from '../utils/cityNormalizer';

const STORAGE_KEYS = {
  LEADS: 'lom_leads_v1',
  BATCHES: 'lom_batches_v1',
  DELIVERIES: 'lom_deliveries_v1',
  CITY_CATALOG: 'lom_cities_v1',
  WEEKLY_GOALS: 'lom_goals_v1',
  AUDIT_LOGS: 'lom_audit_v1',
  COLUMN_MAPPINGS: 'lom_mappings_v1',
  SETTINGS: 'lom_settings_v1',
  CLIENTS: 'lom_clients_v1',
  DISTRIBUTIONS: 'lom_distributions_v1',
  WEEKLY_REPORTS: 'lom_weekly_reports_v1',
  RECONCILIATIONS: 'lom_reconciliations_v1',
  USER_PROFILE: 'lom_user_profile_v1',
};

export interface AppSettings {
  defaultCampaign: string;
  timezone: string;
  dateFormat: string;
  defaultBatchSize: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultCampaign: 'Pensiones',
  timezone: 'America/Mexico_City',
  dateFormat: 'DD/MM/YYYY',
  defaultBatchSize: 1000,
};

const DEFAULT_USER_PROFILE: UserProfile = {
  id: '',
  nombre: '',
  email: '',
  roles: [],
  currentActiveRole: 'admin',
};

const DEFAULT_CLIENTS: Client[] = [
  {
    id: 'cli-tkm-reina-frank',
    nombreComercial: 'TKM Reina & Frank',
    campañas: ['Pensiones'],
    contactoNombre: 'Reina & Frank',
    contactoEmail: 'contacto@tkmreinafrank.com',
    contactoTelefono: '+525512345678',
    estado: 'activo',
    fechaAlta: '01/09/2026',
    observaciones: 'Cliente principal para campañas de Pensiones en Acapulco y plazas estratégicas.',
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
  },
  {
    id: 'cli-callcenter-vapi',
    nombreComercial: 'Call Center Vapi',
    campañas: ['Pensiones', 'Retiro Activo'],
    contactoNombre: 'Lic. Armando Morales',
    contactoEmail: 'operacion@vapi-center.mx',
    contactoTelefono: '+528183456789',
    estado: 'activo',
    fechaAlta: '15/09/2026',
    observaciones: 'Canal automatizado y de marcación rápida para leads de Monterrey y Guadalajara.',
    createdAt: '2026-09-15T09:30:00.000Z',
    updatedAt: '2026-09-15T09:30:00.000Z',
  },
  {
    id: 'cli-asesores-bajio',
    nombreComercial: 'Asesores Patrimoniales del Bajío',
    campañas: ['Pensiones'],
    contactoNombre: 'Mtra. Sofía Villalpando',
    contactoEmail: 'svillalpando@bajioasesores.com',
    contactoTelefono: '+524771239876',
    estado: 'activo',
    fechaAlta: '20/09/2026',
    observaciones: 'Plazas de León, Querétaro y Puebla.',
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
  },
];

// Reference historical distributions for Semana 40 (28 sep - 4 oct)
const DEFAULT_DISTRIBUTIONS: LeadDistribution[] = [
  {
    id: 'dist-sem40-1',
    fechaEnvio: '28/09/2026',
    clienteId: 'cli-tkm-reina-frank',
    clienteNombre: 'TKM Reina & Frank',
    campaña: 'Pensiones',
    ciudad: 'Acapulco',
    cantidad: 12,
    responsable: 'Reina & Frank',
    tipoRegistro: 'manual_sin_detalle',
    observaciones: 'Distribución inicial matutina Semana 40',
    createdAt: '2026-09-28T09:15:00.000Z',
  },
  {
    id: 'dist-sem40-2',
    fechaEnvio: '30/09/2026',
    clienteId: 'cli-tkm-reina-frank',
    clienteNombre: 'TKM Reina & Frank',
    campaña: 'Pensiones',
    ciudad: 'Acapulco',
    cantidad: 36,
    responsable: 'Reina & Frank',
    tipoRegistro: 'manual_sin_detalle',
    observaciones: 'Distribución intermedia Semana 40',
    createdAt: '2026-09-30T11:30:00.000Z',
  },
  {
    id: 'dist-sem40-3',
    fechaEnvio: '02/10/2026',
    clienteId: 'cli-tkm-reina-frank',
    clienteNombre: 'TKM Reina & Frank',
    campaña: 'Pensiones',
    ciudad: 'Acapulco',
    cantidad: 24,
    responsable: 'Reina & Frank',
    tipoRegistro: 'manual_sin_detalle',
    observaciones: 'Cierre de distribución semanal Acapulco (Total semana = 72)',
    createdAt: '2026-10-02T14:45:00.000Z',
  },
];

// Initial default weekly goals for standard cities for Week 41 (Oct 2026)
const INITIAL_GOALS: WeeklyGoal[] = [
  {
    id: '2026-W41_Monterrey',
    semanaOperativa: '2026-W41',
    ciudad: 'Monterrey',
    metaProcesamiento: 350,
    metaEntrega: 300,
  },
  {
    id: '2026-W41_Guadalajara',
    semanaOperativa: '2026-W41',
    ciudad: 'Guadalajara',
    metaProcesamiento: 300,
    metaEntrega: 250,
  },
  {
    id: '2026-W41_Ciudad de México',
    semanaOperativa: '2026-W41',
    ciudad: 'Ciudad de México',
    metaProcesamiento: 500,
    metaEntrega: 450,
  },
  {
    id: '2026-W41_Puebla',
    semanaOperativa: '2026-W41',
    ciudad: 'Puebla',
    metaProcesamiento: 200,
    metaEntrega: 180,
  },
  {
    id: '2026-W41_Acapulco',
    semanaOperativa: '2026-W41',
    ciudad: 'Acapulco',
    metaProcesamiento: 150,
    metaEntrega: 120,
  },
  {
    id: '2026-W41_Tijuana',
    semanaOperativa: '2026-W41',
    ciudad: 'Tijuana',
    metaProcesamiento: 180,
    metaEntrega: 150,
  },
];

type ChangeListener = () => void;

class StorageService {
  private listeners: Set<ChangeListener> = new Set();

  public async initialize(profile: UserProfile, workspace: string) {
    await cloudStore.open(workspace);
    const empty = !cloudStore.hasData();
    this.saveUserProfile(profile);
    if (empty && profile.roles.includes('admin')) {
      this.initDefaults();
      await cloudStore.flush();
    }
    this.notify();
  }

  public flush() { return cloudStore.flush(); }
  public async refresh() {
    const profile = this.getUserProfile();
    await cloudStore.flush();
    await cloudStore.reload();
    this.saveUserProfile(profile);
    this.notify();
  }
  public disconnect() { cloudStore.reset(); this.notify(); }
  public async discardAndRefresh() {
    const profile = this.getUserProfile();
    await cloudStore.reload();
    this.saveUserProfile(profile);
    this.notify();
  }
  public hasLegacyData() {
    return Object.values(STORAGE_KEYS).filter(key => key !== STORAGE_KEYS.USER_PROFILE).some(key => localStorage.getItem(key));
  }
  public async importLegacyData() {
    const data: Record<string, unknown> = {};
    for (const [key, collection] of Object.entries({
      lom_leads_v1:'leads',lom_batches_v1:'batches',lom_deliveries_v1:'deliveries',lom_clients_v1:'clients',
      lom_distributions_v1:'distributions',lom_weekly_reports_v1:'weeklyReports',lom_reconciliations_v1:'reconciliations',
      lom_cities_v1:'cities',lom_goals_v1:'goals',lom_mappings_v1:'mappings',lom_settings_v1:'settings',lom_audit_v1:'auditLogs'
    })) {
      const raw = localStorage.getItem(key); if (raw) data[collection] = JSON.parse(raw);
    }
    const result = this.importAndVerifyDatabaseJson(JSON.stringify({data}), this.getUserProfile().email);
    if (!result.success) throw new Error(result.message);
    await this.flush();
    // Keep the original browser copy until the administrator explicitly removes it.
  }

  private initDefaults() {
    if (!cloudStore.getItem(STORAGE_KEYS.CITY_CATALOG)) {
      this.saveCities(DEFAULT_CITY_CATALOG);
    }
    if (!cloudStore.getItem(STORAGE_KEYS.WEEKLY_GOALS)) {
      this.saveGoals(INITIAL_GOALS);
    }
    if (!cloudStore.getItem(STORAGE_KEYS.SETTINGS)) {
      this.saveSettings(DEFAULT_SETTINGS);
    }
    if (!cloudStore.getItem(STORAGE_KEYS.CLIENTS)) {
      this.saveClients(DEFAULT_CLIENTS);
    }
    if (!cloudStore.getItem(STORAGE_KEYS.DISTRIBUTIONS)) {
      this.saveDistributions(DEFAULT_DISTRIBUTIONS);
    }
    if (!cloudStore.getItem(STORAGE_KEYS.USER_PROFILE)) {
      this.saveUserProfile(DEFAULT_USER_PROFILE);
    }
  }

  public subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // --- User Profile & Active Role ---
  public getUserProfile(): UserProfile {
    try {
      const data = cloudStore.getItem(STORAGE_KEYS.USER_PROFILE);
      return data ? JSON.parse(data) : DEFAULT_USER_PROFILE;
    } catch {
      return DEFAULT_USER_PROFILE;
    }
  }

  public saveUserProfile(profile: UserProfile) {
    cloudStore.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    this.notify();
  }

  public setCurrentRole(role: UserRole) {
    const profile = this.getUserProfile();
    if (!profile.roles.includes(role)) throw new Error('Rol no autorizado');
    profile.currentActiveRole = role;
    this.saveUserProfile(profile);
    this.addAuditLog('user', profile.id, 'CAMBIO_ROL_ACTIVO', `Rol activo cambiado a: ${role}`, profile.nombre);
  }

  // --- Leads ---
  public getLeads(): Lead[] {
    try {
      const data = cloudStore.getItem(STORAGE_KEYS.LEADS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public getLeadsMap(): Map<string, Lead> {
    const list = this.getLeads();
    const map = new Map<string, Lead>();
    list.forEach((l) => {
      const key = l.normalizedPhone || l.id;
      map.set(key, l);
    });
    return map;
  }

  public saveLeads(leads: Lead[]) {
    cloudStore.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads));
    this.notify();
  }

  public updateLead(updatedLead: Lead, action: string, reason: string, user: string = 'Operador') {
    const leads = this.getLeads();
    const index = leads.findIndex((l) => l.id === updatedLead.id);
    const nowIso = new Date().toISOString();

    const historyEntry = {
      timestamp: nowIso,
      previousStatus: index !== -1 ? leads[index].status : updatedLead.status,
      newStatus: updatedLead.status,
      action,
      reason,
      user: this.getUserProfile().email,
    };

    updatedLead.reviewHistory = [historyEntry, ...(updatedLead.reviewHistory || [])];
    updatedLead.updatedAt = nowIso;

    if (index !== -1) {
      leads[index] = updatedLead;
    } else {
      leads.push(updatedLead);
    }

    this.saveLeads(leads);
    this.addAuditLog('lead', updatedLead.id, action, `${reason} - Estado: ${updatedLead.status}`, user);
  }

  public bulkUpdateLeadStatus(
    leadIds: string[],
    newStatus: LeadStatus,
    reason: string,
    user: string = 'Operador'
  ) {
    const leads = this.getLeads();
    const nowIso = new Date().toISOString();
    let modified = 0;

    leads.forEach((l) => {
      if (leadIds.includes(l.id)) {
        l.reviewHistory.unshift({
          timestamp: nowIso,
          previousStatus: l.status,
          newStatus,
          action: `CAMBIO_MASIVO_A_${newStatus.toUpperCase()}`,
          reason,
          user,
        });
        l.status = newStatus;
        if (newStatus === 'accepted') {
          l.reviewReason = 'VALID';
          l.reviewDetail = `Aprobado manualmente: ${reason}`;
        }
        l.updatedAt = nowIso;
        modified++;
      }
    });

    if (modified > 0) {
      this.saveLeads(leads);
      this.addAuditLog('lead', 'BULK', `CAMBIO_MASIVO_${newStatus.toUpperCase()}`, `${modified} leads actualizados. Motivo: ${reason}`, user);
    }
  }

  // --- Batches ---
  public getBatches(): ProcessingBatch[] {
    try {
      const data = cloudStore.getItem(STORAGE_KEYS.BATCHES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public saveBatch(batch: ProcessingBatch) {
    const batches = this.getBatches();
    batches.unshift(batch);
    cloudStore.setItem(STORAGE_KEYS.BATCHES, JSON.stringify(batches));
    this.addAuditLog('batch', batch.id, 'CREACION_LOTE', `Lote "${batch.name}" creado con ${batch.totalRowsRead} registros`);
    this.notify();
  }

  // --- Deliveries ---
  public getDeliveries(): Delivery[] {
    try {
      const data = cloudStore.getItem(STORAGE_KEYS.DELIVERIES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public saveDelivery(delivery: Delivery) {
    const deliveries = this.getDeliveries();
    deliveries.unshift(delivery);
    cloudStore.setItem(STORAGE_KEYS.DELIVERIES, JSON.stringify(deliveries));

    // Update deliveredCount on associated leads
    const leads = this.getLeads();
    const leadIdSet = new Set(delivery.leadIds);
    let updatedCount = 0;

    leads.forEach((lead) => {
      if (leadIdSet.has(lead.id) || (lead.normalizedPhone && leadIdSet.has(lead.normalizedPhone))) {
        lead.deliveredCount = (lead.deliveredCount || 0) + 1;
        lead.lastDeliveredAt = delivery.fechaEntrega;
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      this.saveLeads(leads);
    }

    this.addAuditLog(
      'delivery',
      delivery.id,
      'REGISTRO_ENTREGA',
      `Entrega confirmada a "${delivery.destinatario}" de ${delivery.leadsCount} leads en ${delivery.ciudad} (${delivery.formato})`
    );
    this.notify();
  }

  // --- Clients (Directorio de Clientes) ---
  public getClients(): Client[] {
    try {
      const data = cloudStore.getItem(STORAGE_KEYS.CLIENTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public saveClients(clients: Client[]) {
    cloudStore.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(clients));
    this.notify();
  }

  public upsertClient(client: Client, user: string = 'Administrador') {
    const clients = this.getClients();
    const idx = clients.findIndex((c) => c.id === client.id);
    const nowIso = new Date().toISOString();

    if (idx !== -1) {
      client.updatedAt = nowIso;
      clients[idx] = client;
      this.addAuditLog('client', client.id, 'EDICION_CLIENTE', `Cliente "${client.nombreComercial}" actualizado`, user);
    } else {
      client.createdAt = nowIso;
      client.updatedAt = nowIso;
      clients.unshift(client);
      this.addAuditLog('client', client.id, 'ALTA_CLIENTE', `Cliente "${client.nombreComercial}" dado de alta`, user);
    }

    this.saveClients(clients);
  }

  // --- Lead Distributions (Distribución de leads) ---
  public getDistributions(): LeadDistribution[] {
    try {
      const data = cloudStore.getItem(STORAGE_KEYS.DISTRIBUTIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public saveDistributions(dists: LeadDistribution[]) {
    cloudStore.setItem(STORAGE_KEYS.DISTRIBUTIONS, JSON.stringify(dists));
    this.notify();
  }

  public addDistribution(dist: LeadDistribution, user: string = 'Responsable Distribución') {
    const list = this.getDistributions();
    list.unshift(dist);
    this.saveDistributions(list);
    this.addAuditLog(
      'distribution',
      dist.id,
      'DISTRIBUCION_REGISTRADA',
      `Envío de ${dist.cantidad} leads a "${dist.clienteNombre}" en ${dist.ciudad} (${dist.campaña}) por ${dist.responsable}`,
      user
    );
  }

  // --- Weekly Reports (Reportes Semanales Históricos Inmutables) ---
  public getWeeklyReports(): WeeklyReport[] {
    try {
      const data = cloudStore.getItem(STORAGE_KEYS.WEEKLY_REPORTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public saveWeeklyReports(reports: WeeklyReport[]) {
    cloudStore.setItem(STORAGE_KEYS.WEEKLY_REPORTS, JSON.stringify(reports));
    this.notify();
  }

  public addWeeklyReport(report: WeeklyReport, user: string = 'Operador') {
    const list = this.getWeeklyReports();
    list.unshift(report);
    this.saveWeeklyReports(list);
    this.addAuditLog(
      'report',
      report.id,
      'REPORTE_SEMANAL_GENERADO',
      `Reporte generado: Sem ${report.numeroSemana} (${report.rangoFechas}) - ${report.clienteNombre || 'Consolidado'} - ${report.totalLeads} leads`,
      user
    );
  }

  public correctWeeklyReport(
    reportId: string,
    motivo: string,
    nuevasFilas: WeeklyReport['filas'],
    nuevoTotal: number,
    user: string = 'Administrador'
  ) {
    const list = this.getWeeklyReports();
    const idx = list.findIndex((r) => r.id === reportId);
    if (idx !== -1) {
      const r = list[idx];
      const ahora = new Date().toISOString();
      const correccion = {
        fecha: ahora,
        motivo,
        usuario: user,
        totalAnterior: r.totalLeads,
      };
      r.correcciones = [correccion, ...(r.correcciones || [])];
      r.estado = 'corregido';
      r.filas = nuevasFilas;
      r.totalLeads = nuevoTotal;
      this.saveWeeklyReports(list);
      this.addAuditLog(
        'report',
        reportId,
        'CORRECCION_REPORTE',
        `Reporte ${reportId} corregido. Motivo: ${motivo}. Nuevo total: ${nuevoTotal}`,
        user
      );
    }
  }

  // --- Reconciliations (Conciliación Semanal de Dumps) ---
  public getReconciliations(): ReconciliationResult[] {
    try {
      const data = cloudStore.getItem(STORAGE_KEYS.RECONCILIATIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public saveReconciliations(recs: ReconciliationResult[]) {
    cloudStore.setItem(STORAGE_KEYS.RECONCILIATIONS, JSON.stringify(recs));
    this.notify();
  }

  public addReconciliation(rec: ReconciliationResult, user: string = 'Responsable Conciliación') {
    const list = this.getReconciliations();
    list.unshift(rec);
    this.saveReconciliations(list);
    this.addAuditLog(
      'reconciliation',
      rec.id,
      'CONCILIACION_EJECUTADA',
      `Conciliación ${rec.semanaOperativa} con ${rec.proveedor}: ${rec.coincidenciasCount} coincidencias de ${rec.totalEnviadosComparables} enviados (${rec.tasaCoincidencia !== null ? rec.tasaCoincidencia + '%' : 'N/A'})`,
      user
    );
  }

  // --- City Catalog ---
  public getCities(): CityAlias[] {
    try {
      const data = cloudStore.getItem(STORAGE_KEYS.CITY_CATALOG);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public saveCities(cities: CityAlias[]) {
    cloudStore.setItem(STORAGE_KEYS.CITY_CATALOG, JSON.stringify(cities));
    this.notify();
  }

  // --- Weekly Goals ---
  public getGoals(): WeeklyGoal[] {
    try {
      const data = cloudStore.getItem(STORAGE_KEYS.WEEKLY_GOALS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public saveGoals(goals: WeeklyGoal[]) {
    cloudStore.setItem(STORAGE_KEYS.WEEKLY_GOALS, JSON.stringify(goals));
    this.notify();
  }

  public upsertGoal(goal: WeeklyGoal) {
    const goals = this.getGoals();
    const index = goals.findIndex((g) => g.id === goal.id);
    if (index !== -1) {
      goals[index] = goal;
    } else {
      goals.push(goal);
    }
    this.saveGoals(goals);
  }

  // --- Settings ---
  public getSettings(): AppSettings {
    try {
      const data = cloudStore.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  public saveSettings(settings: AppSettings) {
    cloudStore.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    this.notify();
  }

  // --- Column Mappings presets ---
  public getMappings(): Record<string, ColumnMapping> {
    try {
      const data = cloudStore.getItem(STORAGE_KEYS.COLUMN_MAPPINGS);
      return data
        ? JSON.parse(data)
        : {
            meta_ads: {
              adsetColumn: 'adset_name',
              nameColumn: 'full_name',
              phoneColumn: 'phone_number',
              createdTimeColumn: 'created_time',
              headerRowIndex: 0,
            },
            external_row2: {
              adsetColumn: 'adset_name',
              nameColumn: 'nombre_y_apellidos',
              phoneColumn: 'número_de_teléfono',
              createdTimeColumn: 'created_time',
              headerRowIndex: 1,
            },
          };
    } catch {
      return {};
    }
  }

  public saveMapping(sourceKey: string, mapping: ColumnMapping) {
    const mappings = this.getMappings();
    mappings[sourceKey] = mapping;
    cloudStore.setItem(STORAGE_KEYS.COLUMN_MAPPINGS, JSON.stringify(mappings));
    this.notify();
  }

  // --- Audit Logs ---
  public getAuditLogs(): AuditLog[] {
    try {
      const data = cloudStore.getItem(STORAGE_KEYS.AUDIT_LOGS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public addAuditLog(
    entityType: AuditLog['entityType'] | string,
    entityId: string,
    action: string,
    details: string,
    user: string = 'Sistema'
  ) {
    const logs = this.getAuditLogs();
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      entityType: entityType as AuditLog['entityType'],
      entityId,
      details,
      user: this.getUserProfile().email,
    };
    logs.unshift(newLog);
    cloudStore.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs));
    this.notify();
  }

  // --- Export and Import Complete State for Safe Migration & Backup ---
  public exportCompleteDatabaseJson(): string {
    const payload = {
      app: 'Lead Operations Manager',
      exportedAt: new Date().toISOString(),
      version: '2.5.0',
      data: {
        leads: this.getLeads(),
        batches: this.getBatches(),
        deliveries: this.getDeliveries(),
        clients: this.getClients(),
        distributions: this.getDistributions(),
        weeklyReports: this.getWeeklyReports(),
        reconciliations: this.getReconciliations(),
        cities: this.getCities(),
        goals: this.getGoals(),
        mappings: this.getMappings(),
        settings: this.getSettings(),
        auditLogs: this.getAuditLogs(),
      },
    };
    return JSON.stringify(payload, null, 2);
  }

  public importAndVerifyDatabaseJson(jsonString: string, user: string = 'Administrador'): {
    success: boolean;
    counts: Record<string, number>;
    message: string;
  } {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.data) {
        throw new Error('Estructura de respaldo no válida: falta propiedad data');
      }

      const d = parsed.data;
      // Validate the entire backup before changing any working data.
      for (const field of ['leads','batches','deliveries','clients','distributions','weeklyReports','reconciliations','cities','goals','auditLogs']) {
        if (d[field] === undefined) continue;
        if (!Array.isArray(d[field])) throw new Error('Colección inválida: '+field);
        const ids = new Set<string>();
        for (const row of d[field]) {
          if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw new Error('Identificador inválido o duplicado: '+field);
          ids.add(row.id);
        }
      }
      if (d.mappings) cloudStore.setItem(STORAGE_KEYS.COLUMN_MAPPINGS, JSON.stringify(d.mappings));
      if (Array.isArray(d.leads)) this.saveLeads(d.leads);
      if (Array.isArray(d.batches)) cloudStore.setItem(STORAGE_KEYS.BATCHES, JSON.stringify(d.batches));
      if (Array.isArray(d.deliveries)) cloudStore.setItem(STORAGE_KEYS.DELIVERIES, JSON.stringify(d.deliveries));
      if (Array.isArray(d.clients)) this.saveClients(d.clients);
      if (Array.isArray(d.distributions)) this.saveDistributions(d.distributions);
      if (Array.isArray(d.weeklyReports)) this.saveWeeklyReports(d.weeklyReports);
      if (Array.isArray(d.reconciliations)) this.saveReconciliations(d.reconciliations);
      if (Array.isArray(d.cities)) this.saveCities(d.cities);
      if (Array.isArray(d.goals)) this.saveGoals(d.goals);
      if (Array.isArray(d.auditLogs)) {
        const existing = this.getAuditLogs();
        const ids = new Set(existing.map(row => row.id));
        cloudStore.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify([...existing,...d.auditLogs.filter((row: AuditLog) => !ids.has(row.id))]));
      }
      if (d.settings) this.saveSettings(d.settings);

      const counts = {
        leads: this.getLeads().length,
        batches: this.getBatches().length,
        deliveries: this.getDeliveries().length,
        clients: this.getClients().length,
        distributions: this.getDistributions().length,
        reports: this.getWeeklyReports().length,
        reconciliations: this.getReconciliations().length,
      };

      this.addAuditLog(
        'migration',
        'BACKUP_RESTORE',
        'RESTAURACION_BASE_DATOS',
        `Datos migrados y verificados exitosamente: ${counts.leads} leads, ${counts.clients} clientes, ${counts.distributions} distribuciones.`,
        user
      );

      this.notify();
      return {
        success: true,
        counts,
        message: 'Restauración y verificación completadas con éxito.',
      };
    } catch (err) {
      return {
        success: false,
        counts: {},
        message: `Error al importar archivo: ${(err as Error).message}`,
      };
    }
  }

  // --- Clear / Reset ---
  public clearAll() {
    const profile = this.getUserProfile();
    const logs = this.getAuditLogs();
    Object.values(STORAGE_KEYS).filter(k => k !== STORAGE_KEYS.AUDIT_LOGS).forEach((k) => cloudStore.removeItem(k));
    this.initDefaults();
    this.saveUserProfile(profile);
    cloudStore.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs));
    this.addAuditLog('migration', 'RESET', 'RESTABLECIMIENTO', 'Restablecimiento solicitado por administrador');
    this.notify();
  }
}

export const storageService = new StorageService();
