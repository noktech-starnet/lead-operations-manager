import * as XLSX from 'xlsx';
import { Lead, ExportFormat } from '../types';

const SPANISH_MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function getFormattedFilename(
  ciudad: string,
  campana: string,
  fechaAltaStr: string, // e.g. "09/10/2026" or "2026-10-09"
  extension: 'xlsx' | 'csv' = 'xlsx',
  partNumber?: number
): string {
  // Parse day and month from fechaAltaStr
  let dayStr = '01';
  let monthIndex = 9; // October default (0-indexed 9)

  if (fechaAltaStr.includes('/')) {
    const parts = fechaAltaStr.split('/');
    if (parts.length >= 2) {
      dayStr = parts[0].padStart(2, '0');
      const mNum = parseInt(parts[1], 10);
      if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
        monthIndex = mNum - 1;
      }
    }
  } else if (fechaAltaStr.includes('-')) {
    const parts = fechaAltaStr.split('-');
    if (parts.length >= 3) {
      dayStr = parts[2].padStart(2, '0');
      const mNum = parseInt(parts[1], 10);
      if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
        monthIndex = mNum - 1;
      }
    }
  }

  const cleanCity = ciudad.trim().replace(/\s+/g, '_');
  const cleanCampana = (campana || 'Pensiones').trim().replace(/\s+/g, '_');
  const monthName = SPANISH_MONTHS[monthIndex];

  let base = `${cleanCity}_${cleanCampana}_${dayStr}_${monthName}`;
  if (partNumber !== undefined && partNumber > 0) {
    base += `_parte${partNumber}`;
  }

  return `${base}.${extension}`;
}

export interface GeneratedExportFile {
  filename: string;
  rowCount: number;
  dataBlob: Blob;
  part: number;
  totalParts: number;
}

export function generateExportFiles(
  leads: Lead[],
  format: ExportFormat,
  ciudad: string,
  campana: string,
  fechaAlta: string,
  batchSize: number = 0, // 0 means no split
  fileType: 'xlsx' | 'csv' = 'xlsx'
): GeneratedExportFile[] {
  // Only accept leads with status === 'accepted'
  const validLeads = leads.filter((l) => l.status === 'accepted');

  if (validLeads.length === 0) {
    return [];
  }

  // Calculate chunks
  const chunkSize = batchSize > 0 ? batchSize : validLeads.length;
  const chunks: Lead[][] = [];

  for (let i = 0; i < validLeads.length; i += chunkSize) {
    chunks.push(validLeads.slice(i, i + chunkSize));
  }

  const generatedFiles: GeneratedExportFile[] = [];

  chunks.forEach((chunk, index) => {
    const partNumber = chunks.length > 1 ? index + 1 : 0;
    const filename = getFormattedFilename(ciudad, campana, fechaAlta, fileType, partNumber);

    // Format rows depending on chosen format
    let dataRows: Record<string, string>[] = [];

    if (format === 'standard') {
      // EXACTLY 4 columns in EXACT order: Fecha, Ciudad, Nombre, Teléfono
      dataRows = chunk.map((lead) => ({
        Fecha: lead.fechaAlta,
        Ciudad: lead.ciudad,
        Nombre: lead.nombre,
        Teléfono: lead.normalizedPhone,
      }));
    } else if (format === 'polaris') {
      // 1 column: phone
      dataRows = chunk.map((lead) => ({
        phone: lead.normalizedPhone,
      }));
    } else if (format === 'vapi') {
      // 2 columns: phone, Lead_Name
      dataRows = chunk.map((lead) => ({
        phone: lead.normalizedPhone,
        Lead_Name: lead.nombre,
      }));
    }

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

    let blob: Blob;

    if (fileType === 'xlsx') {
      const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      blob = new Blob([arrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    } else {
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      // UTF-8 BOM so Excel opens Spanish accents cleanly
      blob = new Blob(['\uFEFF' + csvOutput], { type: 'text/csv;charset=utf-8;' });
    }

    generatedFiles.push({
      filename,
      rowCount: chunk.length,
      dataBlob: blob,
      part: index + 1,
      totalParts: chunks.length,
    });
  });

  return generatedFiles;
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
