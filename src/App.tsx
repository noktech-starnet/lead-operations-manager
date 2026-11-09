import { DatabaseAudit } from './components/auth/DatabaseAudit';
import { useAuth } from './components/auth/AuthGate';
import { SyncStatus } from './components/auth/SyncStatus';
import { TeamAccess } from './components/auth/TeamAccess';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { WeeklyDashboard } from './components/dashboard/WeeklyDashboard';
import { ClientsDirectoryView } from './components/clients/ClientsDirectoryView';
import { DistributionView } from './components/distribution/DistributionView';
import { WeeklyReportsView } from './components/reports/WeeklyReportsView';
import { ReconciliationView } from './components/reconciliation/ReconciliationView';
import { FileImportView } from './components/import/FileImportView';
import { CleaningCenterView } from './components/review/CleaningCenterView';
import { CitiesBreakdownView } from './components/cities/CitiesBreakdownView';
import { ExportsView } from './components/exports/ExportsView';
import { DeliveriesView } from './components/deliveries/DeliveriesView';
import { SettingsView } from './components/settings/SettingsView';
import { storageService } from './services/storageService';
import {
  Lead,
  ProcessingBatch,
  Delivery,
  CityAlias,
  WeeklyGoal,
  Client,
  LeadDistribution,
  WeeklyReport,
  ReconciliationResult,
  UserRole,
} from './types';
import { Sparkles, ArrowRight, ShieldCheck, Database } from 'lucide-react';
import { createSampleMetaAdsWorkbook, createPensionesDum8OctWorkbook } from './utils/sampleDataGenerator';
import { parseFileForPreview, extractRecordsFromFile } from './utils/fileParser';
import { processAndDeduplicateLeads } from './utils/deduplicator';

