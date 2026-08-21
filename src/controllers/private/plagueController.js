import path from 'path';
import { fileURLToPath } from 'url';

import db from '../../models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta absoluta al layout privado
const privateLayout = path.join(__dirname, '../../views/layouts/private');

const { Plague } = db;

export const plaguesPrivate = async (req, res) => {
  try {
    const { search = '', category = '', status = '' } = req.query;

    const { Op } = db.Sequelize;

    const where = {};

    // BUSCADOR
    if (search.trim()) {
      where[Op.or] = [
        {
          name: {
            [Op.iLike]: `%${search.trim()}%`,
          },
        },
        {
          scientific_name: {
            [Op.iLike]: `%${search.trim()}%`,
          },
        },
        {
          region: {
            [Op.iLike]: `%${search.trim()}%`,
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

    // CONSULTAR PLAGAS
    const plagues = await db.Plague.findAll({
      where,
      order: [['createdAt', 'DESC']],
      raw: true,
    });

    console.log('FILTRO STATUS:', status);
    console.log('PLAGAS ENCONTRADAS:', plagues);

    return res.render('private/catalog/plagues', {
      layout: privateLayout,
      pageTitle: 'Plagas',
      activePage: 'plagues',
      plagues,

      searchId: 'plague-search',
      searchPlaceholder: 'Buscar por nombre, especie o cultivo afectado...',

      searchFilters: [
        {
          id: 'filter-crop',
          label: 'Cultivo:',
          options: [
            { value: 'maiz', text: 'Maíz' },
            { value: 'sorgo', text: 'Sorgo' },
            { value: 'mango', text: 'Mango' },
            { value: 'limon', text: 'Limón' },
          ],
        },
        {
          id: 'filter-status',
          label: 'Estatus:',
          options: [
            { value: '', text: 'Todos' },
            { value: 'true', text: 'Activo' },
            { value: 'false', text: 'Inactivo' },
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
  try {
    const image_url = req.file
      ? `images/plagues/${req.file.filename}`
      : null;

    // =========================================
    // CICLO BIOLÓGICO
    // =========================================

    let biological_cycle = null;

    if (req.body.biological_cycle?.trim()) {
      biological_cycle = req.body.biological_cycle
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    await db.Plague.create({
      name: req.body.name?.trim(),
      scientific_name: req.body.scientific_name?.trim(),
      category: req.body.category,
      description: req.body.description,
      risk_level: req.body.risk_level,
      region: req.body.region,

      symptoms: req.body.symptoms,
      control_methods: req.body.control_methods,
      biological_control: req.body.biological_control,

      // NUEVOS CAMPOS
      biological_cycle,
      verified_by: req.body.verified_by?.trim() || null,
      verified_at: req.body.verified_at || null,

      image_url,

      status:
        req.body.status === 'true' ||
        req.body.status === 'on' ||
        req.body.status === true,
    });

    return res.redirect('/private/plagues');

  } catch (error) {
    console.error('Error al crear la plaga:', error);

    return res.status(500).send('Error al crear la plaga');
  }
};

// ACTUALIZAR PLAGA
export const updatePlague = async (req, res) => {
  try {
    const { id } = req.params;

    const plague = await db.Plague.findByPk(id);

    if (!plague) {
      return res.status(404).send('Plaga no encontrada');
    }

    // =========================================
    // CICLO BIOLÓGICO
    // =========================================

    let biological_cycle = null;

    if (req.body.biological_cycle?.trim()) {
      biological_cycle = req.body.biological_cycle
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    const data = {
      name: req.body.name?.trim(),
      scientific_name: req.body.scientific_name?.trim(),
      category: req.body.category,
      description: req.body.description,
      risk_level: req.body.risk_level,
      region: req.body.region,

      symptoms: req.body.symptoms,
      control_methods: req.body.control_methods,
      biological_control: req.body.biological_control,

      // NUEVOS CAMPOS
      biological_cycle,
      verified_by: req.body.verified_by?.trim() || null,
      verified_at: req.body.verified_at || null,

      status:
        req.body.status === 'true' ||
        req.body.status === 'on' ||
        req.body.status === true,
    };

    // =========================================
    // IMAGEN
    // =========================================

    // Solo reemplaza la imagen si se seleccionó una nueva
    if (req.file) {
      data.image_url = `images/plagues/${req.file.filename}`;
    }

    await plague.update(data);

    return res.redirect('/private/plagues');

  } catch (error) {
    console.error('Error al actualizar la plaga:', error);

    return res.status(500).send('Error al actualizar la plaga');
  }
};

// ELIMINAR PLAGA
export const deletePlague = async (req, res) => {
  try {
    const { id } = req.params;

    const plague = await db.Plague.findByPk(id);

    if (!plague) {
      return res.status(404).send('Plaga no encontrada');
    }

    await plague.destroy();

    return res.redirect('/private/plagues');
  } catch (error) {
    console.error('Error al eliminar la plaga:', error);
    return res.status(500).send('Error al eliminar la plaga');
  }
};

// VER DETALLE DE UNA PLAGA
export const getPlagueDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const plague = await db.Plague.findByPk(id, {
      raw: true,
    });

    if (!plague) {
      return res.status(404).send('Plaga no encontrada');
    }

    return res.render('private/catalog/plagues-Detalle', {
      layout: privateLayout,
      pageTitle: `${plague.name} - Plagas`,
      activePage: 'plagues',
      plague,
    });

  } catch (error) {
    console.error('Error al cargar el detalle de la plaga:', error);

    return res.status(500).send('Error al cargar el detalle de la plaga');
  }
};