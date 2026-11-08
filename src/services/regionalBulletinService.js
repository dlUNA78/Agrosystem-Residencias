import db from '../models/index.js';
import { sanitizeText, sanitizeMultilineText } from '../utils/validators.js';

const { RegionalBulletin, Region, Crop, Plague, User } = db;

let tableInitialized = false;

const ensureBulletinTableReady = async () => {
  if (tableInitialized || !RegionalBulletin?.sync) return;
  try {
    await RegionalBulletin.sync();
    tableInitialized = true;
  } catch (_err) {
    // Fallback seguro en entornos de prueba sin conexión activa
  }
};

const LEVEL_CLASS_BY_SEVERITY = Object.freeze({
  ALTA: 'text-red-700 bg-red-50 border-red-200',
  CRÍTICO: 'text-red-700 bg-red-50 border-red-200',
  CRITICO: 'text-red-700 bg-red-50 border-red-200',
  MEDIA: 'text-amber-700 bg-amber-50 border-amber-200',
  MODERADO: 'text-amber-700 bg-amber-50 border-amber-200',
  BAJA: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  PREVENTIVO: 'text-emerald-700 bg-emerald-50 border-emerald-200',
});

const MONTH_ABBR = [
  'ENE',
  'FEB',
  'MAR',
  'ABR',
  'MAY',
  'JUN',
  'JUL',
  'AGO',
  'SEP',
  'OCT',
  'NOV',
  'DIC',
];

const DEFAULT_REGIONAL_BULLETINS = Object.freeze([
  {
    id: 901,
    folio: 'SNVF-2026-0842',
    date: '06 NOV',
    state: 'Sinaloa',
    region: 'Noroeste · Valles de Culiacán y Guasave',
    tag: 'Vigilancia Activa',
    title: 'Monitoreo preventivo de Gusano Cogollero en siembras O-I',
    excerpt:
      'Se recomienda instalar trampas con feromona sexual (4 por bloque de 10 ha) y verificar umbrales económicos en etapa V2-V6.',
    pestScientific: 'Spodoptera frugiperda',
    pestCommon: 'Gusano cogollero',
    crop: 'Maíz grano',
    level: 'ALTA',
    levelClass: LEVEL_CLASS_BY_SEVERITY.ALTA,
    authorName: 'Campo Experimental Valle de Culiacán · INIFAP',
    href: '/plagues?search=Spodoptera',
  },
  {
    id: 902,
    folio: 'SNVF-2026-0839',
    date: '04 NOV',
    state: 'Michoacán',
    region: 'Occidente · Franja Aguacatera y Bajío',
    tag: 'Boletín Técnico',
    title: 'Manejo fitosanitario de Trips y Barrenador de ramas',
    excerpt:
      'Durante brotación vegetativa y floración, priorizar muestreo semanal en brotes tiernos y podas sanitarias certificadas.',
    pestScientific: 'Scirtothrips perseae',
    pestCommon: 'Trips del aguacate',
    crop: 'Aguacate Hass',
    level: 'MEDIA',
    levelClass: LEVEL_CLASS_BY_SEVERITY.MEDIA,
    authorName: 'Campo Experimental Uruapan · INIFAP',
    href: '/plagues?search=Trips',
  },
  {
    id: 903,
    folio: 'SNVF-2026-0831',
    date: '01 NOV',
    state: 'Guanajuato',
    region: 'Centro-Bajío · Corredor Hortícola',
    tag: 'Preventivo',
    title: 'Prevención de Mosca Blanca y virosis en solanáceas',
    excerpt:
      'Mantener eliminación de malezas hospederas en periferia de invernaderos y rotación de modos de acción IRAC.',
    pestScientific: 'Bemisia tabaci',
    pestCommon: 'Mosca blanca',
    crop: 'Jitomate / Chile',
    level: 'BAJA',
    levelClass: LEVEL_CLASS_BY_SEVERITY.BAJA,
    authorName: 'Campo Experimental Bajío · INIFAP',
    href: '/plagues?search=Bemisia',
  },
]);