export default function App() {
  const { profile, signOut } = useAuth();
  const [accountError, setAccountError] = useState('');
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');

  // Core application data state
  const [leads, setLeads] = useState<Lead[]>(() => storageService.getLeads());
  const [batches, setBatches] = useState<ProcessingBatch[]>(() => storageService.getBatches());
  const [deliveries, setDeliveries] = useState<Delivery[]>(() => storageService.getDeliveries());
  const [cityCatalog, setCityCatalog] = useState<CityAlias[]>(() => storageService.getCities());
  const [goals, setGoals] = useState<WeeklyGoal[]>(() => storageService.getGoals());
  const [clients, setClients] = useState<Client[]>(() => storageService.getClients());
  const [distributions, setDistributions] = useState<LeadDistribution[]>(() => storageService.getDistributions());
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>(() => storageService.getWeeklyReports());
  const [reconciliations, setReconciliations] = useState<ReconciliationResult[]>(() => storageService.getReconciliations());

  // Current active role
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(() => storageService.getUserProfile().currentActiveRole);

  // Deep linking between views
  const [exportPreselectedCity, setExportPreselectedCity] = useState<string | undefined>(undefined);

  // Reload data from service
  const reloadData = useCallback(() => {
    setLeads(storageService.getLeads());
    setBatches(storageService.getBatches());
    setDeliveries(storageService.getDeliveries());
    setCityCatalog(storageService.getCities());
    setGoals(storageService.getGoals());
    setClients(storageService.getClients());
    setDistributions(storageService.getDistributions());
    setWeeklyReports(storageService.getWeeklyReports());
    setReconciliations(storageService.getReconciliations());
    setCurrentUserRole(storageService.getUserProfile().currentActiveRole);
  }, []);

  // Subscribe to storage changes
  useEffect(() => {
    const unsubscribe = storageService.subscribe(() => {
      reloadData();
    });
    return () => unsubscribe();
  }, [reloadData]);

  // Derived counts
  const pendingReviewCount = leads.filter((l) => l.status === 'pending_review').length;
  const acceptedCount = leads.filter((l) => l.status === 'accepted').length;

  // Role change handler
  const handleRoleChange = (role: UserRole) => {
    storageService.setCurrentRole(role);
    setCurrentUserRole(role);
  };

  // Cross-view navigation handlers
  const handleExportCity = (cityName: string) => {
    setExportPreselectedCity(cityName);
    setCurrentTab('exports');
  };

  const handleFilterCityInReview = (cityName: string) => {
    setCurrentTab('review');
  };

  // Quick seed initial demo dataset if database is empty so the user can see real data instantly
  const handleQuickSeedDemoData = async () => {
    const today = '09/10/2026';

    // 1. Ingest Meta Ads sample file
    const metaBlob = createSampleMetaAdsWorkbook();
    const metaFile = new File([metaBlob], 'meta_ads_leads_octubre.xlsx');
    const metaPreview = await parseFileForPreview(metaFile);
    const metaRecords = await extractRecordsFromFile(
      metaFile,
      metaPreview.suggestedMapping,
      'meta_ads'
    );

    const metaBatchId = 'batch-demo-meta';
    const existingMap = storageService.getLeadsMap();
    const currentCatalog = storageService.getCities();

    const metaDedupe = processAndDeduplicateLeads(
      metaRecords,
      metaBatchId,
      'Lote Semanal Meta Ads - Octubre',
      today,
      'Pensiones',
      existingMap,
      currentCatalog
    );

    storageService.saveLeads(metaDedupe.consolidatedLeads);

    const metaBatch: ProcessingBatch = {
      id: metaBatchId,
      name: 'Lote Semanal Meta Ads - Octubre',
      fechaAlta: today,
      campaign: 'Pensiones',
      sourceType: 'meta_ads',
      fileNames: [metaFile.name],
      totalRowsRead: metaRecords.length,
      totalUniqueLeads: metaDedupe.consolidatedLeads.length,
      acceptedLeadsCount: metaDedupe.acceptedCount,
      pendingReviewCount: metaDedupe.pendingReviewCount,
      rejectedCount: metaDedupe.rejectedCount,
      duplicatesFound: metaDedupe.duplicateCount,
      cityConflictsFound: metaDedupe.cityConflictCount,
      status: 'completado',
      createdAt: new Date().toISOString(),
    };
    storageService.saveBatch(metaBatch);

    // 2. Ingest pensionesdum8oct.xlsx sample file (headers in row 2)
    const dumBlob = createPensionesDum8OctWorkbook();
    const dumFile = new File([dumBlob], 'pensionesdum8oct.xlsx');
    const dumPreview = await parseFileForPreview(dumFile);
    const dumMapping = {
      ...dumPreview.suggestedMapping,
      headerRowIndex: 1, // row 2
    };
    const dumRecords = await extractRecordsFromFile(dumFile, dumMapping, 'external_row2');

    const dumBatchId = 'batch-demo-dum8oct';
    const updatedMap = storageService.getLeadsMap();

    const dumDedupe = processAndDeduplicateLeads(
      dumRecords,
      dumBatchId,
      'Lote Externo pensionesdum8oct',
      today,
      'Pensiones',
      updatedMap,
      currentCatalog
    );

    storageService.saveLeads(dumDedupe.consolidatedLeads);

    const dumBatch: ProcessingBatch = {
      id: dumBatchId,
      name: 'Lote Externo pensionesdum8oct',
      fechaAlta: today,
      campaign: 'Pensiones',
      sourceType: 'external_row2',
      fileNames: [dumFile.name],
      totalRowsRead: dumRecords.length,
      totalUniqueLeads: dumDedupe.consolidatedLeads.length,
      acceptedLeadsCount: dumDedupe.acceptedCount,
      pendingReviewCount: dumDedupe.pendingReviewCount,
      rejectedCount: dumDedupe.rejectedCount,
      duplicatesFound: dumDedupe.duplicateCount,
      cityConflictsFound: dumDedupe.cityConflictCount,
      status: 'completado',
      createdAt: new Date().toISOString(),
    };
    storageService.saveBatch(dumBatch);

    // 3. Register a confirmed delivery record to demonstrate Indicador 2
    const validMonterreyLeads = dumDedupe.consolidatedLeads
      .filter((l) => l.ciudad === 'Monterrey' && l.status === 'accepted')
      .slice(0, 3)
      .map((l) => l.normalizedPhone || l.id);

    if (validMonterreyLeads.length > 0) {
      const demoDelivery: Delivery = {
        id: `del-demo-1`,
        batchId: metaBatchId,
        ciudad: 'Monterrey',
        campaña: 'Pensiones',
        destinatario: 'TKM Reina & Frank',
        clienteId: 'cli-tkm-reina-frank',
        fechaEntrega: today,
        leadsCount: validMonterreyLeads.length,
        exportedLeadsCount: validMonterreyLeads.length,
        fileName: 'Monterrey_Pensiones_09_octubre.xlsx',
        formato: 'standard',
        semanaOperativa: '2026-W41',
        observaciones: 'Primera entrega semanal confirmada por acuse de recepción',
        estado: 'confirmada',
        leadIds: validMonterreyLeads,
        createdAt: new Date().toISOString(),
      };
      storageService.saveDelivery(demoDelivery);
    }

    await storageService.flush();
    reloadData();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row antialiased">
      {/* Sidebar Navigation with Groups & Role Switcher */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          if (tab !== 'exports') setExportPreselectedCity(undefined);
        }}
        pendingReviewCount={pendingReviewCount}
        acceptedCount={acceptedCount}
        currentUserRole={currentUserRole}
        allowedRoles={profile.roles}
        onRoleChange={handleRoleChange}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          currentTab={currentTab}
          onOpenImport={() => setCurrentTab('import')}
          onRefresh={() => void storageService.refresh().catch(() => setAccountError('No se pudieron actualizar los datos.'))}
          totalLeads={leads.length}
          totalBatches={batches.length}
          canImport={profile.roles.some(role => role === 'admin' || role === 'distribucion')}
          email={profile.email}
          onSignOut={() => void signOut()}
        />

        <SyncStatus />
        {accountError && <p role="alert" className="p-3 text-rose-300">{accountError}</p>}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* Quick Welcome Banner when dataset is completely empty */}
          {leads.length === 0 && profile.roles.some(role => role === 'admin' || role === 'distribucion') && (
            <div className="rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-5 animate-in fade-in">
              <div className="space-y-1.5 max-w-2xl">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Ambiente Operativo v2.5 Listo
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Lead Operations Manager — Ciclo Integral de Leads
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Depuración, directorio de clientes, bitácora de distribución, reportes semanales con conteo por fecha, conciliación de dumps y conservación permanente del histórico.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
                <button
                  onClick={() => void handleQuickSeedDemoData().catch(() => setAccountError('No se pudo confirmar el guardado de los datos de demostración.'))}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Cargar Datos de Demostración</span>
                </button>
                <button
                  onClick={() => setCurrentTab('import')}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border border-slate-700"
                >
                  <span>Importar Archivos</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Tab 1: DASHBOARD */}
          {currentTab === 'dashboard' && (
            <WeeklyDashboard
              leads={leads}
              deliveries={deliveries}
              goals={goals}
              cityCatalog={cityCatalog}
              clients={clients}
              distributions={distributions}
              reconciliations={reconciliations}
              onNavigateToReview={() => setCurrentTab('review')}
              onNavigateToExports={() => setCurrentTab('exports')}
              onNavigateToDeliveries={() => setCurrentTab('deliveries')}
              onNavigateToDistribution={() => setCurrentTab('distribution')}
              onNavigateToReconciliation={() => setCurrentTab('reconciliation')}
            />
          )}

          {/* Tab 2: CLIENTS DIRECTORY */}
          {currentTab === 'clients' && (
            <ClientsDirectoryView
              clients={clients}
              deliveries={deliveries}
              distributions={distributions}
              onRefresh={reloadData}
              currentUserRole={currentUserRole}
            />
          )}

          {/* Tab 3: LEAD DISTRIBUTION */}
          {currentTab === 'distribution' && (
            <DistributionView
              distributions={distributions}
              clients={clients}
              deliveries={deliveries}
              cityCatalog={cityCatalog}
              leads={leads}
              onRefresh={reloadData}
              currentUserRole={currentUserRole}
            />
          )}

          {/* Tab 4: WEEKLY REPORTS */}
          {currentTab === 'reports' && (
            <WeeklyReportsView
              distributions={distributions}
              clients={clients}
              weeklyReports={weeklyReports}
              onRefresh={reloadData}
              currentUserRole={currentUserRole}
            />
          )}

          {/* Tab 5: WEEKLY RECONCILIATION */}
          {currentTab === 'reconciliation' && (
            <ReconciliationView
              deliveries={deliveries}
              reconciliations={reconciliations}
              leads={leads}
              onRefresh={reloadData}
              currentUserRole={currentUserRole}
            />
          )}

          {/* Tab 6: FILE IMPORT */}
          {currentTab === 'import' && (
            <FileImportView
              onImportComplete={reloadData}
              onNavigateToReview={() => setCurrentTab('review')}
            />
          )}

          {/* Tab 7: CLEANING CENTER */}
          {currentTab === 'review' && (
            <CleaningCenterView
              canManageCities={profile.roles.includes('admin')}
              leads={leads}
              cityCatalog={cityCatalog}
              onRefresh={reloadData}
            />
          )}

          {/* Tab 8: CITIES BREAKDOWN */}
          {currentTab === 'cities' && (
            <CitiesBreakdownView
              leads={leads}
              cityCatalog={cityCatalog}
              onExportCity={handleExportCity}
              onFilterCityInReview={handleFilterCityInReview}
            />
          )}

          {/* Tab 9: EXPORTS */}
          {currentTab === 'exports' && (
            <ExportsView
              leads={leads}
              preselectedCity={exportPreselectedCity}
              onDeliveryCreated={reloadData}
            />
          )}

          {/* Tab 10: DELIVERIES */}
          {currentTab === 'deliveries' && (
            <DeliveriesView
              deliveries={deliveries}
              leads={leads}
              cityCatalog={cityCatalog}
              onRefresh={reloadData}
            />
          )}

          {/* Tab 11: SETTINGS, MIGRATION & AUDIT */}
          {currentTab === 'settings' && profile.roles.includes('admin') && (
            <><TeamAccess /><DatabaseAudit /><SettingsView
              cityCatalog={cityCatalog}
              goals={goals}
              onRefresh={reloadData}
              currentUserRole={currentUserRole}
            /></>
          )}
        </main>
      </div>
    </div>
  );
}
