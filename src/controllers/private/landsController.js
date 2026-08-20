import path from 'path';
import { fileURLToPath } from 'url';

import db from '../../models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta absoluta al layout privado
const privateLayout = path.join(__dirname, '../../views/layouts/private');

// ============================================================
// LANDS — Mapa de datos demo por ID (reemplazar con DB real)
// ============================================================
const DEMO_LANDS = {
  1: {
    landName: 'La Esperanza',
    landLocation: 'Culiacán, Sinaloa',
    landLat: '24.7994',
    landLng: '-107.3877',
    landHectares: '142',
    landId: '#PRD-0041',
  },
  2: {
    landName: 'El Progreso',
    landLocation: 'Navolato, Sinaloa',
    landLat: '24.7608',
    landLng: '-107.6988',
    landHectares: '280',
    landId: '#PRD-0038',
  },
  3: {
    landName: 'Rancho San Miguel',
    landLocation: 'Mocorito, Sinaloa',
    landLat: '25.4847',
    landLng: '-107.9606',
    landHectares: '95',
    landId: '#PRD-0035',
  },
  4: {
    landName: 'Los Álamos',
    landLocation: 'Guasave, Sinaloa',
    landLat: '25.5666',
    landLng: '-108.4697',
    landHectares: '210',
    landId: '#PRD-0049',
  },
};

