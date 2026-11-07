import { Lead, LeadOccurrence, LeadStatus, ReviewReason, CityAlias } from '../types';
import { normalizeMexicanPhone } from './phoneNormalizer';
import { normalizeCityFromAdset } from './cityNormalizer';
import { cleanAndValidateName } from './nameCleaner';

export interface RawInputRecord {
  rawAdset: string;
  rawName: string;
  rawPhone: string;
  createdTime?: string;
  sourceFile: string;
  sourceType: string;
}

export interface DeduplicationBatchResult {
  consolidatedLeads: Lead[];
  totalRecordsProcessed: number;
  duplicateCount: number;
  cityConflictCount: number;
  reimportedCount: number;
  acceptedCount: number;
  pendingReviewCount: number;
  rejectedCount: number;
}

// Compare name completeness: returns true if nameA is strictly more complete than nameB
function isNameMoreComplete(nameA: string, nameB: string): boolean {
  if (!nameB) return true;
  if (!nameA) return false;
  const wordsA = nameA.trim().split(/\s+/).length;
  const wordsB = nameB.trim().split(/\s+/).length;
  if (wordsA !== wordsB) return wordsA > wordsB;
  return nameA.trim().length > nameB.trim().length;
}

export function processAndDeduplicateLeads(
  records: RawInputRecord[],
  batchId: string,
  batchName: string,
  fechaAlta: string,
  campaign: string,
  existingLeadsMap: Map<string, Lead>, // normalizedPhone -> Lead
  cityCatalog: CityAlias[]
): DeduplicationBatchResult {
  const updatedLeadsMap = new Map<string, Lead>(existingLeadsMap);
  let duplicateCount = 0;
  let cityConflictCount = 0;
  let reimportedCount = 0;

  const nowIso = new Date().toISOString();

  records.forEach((record, index) => {
    const phoneRes = normalizeMexicanPhone(record.rawPhone);
    const cityRes = normalizeCityFromAdset(record.rawAdset, cityCatalog);
    const nameRes = cleanAndValidateName(record.rawName);

    // Primary key: normalized phone if valid, or a synthetic key with rawPhone if invalid
    const key = phoneRes.isValid ? phoneRes.normalized : `INV_${record.rawPhone.replace(/\s+/g, '')}_${index}`;

    const occurrence: LeadOccurrence = {
      occurrenceId: `occ-${batchId}-${index}-${Date.now()}`,
      batchId,
      batchName,
      sourceFile: record.sourceFile,
      sourceType: record.sourceType,
      rawAdset: record.rawAdset,
      rawName: record.rawName,
      rawPhone: record.rawPhone,
      detectedCity: cityRes.isResolved ? cityRes.canonicalCity : null,
      createdTime: record.createdTime,
      importedAt: nowIso,
    };

    const existingLead = updatedLeadsMap.get(key);

    if (existingLead) {
      // It's a duplicate or re-import!
      duplicateCount++;

      // Check if it's identical re-import from the exact same source file and batch
      const alreadyInFile = existingLead.occurrences.some(
        (occ) => occ.sourceFile === record.sourceFile && occ.rawName === record.rawName && occ.rawAdset === record.rawAdset
      );
      if (alreadyInFile) {
        reimportedCount++;
      }

      // Check city conflict: if the new occurrence resolved to a different valid city than the existing canonical city
      if (
        cityRes.isResolved &&
        existingLead.ciudad &&
        cityRes.canonicalCity.toLowerCase() !== existingLead.ciudad.toLowerCase()
      ) {
        cityConflictCount++;
        if (!existingLead.cityConflict) {
          existingLead.cityConflict = {
            firstCity: existingLead.ciudad,
            conflictingCity: cityRes.canonicalCity,
            details: `Conflicto: Primera aparición registrada en "${existingLead.ciudad}" (Lote: ${existingLead.firstOccurrenceBatchId}), nueva aparición en "${cityRes.canonicalCity}" (Archivo: ${record.sourceFile}). Se mantiene la primera por regla operativa.`,
          };
          // If lead was previously accepted, tag review note or maintain state with conflict audit
          if (existingLead.status === 'accepted') {
            existingLead.reviewHistory.push({
              timestamp: nowIso,
              previousStatus: existingLead.status,
              newStatus: existingLead.status,
              action: 'CONFLICTO_CIUDADES_DETECTADO',
              reason: `Reaparición en ciudad diferente: ${cityRes.canonicalCity}. Se preserva ${existingLead.ciudad}`,
              user: 'Sistema Automático',
            });
          }
        }
      }

      // Check if new name is more complete / reliable than existing name
      if (nameRes.status === 'accepted' && isNameMoreComplete(nameRes.cleanedName, existingLead.nombre)) {
        existingLead.nombre = nameRes.cleanedName;
        existingLead.rawNombre = record.rawName;
        if (existingLead.status === 'pending_review' && existingLead.reviewReason.startsWith('NOMBRE')) {
          existingLead.status = 'accepted';
          existingLead.reviewReason = 'VALID';
          existingLead.reviewDetail = 'Nombre actualizado por aparición más completa en nueva fuente';
        }
      }

      // Supplement city if previous lead had no resolved city and new occurrence has one
      if (!existingLead.ciudad && cityRes.isResolved) {
        existingLead.ciudad = cityRes.canonicalCity;
        if (existingLead.reviewReason === 'CIUDAD_NO_IDENTIFICADA') {
          // If phone and name are valid, upgrade status
          if (phoneRes.isValid && existingLead.status === 'pending_review') {
            existingLead.status = 'accepted';
            existingLead.reviewReason = 'VALID';
            existingLead.reviewDetail = 'Ciudad resuelta a partir de nueva aparición';
          }
        }
      }

      // Add to occurrences audit trail
      existingLead.occurrences.push(occurrence);
      existingLead.updatedAt = nowIso;
      updatedLeadsMap.set(key, existingLead);
    } else {
      // First time lead is seen!
      // Evaluate consolidated status and review reason
      let status: LeadStatus = 'accepted';
      let reason: ReviewReason = 'VALID';
      let detail = 'Lead completamente validado y listo para entrega';

      // 1. Phone check
      if (!phoneRes.isValid) {
        status = 'rejected';
        reason = phoneRes.rejectionReason?.includes('no permitidos')
          ? 'TELEFONO_CARACTERES_NO_NUMERICOS'
          : phoneRes.rejectionReason?.includes('incompleto')
          ? 'TELEFONO_INCOMPLETO'
          : 'TELEFONO_INVALIDO';
        detail = phoneRes.rejectionReason || 'Teléfono no cumple formato mexicano estándar';
      }
      // 2. City check
      else if (!cityRes.isResolved) {
        status = 'pending_review';
        reason = cityRes.isAmbiguous ? 'CIUDAD_AMBIGUA' : 'CIUDAD_NO_IDENTIFICADA';
        detail = cityRes.rejectionReason || 'Ciudad no identificada en adset_name';
      }
      // 3. Name check
      else if (nameRes.status !== 'accepted') {
        status = nameRes.status;
        reason = nameRes.reason;
        detail = nameRes.detail;
      }

      const newLead: Lead = {
        id: key,
        normalizedPhone: phoneRes.isValid ? phoneRes.normalized : '',
        rawPhone: record.rawPhone,
        nombre: nameRes.cleanedName || record.rawName,
        rawNombre: record.rawName,
        ciudad: cityRes.isResolved ? cityRes.canonicalCity : '',
        rawAdset: record.rawAdset,
        campaign: campaign || 'Pensiones',
        fechaAlta,
        status,
        reviewReason: reason,
        reviewDetail: detail,
        reviewHistory: [
          {
            timestamp: nowIso,
            previousStatus: 'pending_review',
            newStatus: status,
            action: 'IMPORTACION_INICIAL',
            reason: detail,
            user: 'Sistema Automático',
          },
        ],
        firstOccurrenceBatchId: batchId,
        firstOccurrenceDate: fechaAlta,
        occurrences: [occurrence],
        exportedCount: 0,
        deliveredCount: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      updatedLeadsMap.set(key, newLead);
    }
  });

  const consolidatedLeads = Array.from(updatedLeadsMap.values());

  let acceptedCount = 0;
  let pendingReviewCount = 0;
  let rejectedCount = 0;

  for (const lead of consolidatedLeads) {
    if (lead.status === 'accepted') acceptedCount++;
    else if (lead.status === 'pending_review') pendingReviewCount++;
    else if (lead.status === 'rejected') rejectedCount++;
  }

  return {
    consolidatedLeads,
    totalRecordsProcessed: records.length,
    duplicateCount,
    cityConflictCount,
    reimportedCount,
    acceptedCount,
    pendingReviewCount,
    rejectedCount,
  };
}