const formatShortDate = (dateInput) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(d.getTime())) return 'HOY';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = MONTH_ABBR[d.getUTCMonth()] || 'NOV';
  return `${day} ${month}`;
};

const toPlainObject = (record) =>
  typeof record?.toJSON === 'function' ? record.toJSON() : record || {};

const pickFirstText = (values, fallback) => {
  const match = values.find((item) => typeof item === 'string' && item.trim());
  return match ? match.trim() : fallback;
};

export const serializeBulletinForHome = (record) => {
  const plain = toPlainObject(record);
  const level = String(plain.severity || 'MEDIA').toUpperCase();
  const regionLabel = pickFirstText(
    [plain.region?.name, plain.state],
    'Cobertura Nacional',
  );
  const titleText = pickFirstText(
    [plain.title, plain.plague_name],
    'Aviso fitosanitario regional',
  );
  const summaryText = pickFirstText(
    [plain.summary, plain.content],
    'Comunicado técnico emitido por personal investigador acreditado del INIFAP.',
  );

  return {
    id: plain.id,
    folio:
      plain.folio || `SNVF-2026-${String(plain.id || 800).padStart(4, '0')}`,
    title: titleText,
    summary: summaryText,
    excerpt: summaryText,
    date: plain.date || formatShortDate(plain.published_at || plain.createdAt),
    state: regionLabel,
    region: regionLabel,
    regionName: regionLabel,
    tag: level,
    pestScientific: pickFirstText(
      [plain.plague_scientific_name, plain.pestScientific],
      'Vigilancia fitosanitaria',
    ),
    pestCommon: pickFirstText(
      [plain.plague_name, plain.pestCommon, titleText],
      'Vigilancia regional',
    ),
    crop: pickFirstText([plain.crop_name, plain.crop], 'Multicultivo'),
    level,
    levelClass:
      LEVEL_CLASS_BY_SEVERITY[level] || LEVEL_CLASS_BY_SEVERITY.MEDIA,
    workflowStatus: plain.workflow_status || 'published',
    authorName: pickFirstText(
      [plain.createdBy?.full_name],
      'Investigador INIFAP',
    ),
    href: `/plagues?search=${encodeURIComponent(regionLabel)}`,
  };
};

const buildBulletinIncludes = () => {
  const includes = [];
  if (Region) includes.push({ model: Region, as: 'region', required: false });
  if (User) {
    includes.push({
      model: User,
      as: 'createdBy',
      attributes: ['id', 'full_name', 'role'],
      required: false,
    });
  }
  return includes;
};

export const fetchPublishedBulletins = async (limit = 10) => {
  await ensureBulletinTableReady();
  if (typeof RegionalBulletin?.findAll !== 'function') {
    return DEFAULT_REGIONAL_BULLETINS.slice(0, limit);
  }
  try {
    const rows = await RegionalBulletin.findAll({
      where: { workflow_status: 'published' },
      include: buildBulletinIncludes(),
      order: [
        ['published_at', 'DESC'],
        ['createdAt', 'DESC'],
      ],
      limit,
    });
    if (!rows || rows.length === 0) {
      return DEFAULT_REGIONAL_BULLETINS.slice(0, limit);
    }
    return rows.map(serializeBulletinForHome);
  } catch (_err) {
    return DEFAULT_REGIONAL_BULLETINS.slice(0, limit);
  }
};

const resolveSeasonMonths = (seasonStr) => {
  const s = String(seasonStr || '').toLowerCase();
  if (s.includes('otoño') || s.includes('invierno')) {
    return { siembra: [10, 12], cosecha: [3, 6] };
  }
  if (s.includes('perenne') || s.includes('todo')) {
    return { siembra: [1, 12], cosecha: [1, 12] };
  }
  return { siembra: [5, 8], cosecha: [9, 12] };
};