// ============================================================
// GET /private/lands — Vista principal con datos reales del DB
// REGLA DE SEGURIDAD: Consulta siempre aislada por user_id
// ============================================================
export const renderLandsPrivate = async (req, res) => {
  try {
    // Obtener todas las regiones para poblar el select del formulario
    const regions = await db.Region.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
      raw: true,
    });

    // Obtener únicamente los terrenos ACTIVOS del usuario logueado
    const farms = await db.Farm.findAll({
      where: {
        user_id: req.user.id,
        status: true,
      },
      include: [
        {
          model: db.Region,
          as: 'region',
          attributes: ['id', 'name'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    // Serializar para pasar a la vista de forma segura
    const farmsData = farms.map((f) => f.toJSON());

    return res.render('private/lands/list', {
      layout: privateLayout,
      pageTitle: 'Mis Terrenos',
      activePage: 'lands',

      // Datos
      farms: farmsData,
      regions,
      farmsCount: farmsData.length,

      // Leaflet CSS → se inyecta en el <head> vía el slot extraHead del layout
      extraHead:
        '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />',

      // Leaflet JS + script estático de interactividad
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

// ============================================================
// POST /lands/create — Crear un nuevo predio
// REGLA DE SEGURIDAD: user_id forzado desde req.user.id
// ============================================================
export const createFarmPrivate = async (req, res) => {
  try {
    const {
      name,
      size_hectares,
      farming_type,
      municipality,
      region_id,
      location_lat,
      location_lng,
    } = req.body;

    await db.Farm.create({
      name,
      size_hectares: size_hectares || null,
      farming_type: farming_type || null,
      municipality: municipality || null,
      region_id: region_id || null,
      location_lat: location_lat || null,
      location_lng: location_lng || null,
      user_id: req.user.id,
      status: true,
    });

    return res.redirect('/lands');
  } catch (error) {
    console.error('Error al crear el terreno:', error);
    return res.status(500).send('Error al crear el terreno');
  }
};

// ============================================================
// GET /private/lands/:id/expediente — Detalle de un terreno
// REGLA DE SEGURIDAD: Consulta aislada por user_id
// ============================================================
export const landDetail = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el predio existe en la BD pero pertenece a otro usuario
    const existingFarm = await db.Farm.findByPk(id);
    if (
      existingFarm &&
      (existingFarm.user_id !== req.user.id || !existingFarm.status)
    ) {
      return res.status(404).send('Predio no encontrado');
    }

    // Buscar la parcela real en la base de datos perteneciendo al usuario
    const farm = await db.Farm.findOne({
      where: {
        id,
        user_id: req.user.id,
        status: true,
      },
      include: [
        {
          model: db.Region,
          as: 'region',
          attributes: ['id', 'name'],
          required: false,
        },
        {
          model: db.FarmCrop,
          as: 'farmCrops',
          include: [
            {
              model: db.Crop,
              as: 'crop',
            },
          ],
        },
        {
          model: db.HealthReport,
          as: 'healthReports',
        },
        {
          model: db.ApplicationLog,
          as: 'applicationLogs',
        },
      ],
      order: [
        [{ model: db.HealthReport, as: 'healthReports' }, 'createdAt', 'DESC'],
        [
          { model: db.ApplicationLog, as: 'applicationLogs' },
          'createdAt',
          'DESC',
        ],
      ],
    });

    const regions = await db.Region.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
      raw: true,
    });

    const crops = await db.Crop.findAll({
      attributes: ['id', 'name', 'common_name'],
      order: [['name', 'ASC']],
      raw: true,
    });

    const plagues = await db.Plague.findAll({
      attributes: ['id', 'name', 'scientific_name'],
      order: [['name', 'ASC']],
      raw: true,
    });

    const products = await db.Product.findAll({
      attributes: ['id', 'name', 'active_ingredient'],
      order: [['name', 'ASC']],
      raw: true,
    });

    if (farm) {
      const landData = farm.toJSON();

      const rawFarmCrops = landData.farmCrops || [];
      const farmCrops = rawFarmCrops.map((fc) => ({
        ...fc,
        displayName: fc.crop
          ? fc.crop.name
          : fc.custom_crop_name || 'Otro Cultivo',
        displaySubName: fc.crop ? fc.crop.common_name : 'Cultivo Personalizado',
        areaSection: fc.area_section || 'General',
      }));

      // Seleccionar un cultivo específico si viene en query o si el usuario quiere enfocar uno
      const selectedCropId = req.query.crop_id
        ? String(req.query.crop_id)
        : null;
      const selectedCrop = selectedCropId
        ? farmCrops.find((fc) => String(fc.id) === selectedCropId) || null
        : null;

      const healthReports = landData.healthReports || [];
      const applicationLogs = landData.applicationLogs || [];

      return res.render('private/lands/detail', {
        layout: privateLayout,
        pageTitle: `Expediente — ${landData.name}`,
        activePage: 'lands',
        extraScripts: '<script src="/js/private/land-detail.js"></script>',
        farm: landData,
        farmCrops,
        farmCropsCount: farmCrops.length,
        selectedCrop,
        healthReports,
        applicationLogs,
        healthReportsCount: healthReports.length,
        regions,
        crops,
        plagues,
        products,
        landName: landData.name,
        landLocation: `${landData.municipality || 'Sin municipio'}${landData.region ? ' — ' + landData.region.name : ''}`,
        landLat: landData.location_lat ? String(landData.location_lat) : 'N/A',
        landLng: landData.location_lng ? String(landData.location_lng) : 'N/A',
        landHectares: landData.size_hectares
          ? String(landData.size_hectares)
          : '0',
        landId: `#PRD-${String(landData.id).padStart(4, '0')}`,
      });
    }

    // Fallback para predios de demostración / maqueta
    const demoLand = DEMO_LANDS[id];
    if (demoLand) {
      return res.render('private/lands/detail', {
        layout: privateLayout,
        pageTitle: `Expediente — ${demoLand.landName}`,
        activePage: 'lands',
        extraScripts: '<script src="/js/private/land-detail.js"></script>',
        ...demoLand,
      });
    }

    return res.status(404).send('Predio no encontrado');
  } catch (error) {
    console.error('Error al obtener el expediente del terreno:', error);
    return res.status(500).send('Error al obtener el expediente del terreno');
  }
};

// ============================================================
// POST /private/lands/update/:id — Actualizar un predio
// REGLA DE SEGURIDAD: Edición restringida a predios del usuario logueado
// ============================================================
export const updateFarmPrivate = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      size_hectares,
      farming_type,
      municipality,
      region_id,
      location_lat,
      location_lng,
    } = req.body;

    const farm = await db.Farm.findOne({
      where: { id, user_id: req.user.id, status: true },
    });

    if (!farm) {
      return res.status(404).send('Predio no encontrado o sin permisos');
    }

    await farm.update({
      name: name ? String(name).trim() : farm.name,
      size_hectares: size_hectares || farm.size_hectares,
      farming_type: farming_type || farm.farming_type,
      municipality: municipality || farm.municipality,
      region_id: region_id || farm.region_id,
      location_lat: location_lat || farm.location_lat,
      location_lng: location_lng || farm.location_lng,
    });

    return res.redirect(`/lands/${id}/expediente`);
  } catch (error) {
    console.error('Error al actualizar el terreno:', error);
    return res.status(500).send('Error al actualizar el terreno');
  }
};

