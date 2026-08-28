import path from 'path';
import { fileURLToPath } from 'url';

import db from '../../models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta absoluta al layout privado
const privateLayout = path.join(__dirname, '../../views/layouts/private');

const { Plague, PlagueImage } = db;

// LISTADO DE PLAGAS

export const plaguesPrivate = async (req, res) => {
  try {
    const { search = '', category = '', status = '' } = req.query;

    const { Op } = db.Sequelize;

    const where = {};

    // BUSCADOR

    if (search.trim()) {
      const searchTerm = search.trim();

      where[Op.or] = [
        {
          name: {
            [Op.iLike]: `%${searchTerm}%`,
          },
        },
        {
          scientific_name: {
            [Op.iLike]: `%${searchTerm}%`,
          },
        },
        {
          region: {
            [Op.iLike]: `%${searchTerm}%`,
          },
        },
      ];
    }

    // FILTRO POR CATEGORÍA

    if (category.trim()) {
      where.category = category;
    }

    // FILTRO POR ESTATUS

    if (status === 'true') {
      where.status = true;
    }

    if (status === 'false') {
      where.status = false;
    }

    // CONSULTAR PLAGAS + IMÁGENES

    const plagueRecords = await Plague.findAll({
      where,

      include: [
        {
          model: PlagueImage,
          as: 'images',
          required: false,
          separate: true,
          order: [['sort_order', 'ASC']],
        },
      ],

      order: [['createdAt', 'DESC']],
    });

    // FORMATEAR DATOS PARA HANDLEBARS

    const plagues = plagueRecords.map((plague) => {
      const data = plague.toJSON();

      const images = Array.isArray(data.images) ? data.images : [];

      return {
        ...data,

        // Primera imagen para tabla/grid
        image_url: images.length > 0 ? images[0].url : null,

        // Todas las imágenes disponibles
        images,
      };
    });

    // CALCULAR ESTADÍSTICAS ADMINISTRATIVAS (KPIS)
    const totalPlagues = await Plague.count();
    const activePlagues = await Plague.count({ where: { status: true } });
    const criticalPlagues = await Plague.count({
      where: {
        risk_level: {
          [Op.or]: ['Crítico', 'Alto', 'critico', 'alto'],
        },
      },
    });
    const pendingVerification = await Plague.count({
      where: {
        [Op.or]: [{ verified_by: null }, { verified_by: '' }],
      },
    });

    // RBAC Y ROLES DE USUARIO
    const currentUser = req.user || { role: 'admin', name: 'Administrador' };
    const userRole = currentUser.role || 'admin';
    const canManage = !req.user || ['admin', 'inifap'].includes(userRole);
    const isAdmin = !req.user || userRole === 'admin';
    const isInifap = userRole === 'inifap' || userRole === 'admin';

    console.log('FILTRO STATUS:', status);
    console.log('PLAGAS ENCONTRADAS:', plagues.length);

    // VISTA
    return res.render('private/catalog/plagues', {
      layout: privateLayout,

      pageTitle: 'Gestión Fitosanitaria - Plagas',

      activePage: 'plagues',

      plagues,

      stats: {
        totalPlagues,
        activePlagues,
        criticalPlagues,
        pendingVerification,
      },

      user: currentUser,
      canManage,
      isAdmin,
      isInifap,

      // SEARCH BAR REUTILIZABLE

      searchId: 'plague-search',

      searchPlaceholder: 'Buscar por nombre, especie o cultivo afectado...',

      searchFilters: [
        {
          id: 'filter-category',

          label: 'Categoría:',

          options: [
            {
              value: '',
              text: 'Todas',
            },

            {
              value: 'Insecto',
              text: 'Insecto',
            },

            {
              value: 'Hongo',
              text: 'Hongo',
            },

            {
              value: 'Bacteria',
              text: 'Bacteria',
            },

            {
              value: 'Virus',
              text: 'Virus',
            },

            {
              value: 'Ácaro',
              text: 'Ácaro',
            },
          ],
        },

        {
          id: 'filter-status',

          label: 'Estatus:',

          options: [
            {
              value: '',
              text: 'Todos',
            },

            {
              value: 'true',
              text: 'Activo',
            },

            {
              value: 'false',
              text: 'Inactivo',
            },
          ],
        },
      ],

      ctaLabel: 'Añadir Plaga',

      ctaIcon: 'bug_report',

      ctaBtnId: 'btn-add-plague',

      showViewToggle: true,
    });
  } catch (error) {
    console.error('Error al cargar las plagas:', error);

    return res.status(500).send('Error al cargar las plagas');
  }
};

// CREAR PLAGA

