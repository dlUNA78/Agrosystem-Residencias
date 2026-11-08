import { MAP_HEIGHT, MAP_WIDTH, getStatePaths } from './mexicoGeo.js';
import { buildAccentInsensitiveRegex } from '../utils/validators.js';

const PUBLIC_REGION_LIMIT = 12;
const MAX_PUBLIC_REGION_PAGE = 100000;

const REGION_TO_STATES = Object.freeze({
  'el bajio': ['guanajuato', 'queretaro', 'aguascalientes', 'jalisco'],
  bajio: ['guanajuato', 'queretaro', 'aguascalientes', 'jalisco'],
  centro: [
    'ciudad de mexico',
    'distrito federal',
    'mexico',
    'morelos',
    'hidalgo',
    'tlaxcala',
    'puebla',
  ],
  'estado de mexico': ['mexico', 'estado de mexico'],
  noroeste: ['baja california', 'baja california sur', 'sonora', 'sinaloa'],
  noreste: ['chihuahua', 'coahuila', 'nuevo leon', 'tamaulipas'],
  occidente: ['jalisco', 'colima', 'michoacan', 'nayarit'],
  sureste: ['tabasco', 'campeche', 'yucatan', 'quintana roo', 'chiapas'],
  sur: ['guerrero', 'oaxaca', 'chiapas'],
});

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const cleanSearch = (value) =>
  typeof value === 'string'
    ? [...value]
        .filter((character) => {
          const code = character.charCodeAt(0);
          return code > 31 && code !== 127;
        })
        .join('')
        .trim()
        .slice(0, 80)
    : '';

const parsePage = (value) => {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 && page <= MAX_PUBLIC_REGION_PAGE
    ? page
    : 1;
};

export const normalizePublicLandQuery = (query = {}) => ({
  search: cleanSearch(query.search),
  page: parsePage(query.page),
  limit: PUBLIC_REGION_LIMIT,
});

export const parsePublicCoverageFilter = (query = {}) =>
  query?.coverage === 'active' ? 'active' : '';

export const buildPublicRegionWhere = (Op, query) => {
  if (!query.search) return {};
  const accentRegex = buildAccentInsensitiveRegex(query.search);
  if (Op.or && Op.iRegexp && accentRegex) {
    return {
      [Op.or]: [
        { name: { [Op.iLike]: `%${query.search}%` } },
        { name: { [Op.iRegexp]: accentRegex } },
      ],
    };
  }
  return {
    name: {
      [Op.iLike]: `%${query.search}%`,
    },
  };
};

export const buildPublicRegionCard = (region) => {
  const value = typeof region.toJSON === 'function' ? region.toJSON() : region;
  const plagues = (value.plagues || []).map((plague) => ({
    id: plague.id,
    name: plague.name,
    scientificName: plague.scientific_name,
  }));

  return {
    id: value.id,
    name: value.name,
    plagueCount: plagues.length,
    featuredPlagues: plagues.slice(0, 3),
  };
};

const indexStatesByRegionCards = (cards) => {
  const stateMap = new Map();
  cards.forEach((card) => {
    const key = normalizeKey(card.name);
    const mappedStates = REGION_TO_STATES[key] || [key];
    mappedStates.forEach((stateKey) => {
      const prev = stateMap.get(stateKey);
      if (!prev || card.plagueCount > prev.plagueCount) {
        stateMap.set(stateKey, {
          regionName: card.name,
          plagueCount: card.plagueCount,
        });
      }
    });
  });
  return stateMap;
};

const resolveStateFillClass = (match) => {
  if (!match) return 'fill-slate-200/80 stroke-white transition-colors';
  if (match.plagueCount > 0) {
    return 'fill-[#1b4332]/85 hover:fill-[#1b4332] stroke-white cursor-pointer transition-colors';
  }
  return 'fill-emerald-400/75 hover:fill-emerald-600 stroke-white cursor-pointer transition-colors';
};

export const buildNationalRegionCoverageMap = (regionCards = []) => {
  const stateIndex = indexStatesByRegionCards(regionCards);
  let coveredStatesCount = 0;

  const states = getStatePaths().map((state) => {
    const match = stateIndex.get(normalizeKey(state.estado)) || null;
    if (match) coveredStatesCount += 1;

    return {
      id: state.id,
      estado: state.estado,
      d: state.d,
      isCovered: Boolean(match),
      regionName: match?.regionName || '',
      plagueCount: match?.plagueCount || 0,
      stateClass: resolveStateFillClass(match),
    };
  });

  const activeRegionsCount = regionCards.filter(
    (card) => card.plagueCount > 0,
  ).length;
  const totalPlagueRefs = regionCards.reduce(
    (sum, card) => sum + card.plagueCount,
    0,
  );

  return {
    viewBox: `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`,
    states,
    coveredStatesCount,
    activeRegionsCount,
    totalPlagueRefs,
  };
};
