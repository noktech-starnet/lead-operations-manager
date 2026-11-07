export interface PhoneNormalizationResult {
  isValid: boolean;
  normalized: string; // +52XXXXXXXXXX if valid, or cleaned string
  raw: string;
  rejectionReason?: string;
}

export function normalizeMexicanPhone(rawPhoneInput: string | number | null | undefined): PhoneNormalizationResult {
  if (rawPhoneInput === null || rawPhoneInput === undefined) {
    return {
      isValid: false,
      normalized: '',
      raw: '',
      rejectionReason: 'Teléfono vacío o no proporcionado',
    };
  }

  const raw = String(rawPhoneInput).trim();
  if (!raw) {
    return {
      isValid: false,
      normalized: '',
      raw: '',
      rejectionReason: 'Teléfono vacío',
    };
  }

  // 1. Remove "p:" technical prefix if present (case insensitive)
  let cleaned = raw.replace(/^p:/i, '').trim();

  // 2. Check for letters or illegal characters before stripping
  // Allow leading +, digits, and common separators: spaces, dashes, parens, dots
  const illegalCharsRegex = /[a-zA-Z!@#$%^&*_=?[\]{}|\\;:"'<>~`]/;
  if (illegalCharsRegex.test(cleaned)) {
    return {
      isValid: false,
      normalized: cleaned,
      raw,
      rejectionReason: 'Contiene letras o caracteres no numéricos no permitidos',
    };
  }

  // 3. Remove allowed separator characters: spaces, hyphens, dots, parentheses, forward slashes
  cleaned = cleaned.replace(/[\s\-\.\(\)\/]/g, '');

  // 4. Handle leading plus sign
  const hasLeadingPlus = cleaned.startsWith('+');
  if (hasLeadingPlus) {
    cleaned = cleaned.substring(1);
  }

  // At this stage, cleaned must consist only of digits
  if (!/^\d+$/.test(cleaned)) {
    return {
      isValid: false,
      normalized: cleaned,
      raw,
      rejectionReason: 'Formato inválido: contiene caracteres extraños',
    };
  }

  // 5. Handle Mexican country code (+52) and historical mobile marker (521)
  // Standard Mexican national number has 10 digits.
  // Case A: Starts with 521 and followed by 10 digits (old WhatsApp/mobile format: 521XXXXXXXXXX -> 13 digits)
  if (cleaned.startsWith('521') && cleaned.length === 13) {
    cleaned = cleaned.substring(3);
  }
  // Case B: Starts with 52 followed by 10 digits (52XXXXXXXXXX -> 12 digits)
  else if (cleaned.startsWith('52') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  }
  // Case C: Starts with 01 (old national long distance) followed by 10 digits (12 digits)
  else if (cleaned.startsWith('01') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  }
  // Case D: Starts with 044 or 045 (old mobile prefix) followed by 10 digits (13 digits)
  else if ((cleaned.startsWith('044') || cleaned.startsWith('045')) && cleaned.length === 13) {
    cleaned = cleaned.substring(3);
  }

  // 6. Validate national 10-digit length
  if (cleaned.length < 10) {
    return {
      isValid: false,
      normalized: cleaned,
      raw,
      rejectionReason: `Teléfono incompleto: tiene solo ${cleaned.length} dígitos (se requieren 10)`,
    };
  }

  if (cleaned.length > 10) {
    return {
      isValid: false,
      normalized: cleaned,
      raw,
      rejectionReason: `Teléfono excede longitud: tiene ${cleaned.length} dígitos (se requieren 10 nacionales)`,
    };
  }

  // 7. Check for suspicious repeating or dummy numbers (e.g. 0000000000, 1111111111, 1234567890)
  if (/^(\d)\1{9}$/.test(cleaned)) {
    return {
      isValid: false,
      normalized: `+52${cleaned}`,
      raw,
      rejectionReason: 'Número inválido: dígitos repetidos sospechosos',
    };
  }

  if (cleaned === '1234567890' || cleaned === '0123456789') {
    return {
      isValid: false,
      normalized: `+52${cleaned}`,
      raw,
      rejectionReason: 'Número ficticio o de prueba detectado',
    };
  }

  // Valid Mexican 10-digit number -> Standard format: +52XXXXXXXXXX
  return {
    isValid: true,
    normalized: `+52${cleaned}`,
    raw,
  };
}