export const createPlague = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    // ========================================================
    // DEBUG DE ARCHIVO RECIBIDO
    // ========================================================

    console.log('========================================');
    console.log('ARCHIVO RECIBIDO:', req.file);
    console.log('BODY RECIBIDO:', req.body);
    console.log('========================================');

    if (req.file) {
      console.log('✅ IMAGEN RECIBIDA:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path,
      });
    } else {
      console.log('⚠️ NO SE RECIBIÓ NINGUNA IMAGEN');
    }

    // ========================================================
    // CICLO BIOLÓGICO
    // ========================================================

    let biological_cycle = null;

    if (req.body.biological_cycle?.trim()) {
      biological_cycle = req.body.biological_cycle
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    // ========================================================
    // CREAR REGISTRO DE PLAGA
    // ========================================================

    const plague = await Plague.create(
      {
        name: req.body.name?.trim(),

        scientific_name: req.body.scientific_name?.trim() || null,

        category: req.body.category || null,

        description: req.body.description?.trim() || null,

        risk_level: req.body.risk_level || null,

        region: req.body.region?.trim() || null,

        symptoms: req.body.symptoms?.trim() || null,

        control_methods: req.body.control_methods?.trim() || null,

        biological_control: req.body.biological_control?.trim() || null,

        biological_cycle,

        verified_by: req.body.verified_by?.trim() || null,

        verified_at: req.body.verified_at || null,

        status:
          req.body.status === 'true' ||
          req.body.status === 'on' ||
          req.body.status === true,
      },
      {
        transaction,
      },
    );

    console.log('✅ PLAGA CREADA CON ID:', plague.id);

    // ========================================================
    // GUARDAR IMAGEN EN PlagueImages
    // ========================================================

    if (req.file) {
      const imageUrl = `images/plagues/${req.file.filename}`;

      await PlagueImage.create(
        {
          plague_id: plague.id,
          url: imageUrl,
          sort_order: 0,
        },
        {
          transaction,
        },
      );

      console.log('✅ IMAGEN GUARDADA:', imageUrl);
    } else {
      console.log('⚠️ LA PLAGA SE CREÓ SIN IMAGEN');
    }

    // ========================================================
    // CONFIRMAR TRANSACCIÓN
    // ========================================================

    await transaction.commit();

    console.log('✅ PLAGA E IMAGEN GUARDADAS CORRECTAMENTE');

    return res.redirect('/private/plagues');
  } catch (error) {
    // ========================================================
    // REVERTIR TRANSACCIÓN
    // ========================================================

    await transaction.rollback();

    console.error('❌ ERROR AL CREAR LA PLAGA:', error);

    return res.status(500).send('Error al crear la plaga');
  }
};

// ACTUALIZAR PLAGA

export const updatePlague = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;

    // VALIDAR ID

    if (!/^\d+$/.test(id)) {
      await transaction.rollback();

      return res.status(400).send('ID de plaga no válido');
    }

    const plague = await Plague.findByPk(Number(id), {
      transaction,
    });

    if (!plague) {
      await transaction.rollback();

      return res.status(404).send('Plaga no encontrada');
    }

    // ========================================================
    // CICLO BIOLÓGICO
    // ========================================================

    let biological_cycle = null;

    if (req.body.biological_cycle?.trim()) {
      biological_cycle = req.body.biological_cycle
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    // ========================================================
    // ACTUALIZAR DATOS DE LA PLAGA
    // ========================================================

    await plague.update(
      {
        name: req.body.name?.trim(),

        scientific_name: req.body.scientific_name?.trim(),

        category: req.body.category || null,

        description: req.body.description?.trim() || null,

        risk_level: req.body.risk_level || null,

        region: req.body.region?.trim() || null,

        symptoms: req.body.symptoms?.trim() || null,

        control_methods: req.body.control_methods?.trim() || null,

        biological_control: req.body.biological_control?.trim() || null,

        biological_cycle,

        verified_by: req.body.verified_by?.trim() || null,

        verified_at: req.body.verified_at || null,

        status:
          req.body.status === 'true' ||
          req.body.status === 'on' ||
          req.body.status === true,
      },
      {
        transaction,
      },
    );

    // ========================================================
    // SI SE SUBIÓ UNA NUEVA IMAGEN
    // ========================================================

    if (req.file) {
      // El formulario maneja una sola imagen.
      // Eliminamos la anterior.

      await PlagueImage.destroy({
        where: {
          plague_id: plague.id,
        },

        transaction,
      });

      // Guardamos la nueva

      await PlagueImage.create(
        {
          plague_id: plague.id,

          url: `images/plagues/${req.file.filename}`,

          sort_order: 0,
        },
        {
          transaction,
        },
      );
    }

    await transaction.commit();

    return res.redirect('/private/plagues');
  } catch (error) {
    await transaction.rollback();

    console.error('Error al actualizar la plaga:', error);

    return res.status(500).send('Error al actualizar la plaga');
  }
};

// ELIMINAR PLAGA

