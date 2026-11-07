import { CityAlias } from '../types';

export const DEFAULT_CITY_CATALOG: CityAlias[] = [
  {
    id: 'city-mty',
    canonicalCity: 'Monterrey',
    state: 'Nuevo León',
    aliases: ['MTY', 'MONTERREY', 'REGIO', 'NUEVO LEON', 'NL', 'SAN PEDRO', 'GUADALUPE NL', 'APODACA', 'SAN NICOLAS'],
    isActive: true,
  },
  {
    id: 'city-gdl',
    canonicalCity: 'Guadalajara',
    state: 'Jalisco',
    aliases: ['GDL', 'GUADALAJARA', 'JALISCO', 'JAL', 'ZAPOPAN', 'TLAQUEPAQUE', 'TONALA'],
    isActive: true,
  },
  {
    id: 'city-cdmx',
    canonicalCity: 'Ciudad de México',
    state: 'CDMX',
    aliases: ['CDMX', 'CIUDAD DE MEXICO', 'DF', 'MEXICO DF', 'METRO CDMX', 'EDOMEX', 'ESTADO DE MEXICO', 'TLALPAN', 'POLANCO', 'COYOACAN'],
    isActive: true,
  },
  {
    id: 'city-pue',
    canonicalCity: 'Puebla',
    state: 'Puebla',
    aliases: ['PUE', 'PUEBLA', 'ANGELOPOLIS', 'CHOLULA'],
    isActive: true,
  },
  {
    id: 'city-aca',
    canonicalCity: 'Acapulco',
    state: 'Guerrero',
    aliases: ['ACA', 'ACAPULCO', 'GUERRERO', 'GRO', 'COSTERA'],
    isActive: true,
  },
  {
    id: 'city-tij',
    canonicalCity: 'Tijuana',
    state: 'Baja California',
    aliases: ['TIJ', 'TIJUANA', 'BC', 'BAJA CALIFORNIA', 'ROSARITO', 'MEXICALI'],
    isActive: true,
  },
  {
    id: 'city-qro',
    canonicalCity: 'Querétaro',
    state: 'Querétaro',
    aliases: ['QRO', 'QUERETARO', 'QUERETARO QRO', 'CORREGIDORA'],
    isActive: true,
  },
  {
    id: 'city-leon',
    canonicalCity: 'León',
    state: 'Guanajuato',
    aliases: ['LEON', 'LEN', 'GUANAJUATO', 'GTO', 'BAJIO'],
    isActive: true,
  },
  {
    id: 'city-mid',
    canonicalCity: 'Mérida',
    state: 'Yucatán',
    aliases: ['MID', 'MERIDA', 'YUCATAN', 'YUC'],
    isActive: true,
  },
  {
    id: 'city-cun',
    canonicalCity: 'Cancún',
    state: 'Quintana Roo',
    aliases: ['CUN', 'CANCUN', 'QUINTANA ROO', 'Q ROO', 'PLAYA DEL CARMEN', 'RIVIERA MAYA'],
    isActive: true,
  },
  {
    id: 'city-tol',
    canonicalCity: 'Toluca',
    state: 'Estado de México',
    aliases: ['TOL', 'TOLUCA', 'METEPEC'],
    isActive: true,
  },
  {
    id: 'city-ver',
    canonicalCity: 'Veracruz',
    state: 'Veracruz',
    aliases: ['VER', 'VERACRUZ', 'BOCA DEL RIO', 'XALAPA'],
    isActive: true,
  },
  {
    id: 'city-slp',
    canonicalCity: 'San Luis Potosí',
    state: 'San Luis Potosí',
    aliases: ['SLP', 'SAN LUIS POTOSI', 'SAN LUIS'],
    isActive: true,
  },
  {
    id: 'city-cuu',
    canonicalCity: 'Chihuahua',
    state: 'Chihuahua',
    aliases: ['CUU', 'CHIHUAHUA', 'CHIH'],
    isActive: true,
  },
  {
    id: 'city-cjs',
    canonicalCity: 'Ciudad Juárez',
    state: 'Chihuahua',
    aliases: ['CJS', 'CD JUAREZ', 'CIUDAD JUAREZ', 'JUAREZ'],
    isActive: true,
  },
  {
    id: 'city-hmo',
    canonicalCity: 'Hermosillo',
    state: 'Sonora',
    aliases: ['HMO', 'HERMOSILLO', 'SONORA', 'SON'],
    isActive: true,
  },
];

// Helper to remove accents for normalized searching
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export interface CityNormalizationResult {
  isResolved: boolean;
  isAmbiguous: boolean;
  canonicalCity: string;
  matchedAlias?: string;
  matchedCities?: string[];
  rejectionReason?: string;
}

export function normalizeCityFromAdset(
  rawAdset: string | null | undefined,
  catalog: CityAlias[] = DEFAULT_CITY_CATALOG
): CityNormalizationResult {
  if (!rawAdset || !rawAdset.trim()) {
    return {
      isResolved: false,
      isAmbiguous: false,
      canonicalCity: '',
      rejectionReason: 'Conjunto de anuncios (adset_name) vacío',
    };
  }

  const cleanAdset = removeAccents(rawAdset.toUpperCase().trim());
  // Split into tokens by non-alphanumeric separators (underscores, dashes, spaces, slashes)
  const tokens = cleanAdset.split(/[^A-Z0-9]+/).filter(Boolean);

  const matchedCityMap = new Map<string, string>(); // canonicalCity -> matchedAlias

  const activeCatalog = catalog.filter((c) => c.isActive);

  for (const city of activeCatalog) {
    for (const alias of city.aliases) {
      const cleanAlias = removeAccents(alias.toUpperCase().trim());

      // If alias is multi-word (e.g. "CIUDAD DE MEXICO" or "SAN PEDRO")
      if (cleanAlias.includes(' ')) {
        if (cleanAdset.includes(cleanAlias)) {
          matchedCityMap.set(city.canonicalCity, alias);
          break;
        }
      } else {
        // Single word or acronym: match as whole token or bounded substring
        // Token check ensures "PUE" doesn't match inside "PUENTE"
        const tokenMatch = tokens.includes(cleanAlias);
        if (tokenMatch) {
          matchedCityMap.set(city.canonicalCity, alias);
          break;
        }

        // Also check if adset contains it surrounded by underscores/delimiters
        const delimRegex = new RegExp(`(^|[_\\-\\s\\/\\.,])${cleanAlias}([_\\-\\s\\/\\.,]|$)`, 'i');
        if (delimRegex.test(cleanAdset)) {
          matchedCityMap.set(city.canonicalCity, alias);
          break;
        }
      }
    }
  }

  const matches = Array.from(matchedCityMap.keys());

  if (matches.length === 1) {
    const canonical = matches[0];
    return {
      isResolved: true,
      isAmbiguous: false,
      canonicalCity: canonical,
      matchedAlias: matchedCityMap.get(canonical),
    };
  }

  if (matches.length > 1) {
    return {
      isResolved: false,
      isAmbiguous: true,
      canonicalCity: '',
      matchedCities: matches,
      rejectionReason: `Ambigüedad: adset coincide con múltiples ciudades (${matches.join(', ')})`,
    };
  }

  return {
    isResolved: false,
    isAmbiguous: false,
    canonicalCity: '',
    rejectionReason: 'No se identificó ninguna ciudad conocida en adset_name',
  };
}
