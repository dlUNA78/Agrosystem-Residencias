import path from 'path';
import { fileURLToPath } from 'url';

import db from '../../models/index.js';
import {
  getContextualLandPermissions,
  getLandListWhere,
  getLandPermissions,
} from '../../services/landAuthorizationService.js';
import {
  parseLandId,
  validateLandInput,
} from '../../services/landValidationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const privateLayout = path.join(__dirname, '../../views/layouts/private');

const { AuditLog, Farm, Region, User, sequelize } = db;

const regionInclude = {
  model: Region,
  as: 'region',
  attributes: ['id', 'name'],
  required: false,
};

const ownerInclude = {
  model: User,
  as: 'user',
  attributes: ['id', 'full_name'],
  required: false,
};

const wantsJson = (req) =>
  req.xhr || req.headers?.accept?.includes('application/json');

const sendInputError = (req, res, fieldErrors) => {
  const errors = Object.values(fieldErrors).flat();
  if (wantsJson(req)) {
    return res.status(400).json({ success: false, errors, fieldErrors });
  }
  return res.status(400).send(errors.join(' '));
};

const serializeFarm = (farm, user) => {
  const value = farm.toJSON();
  return {
    ...value,
    permissions: getContextualLandPermissions({
      role: user.role,
      userId: user.id,
      ownerUserId: value.user_id,
      isActive: value.status,
    }),
  };
};

export const renderLandsPrivate = async (req, res) => {
  try {
    const permissions = getLandPermissions(req.user.role);
    const [regions, farms] = await Promise.all([
      Region.findAll({
        attributes: ['id', 'name'],
        order: [['name', 'ASC']],
        raw: true,
      }),
      Farm.findAll({
        where: getLandListWhere(req.user),
        include: [regionInclude, ownerInclude],
        order: [['createdAt', 'DESC']],
      }),
    ]);
    const farmsData = farms.map((farm) => serializeFarm(farm, req.user));

    return res.render('private/lands/list', {
      layout: privateLayout,
      pageTitle: permissions.canViewAll ? 'Terrenos' : 'Mis Terrenos',
      activePage: 'lands',
      farms: farmsData,
      regions,
      farmsCount: farmsData.length,
      permissions,
      extraHead:
        '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />',
      extraScripts: `
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
        <script src="/js/private/lands.js"></script>
      `,
    });
  } catch (error) {
    console.error('Error al cargar los terrenos:', error);
    return res.status(500).send('Error al cargar los terrenos');
  }
};

export const createFarmPrivate = async (req, res) => {
  const validation = validateLandInput(req.body);
  if (!validation.isValid) {
    return sendInputError(req, res, validation.fieldErrors);
  }

  try {
    if (
      validation.value.region_id &&
      !(await Region.findByPk(validation.value.region_id, { attributes: ['id'] }))
    ) {
      return sendInputError(req, res, {
        region_id: ['La región seleccionada no existe.'],
      });
    }

    await sequelize.transaction(async (transaction) => {
      const farm = await Farm.create(
        {
          ...validation.value,
          user_id: req.user.id,
          status: true,
        },
        { transaction },
      );
      await AuditLog.create(
        {
          action: 'create',
          table_name: 'Farms',
          record_id: farm.id,
          old_values: null,
          new_values: validation.value,
          user_id: req.user.id,
        },
        { transaction },
      );
    });

    if (wantsJson(req)) return res.status(201).json({ success: true });
    return res.redirect('/private/lands');
  } catch (error) {
    console.error('Error al crear el terreno:', error);
    return res.status(500).send('Error al crear el terreno');
  }
};

export const landDetail = async (req, res) => {
  const id = parseLandId(req.params.id);
  if (!id) return res.status(400).send('Identificador de terreno inválido');

  try {
    const farm = await Farm.findOne({
      where: { ...getLandListWhere(req.user), id },
      include: [regionInclude, ownerInclude],
    });
    if (!farm) return res.status(404).send('Predio no encontrado');

    const landData = serializeFarm(farm, req.user);
    return res.render('private/lands/detail', {
      layout: privateLayout,
      pageTitle: `Expediente — ${landData.name}`,
      activePage: 'lands',
      extraScripts: '<script src="/js/private/land-detail.js"></script>',
      land: landData,
      permissions: landData.permissions,
      landName: landData.name,
      landLocation: `${landData.municipality || 'Sin municipio'}${landData.region ? ` — ${landData.region.name}` : ''}`,
      landLat: landData.location_lat ? String(landData.location_lat) : 'N/A',
      landLng: landData.location_lng ? String(landData.location_lng) : 'N/A',
      landHectares: landData.size_hectares
        ? String(landData.size_hectares)
        : '0',
      landId: `#PRD-${String(landData.id).padStart(4, '0')}`,
    });
  } catch (error) {
    console.error('Error al obtener el expediente del terreno:', error);
    return res.status(500).send('Error al obtener el expediente del terreno');
  }
};