// ============================================================
// POST /private/lands/delete/:id — Baja lógica de un predio
// REGLA DE SEGURIDAD: Eliminación restringida a predios del usuario logueado
// ============================================================
export const deleteFarmPrivate = async (req, res) => {
  try {
    const { id } = req.params;

    const farm = await db.Farm.findOne({
      where: { id, user_id: req.user.id, status: true },
    });

    if (!farm) {
      return res.status(404).send('Predio no encontrado o sin permisos');
    }

    await farm.update({ status: false });

    return res.redirect('/lands');
  } catch (error) {
    console.error('Error al eliminar el terreno:', error);
    return res.status(500).send('Error al eliminar el terreno');
  }
};

// ============================================================
// POST /lands/:id/crop/create — Registrar ciclo de cultivo
// ============================================================
export const createFarmCrop = async (req, res) => {
  try {
    const { id } = req.params;
    const { crop_id, custom_crop_name, area_section, planting_date, status } =
      req.body;

    const farm = await db.Farm.findOne({
      where: { id, user_id: req.user.id, status: true },
    });

    if (!farm) {
      return res.status(404).send('Predio no encontrado o sin permisos');
    }

    const isCustom = crop_id === 'otro' || !crop_id;
    const finalCropId = isCustom ? null : parseInt(crop_id, 10);
    const finalCustomName = isCustom
      ? custom_crop_name
        ? String(custom_crop_name).trim()
        : 'Otro Cultivo'
      : null;

    await db.FarmCrop.create({
      farm_id: farm.id,
      crop_id: finalCropId,
      custom_crop_name: finalCustomName,
      area_section: area_section ? String(area_section).trim() : 'General',
      planting_date: planting_date || new Date(),
      is_active: true,
      status: status || 'En Crecimiento',
    });

    return res.redirect(`/lands/${id}/expediente`);
  } catch (error) {
    console.error('Error al registrar el ciclo de cultivo:', error);
    return res.status(500).send('Error al registrar el ciclo de cultivo');
  }
};

// ============================================================
// POST /lands/:id/health-report/create — Registrar hallazgo fitosanitario
// ============================================================
export const createHealthReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { plaga_nombre, custom_plaga_nombre, severidad, descripcion } =
      req.body;

    const farm = await db.Farm.findOne({
      where: { id, user_id: req.user.id, status: true },
    });

    if (!farm) {
      return res.status(404).send('Predio no encontrado o sin permisos');
    }

    const finalPlagaNombre = custom_plaga_nombre
      ? String(custom_plaga_nombre).trim()
      : plaga_nombre
        ? String(plaga_nombre).trim()
        : 'Hallazgo Fitosanitario';

    await db.HealthReport.create({
      farm_id: farm.id,
      plaga_nombre: finalPlagaNombre,
      severidad: severidad || 'baja',
      descripcion: descripcion || '',
      status: 'Activa',
      reporter_name: req.user ? req.user.full_name : 'Agricultor',
    });

    return res.redirect(`/lands/${id}/expediente`);
  } catch (error) {
    console.error('Error al registrar el hallazgo fitosanitario:', error);
    return res.status(500).send('Error al registrar el hallazgo fitosanitario');
  }
};

// ============================================================
// POST /lands/:id/application-log/create — Registrar aplicación química
// ============================================================
export const createApplicationLog = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      producto_nombre,
      custom_producto_nombre,
      ingrediente_activo,
      dosis,
      fecha_aplicacion,
      notas,
    } = req.body;

    const farm = await db.Farm.findOne({
      where: { id, user_id: req.user.id, status: true },
    });

    if (!farm) {
      return res.status(404).send('Predio no encontrado o sin permisos');
    }

    const finalProducto = custom_producto_nombre
      ? String(custom_producto_nombre).trim()
      : producto_nombre
        ? String(producto_nombre).trim()
        : 'Producto Fitosanitario';

    await db.ApplicationLog.create({
      farm_id: farm.id,
      producto_nombre: finalProducto,
      ingrediente_activo: ingrediente_activo || '',
      dosis: dosis || '1.0 L/ha',
      fecha_aplicacion: fecha_aplicacion || new Date(),
      notas: notas || '',
      applicator_name: req.user ? req.user.full_name : 'Técnico',
    });

    return res.redirect(`/lands/${id}/expediente`);
  } catch (error) {
    console.error('Error al registrar la aplicación química:', error);
    return res.status(500).send('Error al registrar la aplicación química');
  }
};
