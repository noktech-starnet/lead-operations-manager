import { LeadStatus, ReviewReason } from '../types';

export interface NameValidationResult {
  status: LeadStatus;
  reason: ReviewReason;
  cleanedName: string;
  originalName: string;
  detail: string;
}

// Business/Commercial keywords commonly found in Meta Ads leads
const COMMERCIAL_KEYWORDS = [
  'ABARROTES', 'TALLER', 'MECANICA', 'MECANICO', 'CONSULTORIA', 'DESPACHO', 'FARMACIA',
  'DISTRIBUIDORA', 'GLOBAL', 'SERVICIOS', 'COMERCIAL', 'PAPELERIA', 'REFACCIONARIA',
  'FERRETERIA', 'ESTETICA', 'BARBERIA', 'CARNICERIA', 'BOUTIQUE', 'CONSTRUCTORA',
  'INMOBILIARIA', 'AGENCIA', 'RESTAURANTE', 'FONDA', 'PIZZERIA', 'TAQUERIA',
  'GRUPO', 'CORPORATIVO', 'CLINICA', 'DENTAL', 'OPTICA', 'S.A.', 'S.A. DE C.V.',
  'SAPI', 'LLC', 'INC', 'SPA', 'LAVANDERIA', 'LAVADO', 'MUDANZAS', 'FLETES',
  'GLOBITOS', 'EVENTOS', 'FIESTAS', 'PASTELERIA', 'PANADERIA', 'CARPINTERIA',
  'HERRERIA', 'PINTURAS', 'AUTO LAVADO', 'AUTOLAVADO', 'GASOLINERA', 'SUPER'
];

// Profile / Bot / Suspicious words
const PROFILE_KEYWORDS = [
  'PERFIL', 'PROFILE', 'USER', 'USUARIO', 'ADMIN', 'CUENTA', 'PAGINA', 'FACEBOOK',
  'INSTAGRAM', 'TIKTOK', 'METAPAGE', 'VENTAS', 'INFORMES', 'INFO', 'CONTACTO',
  'PROSPECTO', 'CLIENTE', 'PRUEBA', 'TEST', 'DEMO', 'ANONIMO', 'SIN NOMBRE'
];

// Common nicknames / apodos markers
const NICKNAME_INDICATORS = ['EL ', 'LA ', 'LOS ', 'LAS ', 'DON ', 'DOÑA ', 'GUERO', 'CHINO', 'NEGRO', 'FLACO', 'GORDO'];