const mapCropToSeasonalItem = (crop) => {
  const plain = toPlainObject(crop);
  const ranges = resolveSeasonMonths(plain.planting_season || plain.season);
  const plagueRefs = Array.isArray(plain.plagues) ? plain.plagues.length : 0;
  return {
    id: plain.id,
    nombre: plain.name,
    cientifico: plain.scientific_name,
    siembra: ranges.siembra,
    cosecha: ranges.cosecha,
    fichas: plagueRefs > 0 ? plagueRefs : 1,
  };
};

export const fetchDynamicSeasonalCrops = async (fallbackList = []) => {
  if (typeof Crop?.findAll !== 'function') return fallbackList;
  try {
    const dbCrops = await Crop.findAll({
      where: { workflow_status: 'published' },
      include: Plague
        ? [
            {
              model: Plague,
              as: 'plagues',
              attributes: ['id'],
              through: { attributes: [] },
              required: false,
            },
          ]
        : [],
      order: [['name', 'ASC']],
      limit: 10,
    });
    if (!dbCrops || dbCrops.length === 0) return fallbackList;
    return dbCrops.map(mapCropToSeasonalItem);
  } catch (_err) {
    return fallbackList;
  }
};

const normalizeCreateArgs = (arg1, arg2) => {
  if (arg1 && typeof arg1 === 'object' && ('payload' in arg1 || 'user' in arg1)) {
    return { user: arg1.user, body: arg1.payload || {} };
  }
  return { user: arg1, body: arg2 || {} };
};

const resolveRegionStateName = async (regionId, explicitState) => {
  const cleanedState = sanitizeText(explicitState, 100);
  if (cleanedState) return cleanedState;
  if (!regionId || typeof Region?.findByPk !== 'function') return 'Nacional';
  const region = await Region.findByPk(regionId, { attributes: ['name'] });
  return region?.name || 'Nacional';
};

const sanitizeWithFallback = (value, maxLength, fallback) => {
  const cleaned = sanitizeText(value, maxLength);
  return cleaned || fallback;
};

const buildBulletinRecordPayload = ({
  body,
  title,
  summary,
  state,
  regionId,
  userId,
  canPublish,
}) => {
  const randomSuffix = String(Math.floor(1000 + Math.random() * 9000));
  const severity = sanitizeWithFallback(body.severity, 30, 'PREVENTIVO');

  return {
    folio: sanitizeWithFallback(body.folio, 40, `SNVF-2026-${randomSuffix}`),
    title,
    summary,
    content: sanitizeMultilineText(body.content, 5000) || summary,
    bulletin_type: sanitizeWithFallback(body.bulletin_type, 50, 'aviso_semanal'),
    severity: severity.toUpperCase(),
    state,
    region_id: regionId,
    crop_name: sanitizeWithFallback(body.crop_name, 120, 'Multicultivo'),
    plague_name: sanitizeWithFallback(body.plague_name, 150, title),
    plague_scientific_name: sanitizeWithFallback(
      body.plague_scientific_name,
      150,
      'Vigilancia regional INIFAP',
    ),
    workflow_status: canPublish ? 'published' : 'under_review',
    created_by_user_id: userId,
    published_by_user_id: canPublish ? userId : null,
    published_at: canPublish ? new Date() : null,
  };
};

export const createRegionalBulletinRecord = async (arg1, arg2) => {
  await ensureBulletinTableReady();
  const { user, body } = normalizeCreateArgs(arg1, arg2);
  const title = sanitizeText(body.title, 180);
  const summary = sanitizeMultilineText(body.summary, 1000);
  if (title.length < 5) {
    return {
      success: false,
      message: 'El título del boletín debe tener al menos 5 caracteres.',
    };
  }

  const regionId = Number(body.region_id) || null;
  const state = await resolveRegionStateName(regionId, body.state);
  const canPublish = user?.role === 'admin' || user?.role === 'inifap';
  const payload = buildBulletinRecordPayload({
    body,
    title,
    summary,
    state,
    regionId,
    userId: user?.id || null,
    canPublish,
  });

  const record = await RegionalBulletin.create(payload);
  return { success: true, record };
};
