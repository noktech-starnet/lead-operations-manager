import * as XLSX from 'xlsx';

export function createSampleMetaAdsWorkbook(): Blob {
  const data = [
    {
      adset_name: 'Pensiones_MTY_Adultos_Septiembre',
      full_name: 'Laura Elena Morales Vega',
      phone_number: 'p:8183456789',
      form_response_age: '62',
      form_response_pension_type: 'IMSS Ley 73',
      campaign_id: 'cmp_1001',
    },
    {
      adset_name: 'Pensiones_GDL_60mas',
      full_name: 'Roberto Carlos Hernández Silva',
      phone_number: 'p:3312345678',
      form_response_age: '59',
      form_response_pension_type: 'ISSSTE',
      campaign_id: 'cmp_1001',
    },
    {
      adset_name: 'Pensiones_CDMX_Retiro_Activo',
      full_name: 'Ana Patricia Delgado Ruiz',
      phone_number: '+525541239876',
      form_response_age: '60',
      form_response_pension_type: 'IMSS',
      campaign_id: 'cmp_1001',
    },
    {
      adset_name: 'Pensiones_PUE_Adultos_Mayo',
      full_name: 'José Guadalupe Méndez Castro',
      phone_number: '2224567890',
      form_response_age: '64',
      form_response_pension_type: 'IMSS Ley 73',
      campaign_id: 'cmp_1001',
    },
    {
      adset_name: 'Pensiones_ACA_Septiembre',
      full_name: 'María del Carmen López',
      phone_number: 'p:7443257171',
      form_response_age: '61',
      form_response_pension_type: 'IMSS',
      campaign_id: 'cmp_1001',
    },
    // Case: Name without surname -> pending review
    {
      adset_name: 'Pensiones_MTY_Adultos_Septiembre',
      full_name: 'Emilio',
      phone_number: '8119876543',
      form_response_age: '63',
      form_response_pension_type: 'IMSS',
      campaign_id: 'cmp_1001',
    },
    // Case: Incomplete surname initial -> pending review
    {
      adset_name: 'Pensiones_GDL_60mas',
      full_name: 'María G.',
      phone_number: '3335551122',
      form_response_age: '65',
      form_response_pension_type: 'IMSS Ley 73',
      campaign_id: 'cmp_1001',
    },
    // Case: Commercial name -> pending review
    {
      adset_name: 'Pensiones_CDMX_Retiro_Activo',
      full_name: 'Globitos X Eventos',
      phone_number: '5588992211',
      form_response_age: '58',
      form_response_pension_type: 'IMSS',
      campaign_id: 'cmp_1001',
    },
    // Case: Incomplete phone -> rejected
    {
      adset_name: 'Pensiones_PUE_Adultos_Mayo',
      full_name: 'Gabriel Fuentes Ortiz',
      phone_number: '2221234', // Only 7 digits
      form_response_age: '60',
      form_response_pension_type: 'IMSS',
      campaign_id: 'cmp_1001',
    },
    // Case: Phone with letters -> rejected
    {
      adset_name: 'Pensiones_MTY_Adultos_Septiembre',
      full_name: 'Daniela Soto Campos',
      phone_number: '811ABC7890',
      form_response_age: '61',
      form_response_pension_type: 'IMSS',
      campaign_id: 'cmp_1001',
    },
    // Case: Unresolved adset name
    {
      adset_name: 'Camp_Retiro_General_Online',
      full_name: 'Héctor Hugo Mendoza Garza',
      phone_number: '8112233445',
      form_response_age: '62',
      form_response_pension_type: 'IMSS',
      campaign_id: 'cmp_1001',
    },
    // Case: Duplicate phone in same batch
    {
      adset_name: 'Pensiones_ACA_Septiembre',
      full_name: 'María del Carmen López Cruz', // More complete name!
      phone_number: 'p:7443257171', // Same phone as above
      form_response_age: '61',
      form_response_pension_type: 'IMSS Ley 73',
      campaign_id: 'cmp_1001',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Meta_Leads');
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// Generates the reference file `pensionesdum8oct.xlsx`
// Row 1: Title
// Row 2: Real Headers
export function createPensionesDum8OctWorkbook(): Blob {
  const rows: (string | number)[][] = [
    // Row 1: Informative report title banner (not headers!)
    ['REPORTE GENERAL DE CAPTACIÓN PENSIONES DUMMY - CORTE 08 OCTUBRE 2026', '', '', '', '', ''],
    // Row 2: Real headers
    ['adset_name', 'nombre_y_apellidos', 'número_de_teléfono', 'created_time', 'phone_number_verified', 'lead_status'],
    // Records
    ['Pensiones_Acapulco_Adultos_Oct', 'María López', 'p:7443257171', '2026-10-08T09:14:00-06:00', 'TRUE', 'ACTIVE'],
    ['Pensiones_MTY_Adultos_Oct', 'Fernando Javier Castro Villarreal', '8182938475', '2026-10-08T09:22:10-06:00', 'TRUE', 'ACTIVE'],
    ['Pensiones_GDL_Retiro_Oct', 'Guillermo Enrique Sandoval Gómez', '+523319876543', '2026-10-08T10:05:44-06:00', 'TRUE', 'ACTIVE'],
    ['Pensiones_CDMX_Centro_Oct', 'Teresa Montes de Oca', '5511223344', '2026-10-08T10:30:12-06:00', 'TRUE', 'ACTIVE'],
    ['Pensiones_PUE_Angelopolis_Oct', 'Armando Benítez Reyes', 'p:2229988776', '2026-10-08T11:12:00-06:00', 'TRUE', 'ACTIVE'],
    ['Pensiones_TIJ_Frontera_Oct', 'Silvia Patricia Vega Lozano', '6641239870', '2026-10-08T11:45:22-06:00', 'TRUE', 'ACTIVE'],
    ['Pensiones_QRO_Retiro_Oct', 'Enrique Domínguez Carrillo', '4423456789', '2026-10-08T12:00:15-06:00', 'TRUE', 'ACTIVE'],
    ['Pensiones_LEON_Bajio_Oct', 'Beatriz Adriana Morales Vargas', '4776543210', '2026-10-08T12:35:00-06:00', 'TRUE', 'ACTIVE'],
    ['Pensiones_MID_Yucatan_Oct', 'Gaspar Antonio Pech Chan', '9998765432', '2026-10-08T13:10:40-06:00', 'TRUE', 'ACTIVE'],
    // Duplicate phone with conflicting city (Acapulco in first file, now appears with MTY adset)
    ['Pensiones_MTY_Adultos_Oct', 'María López', 'p:7443257171', '2026-10-08T14:02:18-06:00', 'TRUE', 'ACTIVE'],
    // Suspicious business name
    ['Pensiones_CDMX_Centro_Oct', 'Taller Mecánico Hermanos', '5599881122', '2026-10-08T14:40:00-06:00', 'TRUE', 'ACTIVE'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte_Octubre');
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