// Capitalize words properly (respecting common particles like 'de', 'del', 'la')
export function toTitleCase(str: string): string {
  if (!str) return '';
  const lowerWords = ['de', 'del', 'la', 'las', 'los', 'y', 'e', 'van', 'von'];
  return str
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && lowerWords.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function cleanAndValidateName(rawNameInput: string | null | undefined): NameValidationResult {
  const originalName = rawNameInput ? String(rawNameInput).trim() : '';

  if (!originalName) {
    return {
      status: 'rejected',
      reason: 'NOMBRE_VACIO',
      cleanedName: '',
      originalName,
      detail: 'El campo de nombre está completamente vacío',
    };
  }

  // 1. Check if name contains email or phone number (field placed incorrectly)
  if (originalName.includes('@') && originalName.includes('.')) {
    return {
      status: 'rejected',
      reason: 'CARACTERES_INVALIDOS',
      cleanedName: originalName,
      originalName,
      detail: 'El campo contiene un correo electrónico en lugar de un nombre',
    };
  }

  const phoneInNameMatch = originalName.match(/\d{7,}/);
  if (phoneInNameMatch) {
    return {
      status: 'rejected',
      reason: 'CARACTERES_INVALIDOS',
      cleanedName: originalName,
      originalName,
      detail: 'El campo contiene un número telefónico en lugar de un nombre',
    };
  }

  // 2. Check for emojis or non-text symbols
  // Extended regex for emoji ranges and strange punctuation
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  if (emojiRegex.test(originalName)) {
    return {
      status: 'pending_review',
      reason: 'CARACTERES_INVALIDOS',
      cleanedName: originalName.replace(emojiRegex, '').trim(),
      originalName,
      detail: 'Contiene emojis o iconos gráficos; requiere revisión de nombre real',
    };
  }

  // Check for unusual special symbols like *, #, _, @, <>, {}
  if (/[*#_$@<>{}[\]\\]/.test(originalName)) {
    return {
      status: 'pending_review',
      reason: 'CARACTERES_INVALIDOS',
      cleanedName: originalName.replace(/[*#_$@<>{}[\]\\]/g, '').trim(),
      originalName,
      detail: 'Contiene caracteres especiales o símbolos sospechosos',
    };
  }

  // 3. Remove excess whitespace and normalize
  const normalizedUpper = originalName.toUpperCase().trim();
  const cleanedText = originalName.replace(/["']/g, '').replace(/\s+/g, ' ').trim();
  const titleCased = toTitleCase(cleanedText);

  // 4. Check for commercial / business names
  for (const kw of COMMERCIAL_KEYWORDS) {
    const wordBoundary = new RegExp(`(^|\\s|\\b)${kw}(\\b|\\s|$)`, 'i');
    if (wordBoundary.test(normalizedUpper)) {
      return {
        status: 'pending_review',
        reason: 'POSIBLE_NEGOCIO',
        cleanedName: titleCased,
        originalName,
        detail: `Posible nombre comercial o empresa (coincidencia con término: "${kw}")`,
      };
    }
  }

  // 5. Check for social profile / bot / placeholder names
  for (const kw of PROFILE_KEYWORDS) {
    const wordBoundary = new RegExp(`(^|\\s|\\b)${kw}(\\b|\\s|$)`, 'i');
    if (wordBoundary.test(normalizedUpper)) {
      return {
        status: 'pending_review',
        reason: 'POSIBLE_PERFIL_O_ANOMALO',
        cleanedName: titleCased,
        originalName,
        detail: `Posible perfil o texto genérico ("${kw}")`,
      };
    }
  }

  // Check if name has digits (e.g. "Globitos X", "Juan23", "Ana 123")
  if (/\d/.test(originalName)) {
    return {
      status: 'pending_review',
      reason: 'POSIBLE_PERFIL_O_ANOMALO',
      cleanedName: titleCased,
      originalName,
      detail: 'El nombre contiene números; posible perfil o apodo',
    };
  }

  // 6. Split words to verify given name + surname
  // Clean punctuation from words for counting
  const words = cleanedText
    .split(/\s+/)
    .map((w) => w.replace(/[.,;:]/g, '').trim())
    .filter((w) => w.length > 0);

  // Case A: Single word (e.g. "Emilio", "Rosa") -> Missing surname
  if (words.length <= 1) {
    return {
      status: 'pending_review',
      reason: 'NOMBRE_SIN_APELLIDO',
      cleanedName: titleCased,
      originalName,
      detail: 'Nombre incompleto: contiene una sola palabra y carece de apellido',
    };
  }

  // Case B: Incomplete surname or single-letter initial (e.g. "María G.", "Juan P", "Luis R.")
  const lastWord = words[words.length - 1];
  const secondWord = words[1];

  // If last word is 1 char or last token in original is "X."
  if (lastWord.length === 1 || /\b[A-Za-z]\.?$/.test(cleanedText)) {
    return {
      status: 'pending_review',
      reason: 'APELLIDO_INCOMPLETO',
      cleanedName: titleCased,
      originalName,
      detail: `Apellido incompleto o representado únicamente por una inicial ("${lastWord}")`,
    };
  }

  // If only 2 words and the second word is just 1 letter
  if (words.length === 2 && secondWord.length <= 1) {
    return {
      status: 'pending_review',
      reason: 'APELLIDO_INCOMPLETO',
      cleanedName: titleCased,
      originalName,
      detail: 'El apellido es una sola letra o inicial',
    };
  }

  // Check if single-letter words exist anywhere as surnames
  if (words.length >= 2 && words.slice(1).some((w) => w.length === 1 && !['y', 'e'].includes(w.toLowerCase()))) {
    return {
      status: 'pending_review',
      reason: 'APELLIDO_INCOMPLETO',
      cleanedName: titleCased,
      originalName,
      detail: 'Contiene iniciales en lugar de apellido completo',
    };
  }

  // 7. Check for typical nicknames / apodos
  for (const nick of NICKNAME_INDICATORS) {
    if (normalizedUpper.startsWith(nick)) {
      return {
        status: 'pending_review',
        reason: 'POSIBLE_PERFIL_O_ANOMALO',
        cleanedName: titleCased,
        originalName,
        detail: `Posible apodo o alias ("${nick.trim()}")`,
      };
    }
  }

  // Valid standard name (e.g. "María López", "Carlos Alberto Sánchez Mora")
  return {
    status: 'accepted',
    reason: 'VALID',
    cleanedName: titleCased,
    originalName,
    detail: 'Nombre completo validado (nombre y apellido)',
  };
}
