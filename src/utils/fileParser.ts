import * as XLSX from 'xlsx';
import { ColumnMapping } from '../types';
import { RawInputRecord } from './deduplicator';

export interface ParsedSheetPreview {
  fileName: string;
  sheetName: string;
  totalRows: number;
  detectedHeaderRow: number; // 0-indexed: 0 means row 1, 1 means row 2
  rawRows: (string | number | null | undefined)[][];
  availableColumns: string[];
  suggestedMapping: ColumnMapping;
}

// Remove accents and symbols for flexible column name matching
function normalizeColHeader(header: string): string {
  return String(header || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function detectHeaderRowAndColumns(rawRows: (string | number | null | undefined)[][]): {
  headerRowIndex: number;
  headers: string[];
} {
  if (!rawRows || rawRows.length === 0) {
    return { headerRowIndex: 0, headers: [] };
  }

  // Examine first 4 rows to find the most likely header row
  let bestRowIndex = 0;
  let bestScore = -1;

  for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
    const row = rawRows[r] || [];
    const populatedCells = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== '');

    let score = 0;
    const headerCandidates = row.map((c) => normalizeColHeader(String(c || '')));

    // Known key markers
    const hasAdset = headerCandidates.some((h) => h.includes('adset') || h.includes('ciudad') || h.includes('conjunto') || h.includes('campana'));
    const hasName = headerCandidates.some((h) => h.includes('name') || h.includes('nombre') || h.includes('apellidos') || h.includes('lead'));
    const hasPhone = headerCandidates.some((h) => h.includes('phone') || h.includes('telefono') || h.includes('celular') || h.includes('numero'));

    if (hasAdset) score += 10;
    if (hasName) score += 10;
    if (hasPhone) score += 10;
    score += Math.min(populatedCells.length, 5);

    // If first row only has 1 or 2 strings, it's very often a title/report header
    if (r === 0 && populatedCells.length <= 2 && !hasName && !hasPhone) {
      score -= 15;
    }

    if (score > bestScore) {
      bestScore = score;
      bestRowIndex = r;
    }
  }

  const selectedRow = rawRows[bestRowIndex] || [];
  const headers = selectedRow.map((cell, idx) => {
    const val = String(cell || '').trim();
    return val || `Columna_${idx + 1}`;
  });

  return { headerRowIndex: bestRowIndex, headers };
}

export function suggestColumnMapping(headers: string[], headerRowIndex: number): ColumnMapping {
  let adsetColumn = '';
  let nameColumn = '';
  let phoneColumn = '';
  let createdTimeColumn = '';

  headers.forEach((h) => {
    const norm = normalizeColHeader(h);

    // Phone matching
    if (!phoneColumn) {
      if (
        norm === 'phone_number' ||
        norm === 'numero_de_telefono' ||
        norm === 'telefono' ||
        norm === 'phone' ||
        norm === 'celular' ||
        norm.includes('telefono') ||
        norm.includes('phone')
      ) {
        phoneColumn = h;
      }
    }

    // Name matching
    if (!nameColumn) {
      if (
        norm === 'full_name' ||
        norm === 'nombre_y_apellidos' ||
        norm === 'nombre' ||
        norm === 'lead_name' ||
        norm === 'nombres' ||
        norm.includes('nombre')
      ) {
        nameColumn = h;
      }
    }

    // Adset / City matching
    if (!adsetColumn) {
      if (
        norm === 'adset_name' ||
        norm === 'adset' ||
        norm === 'ciudad' ||
        norm === 'conjunto_de_anuncios' ||
        norm.includes('adset') ||
        norm.includes('ciudad')
      ) {
        adsetColumn = h;
      }
    }

    // Created time
    if (!createdTimeColumn) {
      if (norm === 'created_time' || norm === 'fecha_creacion' || norm === 'created_at' || norm.includes('created')) {
        createdTimeColumn = h;
      }
    }
  });

  return {
    adsetColumn,
    nameColumn,
    phoneColumn,
    createdTimeColumn,
    headerRowIndex,
  };
}

export async function parseFileForPreview(file: File): Promise<ParsedSheetPreview> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Parse to raw 2D array
  const rawRows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  const { headerRowIndex, headers } = detectHeaderRowAndColumns(rawRows);
  const suggestedMapping = suggestColumnMapping(headers, headerRowIndex);

  return {
    fileName: file.name,
    sheetName,
    totalRows: Math.max(0, rawRows.length - headerRowIndex - 1),
    detectedHeaderRow: headerRowIndex,
    rawRows: rawRows.slice(0, 15), // Preview first 15 rows
    availableColumns: headers,
    suggestedMapping,
  };
}

export async function extractRecordsFromFile(
  file: File,
  mapping: ColumnMapping,
  sourceType: string
): Promise<RawInputRecord[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rawRows = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (rawRows.length <= mapping.headerRowIndex) {
    return [];
  }

  const headerRow = rawRows[mapping.headerRowIndex] || [];
  const headerMap = new Map<string, number>();
  headerRow.forEach((col, idx) => {
    headerMap.set(String(col).trim(), idx);
  });

  const adsetIdx = headerMap.get(mapping.adsetColumn.trim()) ?? -1;
  const nameIdx = headerMap.get(mapping.nameColumn.trim()) ?? -1;
  const phoneIdx = headerMap.get(mapping.phoneColumn.trim()) ?? -1;
  const createdTimeIdx = mapping.createdTimeColumn ? headerMap.get(mapping.createdTimeColumn.trim()) ?? -1 : -1;

  if (adsetIdx === -1 || nameIdx === -1 || phoneIdx === -1) {
    throw new Error(
      `No se pudieron encontrar todas las columnas requeridas en el archivo "${file.name}". ` +
      `Verifique el mapeo: Ciudad ("${mapping.adsetColumn}"), Nombre ("${mapping.nameColumn}"), Teléfono ("${mapping.phoneColumn}")`
    );
  }

  const records: RawInputRecord[] = [];

  for (let r = mapping.headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const rawAdset = String(row[adsetIdx] || '').trim();
    const rawName = String(row[nameIdx] || '').trim();
    const rawPhone = String(row[phoneIdx] || '').trim();
    const createdTime = createdTimeIdx !== -1 ? String(row[createdTimeIdx] || '').trim() : undefined;

    // Skip entirely empty records or summary rows
    if (!rawAdset && !rawName && !rawPhone) continue;

    records.push({
      rawAdset,
      rawName,
      rawPhone,
      createdTime,
      sourceFile: file.name,
      sourceType,
    });
  }

  return records;
}