export const deletePlague = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;

    // ========================================================
    // VALIDAR ID
    // ========================================================

    if (!/^\d+$/.test(id)) {
      await transaction.rollback();

      return res.status(400).send('ID de plaga no válido');
    }

    const plague = await Plague.findByPk(Number(id), {
      transaction,
    });

    if (!plague) {
      await transaction.rollback();

      return res.status(404).send('Plaga no encontrada');
    }

    // ========================================================
    // ELIMINAR IMÁGENES
    // ========================================================

    await PlagueImage.destroy({
      where: {
        plague_id: plague.id,
      },

      transaction,
    });

    // ========================================================
    // ELIMINAR PLAGA
    // ========================================================

    await plague.destroy({
      transaction,
    });

    await transaction.commit();

    return res.redirect('/private/plagues');
  } catch (error) {
    await transaction.rollback();

    console.error('Error al eliminar la plaga:', error);

    return res.status(500).send('Error al eliminar la plaga');
  }
};

// DETALLE DE PLAGA

export const getPlagueDetail = async (req, res) => {
  try {
    const { id } = req.params;

    // Validar ID
    if (!/^\d+$/.test(id)) {
      return res.status(400).send('ID de plaga no válido');
    }

    const plagueId = Number(id);

    if (!Number.isSafeInteger(plagueId) || plagueId <= 0) {
      return res.status(400).send('ID de plaga no válido');
    }

    // Buscar plaga junto con sus imágenes
    const plague = await Plague.findByPk(plagueId, {
      include: [
        {
          model: PlagueImage,
          as: 'images',
          required: false,
          separate: true,
          order: [['sort_order', 'ASC']],
        },
      ],
    });

    if (!plague) {
      return res.status(404).send('Plaga no encontrada');
    }

    const plagueData = plague.toJSON();

    // IMÁGENES

    const images = Array.isArray(plagueData.images) ? plagueData.images : [];

    // Imagen principal
    const imageUrl =
      images.length > 0 && images[0].url
        ? images[0].url.replace(/^\/+/, '')
        : plagueData.image_url || null;

    // Imágenes para el carrusel
    const carouselImages = images
      .filter((image) => image.url)
      .map((image) => ({
        url: `/${image.url.replace(/^\/+/, '')}`,
        caption: image.caption || plagueData.name,
        source: image.source || 'INIFAP',
      }));

    // RIESGO

    const riskValue = String(plagueData.risk_level || '')
      .toLowerCase()
      .trim();

    let risk;

    switch (riskValue) {
      case 'critico':
      case 'crítico':
        risk = {
          label: 'Crítico',
          badgeClass: 'bg-error-container text-on-error-container',
          gradientClass: 'bg-gradient-to-br from-red-700 to-red-900',
        };
        break;

      case 'alto':
        risk = {
          label: 'Alto',
          badgeClass: 'bg-error-container text-on-error-container',
          gradientClass: 'bg-gradient-to-br from-orange-600 to-red-700',
        };
        break;

      case 'moderado':
      case 'medio':
        risk = {
          label: 'Moderado',
          badgeClass: 'bg-primary-container text-on-primary-container',
          gradientClass: 'bg-gradient-to-br from-amber-500 to-orange-600',
        };
        break;

      case 'bajo':
        risk = {
          label: 'Bajo',
          badgeClass: 'bg-secondary-container text-on-secondary-container',
          gradientClass: 'bg-gradient-to-br from-green-600 to-emerald-700',
        };
        break;

      default:
        risk = {
          label: plagueData.risk_level || 'No especificado',
          badgeClass: 'bg-surface-container-high text-on-surface-variant',
          gradientClass: 'bg-gradient-to-br from-slate-600 to-slate-800',
        };
    }

    // OBJETO plague PARA shared/plague-detail.hbs

    const plagueView = {
      id: plagueData.id,
      name: plagueData.name,

      scientificName: plagueData.scientific_name,

      category: plagueData.category,
      description: plagueData.description,

      image_url: imageUrl,

      symptoms: plagueData.symptoms,
      controlMethods: plagueData.control_methods,
      biologicalControl: plagueData.biological_control,
      biologicalCycle: plagueData.biologicalCycle || [],

      region: plagueData.region,

      riskLabel: risk.label,
      riskBadgeClass: risk.badgeClass,
      riskGradientClass: risk.gradientClass,
      riskLevel: plagueData.risk_level,

      verifiedBy: plagueData.verified_by || null,

      verifiedAt: plagueData.verified_at
        ? new Date(plagueData.verified_at).toLocaleDateString('es-MX', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : null,

      images: carouselImages,
    };

    // DEBUG

    console.log('ID:', plagueView.id);
    console.log('Nombre:', plagueView.name);
    console.log('Nombre científico:', plagueView.scientificName);
    console.log('Riesgo BD:', plagueView.riskLevel);
    console.log('Riesgo mostrado:', plagueView.riskLabel);
    console.log('Imagen:', plagueView.image_url);

    // RENDER

    return res.render('shared/plague-detail', {
      layout: privateLayout,
      pageTitle: `${plagueView.name} - Plagas`,
      activePage: 'plagues',

      plague: plagueView,

      carouselImages,

      isPrivate: true,
    });
  } catch (error) {
    console.error('Error al cargar el detalle de la plaga:', error);

    return res.status(500).send('Error al cargar el detalle de la plaga');
  }
};
