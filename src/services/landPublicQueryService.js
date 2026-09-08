const PUBLIC_REGION_LIMIT = 12;
const MAX_PUBLIC_REGION_PAGE = 100000;

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

export const buildPublicRegionWhere = (Op, query) =>
  query.search
    ? {
        name: {
          [Op.iLike]: `%${query.search}%`,
        },
      }
    : {};

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
