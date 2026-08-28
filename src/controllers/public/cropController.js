import db from '../../models/index.js';
import { Op } from 'sequelize';

const { Crop, CropImage } = db;

// ── GET /api/crops — API JSON de Cultivos ──────────────────────────────────
export const getCropsData = async (req, res) => {
  try {
    const { search, category, page = 1, limit: customLimit } = req.query;
    const limit = parseInt(customLimit, 10) || 8;
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const offset = (currentPage - 1) * limit;

    const where = { status: 'aprobado' };

    if (search && search.trim()) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search.trim()}%` } },
        { scientific_name: { [Op.iLike]: `%${search.trim()}%` } },
        { description: { [Op.iLike]: `%${search.trim()}%` } },
        { family: { [Op.iLike]: `%${search.trim()}%` } },
      ];
    }

    if (category && category !== 'Categoría' && category !== 'Todas') {
      where.category = category;
    }

    const { count, rows } = await Crop.findAndCountAll({
      where,
      include: [
        {
          model: CropImage,
          as: 'images',
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    const crops = rows.map((cropItem) => {
      const c = cropItem.toJSON();
      const primaryImg = c.images?.find((i) => i.is_primary) || c.images?.[0];

      return {
        id: c.id,
        name: c.name,
        scientificName: c.scientific_name,
        category: c.category || 'General',
        family: c.family,
        description: c.description,
        image_url: primaryImg?.image_url || c.image_url,
        climate: c.climate,
        season: c.season,
        harvest_days: c.harvest_days,
        soil_type: c.soil_type,
        water_requirement: c.water_requirement,
      };
    });

    res.json({
      crops,
      totalCount: count,
      totalPages: Math.ceil(count / limit) || 1,
      currentPage,
    });
  } catch (error) {
    console.error('Error en getCropsData:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ── GET /crops — Catálogo Público de Cultivos ──────────────────────────────
export const renderCropsPublic = async (req, res) => {
  try {
    const { search, category, page = 1, limit: customLimit } = req.query;
    const limit = parseInt(customLimit, 10) || 8;
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const offset = (currentPage - 1) * limit;

    const where = { status: 'aprobado' };

    if (search && search.trim()) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search.trim()}%` } },
        { scientific_name: { [Op.iLike]: `%${search.trim()}%` } },
        { description: { [Op.iLike]: `%${search.trim()}%` } },
        { family: { [Op.iLike]: `%${search.trim()}%` } },
      ];
    }

    if (category && category !== 'Categoría' && category !== 'Todas') {
      where.category = category;
    }

    const { count, rows } = await Crop.findAndCountAll({
      where,
      include: [
        {
          model: CropImage,
          as: 'images',
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    const crops = rows.map((cropItem) => {
      const c = cropItem.toJSON();
      const primaryImg = c.images?.find((i) => i.is_primary) || c.images?.[0];

      return {
        id: c.id,
        name: c.name,
        scientificName: c.scientific_name,
        category: c.category || 'General',
        family: c.family,
        description: c.description,
        image_url: primaryImg?.image_url || c.image_url,
        climate: c.climate,
        season: c.season,
        harvest_days: c.harvest_days,
        soil_type: c.soil_type,
        water_requirement: c.water_requirement,
      };
    });

    const totalPages = Math.ceil(count / limit) || 1;

    res.render('public/crops', {
      pageTitle: 'Catálogo de Cultivos',
      activePage: 'crops',
      crops,
      totalCount: count,
      totalPages,
      currentPage,
      hasMultiplePages: totalPages > 1,
      hasPrevPage: currentPage > 1,
      hasNextPage: currentPage < totalPages,
      prevPage: currentPage - 1,
      nextPage: currentPage + 1,
      search: search || '',
      selectedCategory: category || '',
    });
  } catch (error) {
    console.error('Error en renderCropsPublic:', error);
    res.render('public/crops', {
      pageTitle: 'Catálogo de Cultivos',
      activePage: 'crops',
      crops: [],
      totalCount: 0,
      totalPages: 1,
      currentPage: 1,
      error: 'Error al cargar los cultivos',
    });
  }
};

// ── GET /crops/:id — Detalle Público del Cultivo ───────────────────────────
export const renderCropDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const cropRecord = await Crop.findByPk(id, {
      include: [
        {
          model: CropImage,
          as: 'images',
          required: false,
        },
        {
          model: db.Plague,
          as: 'plagues',
          required: false,
        },
        {
          model: db.Farm,
          as: 'farms',
          required: false,
        },
        {
          model: db.Product,
          as: 'products',
          required: false,
          include: [
            {
              model: db.ProductImage,
              as: 'images',
              required: false,
            },
          ],
        },
      ],
    });

    // ── Validar que el cultivo exista y esté aprobado ─────────────────────
    if (!cropRecord || cropRecord.status !== 'aprobado') {
      return res.status(404).render('public/crops', {
        pageTitle: 'Cultivo No Encontrado',
        activePage: 'crops',
        error: 'El cultivo solicitado no existe o no se encuentra disponible.',
        crops: [],
        totalCount: 0,
        totalPages: 1,
        currentPage: 1,
      });
    }

    const crop = cropRecord.toJSON();

    // ── Obtener imagen principal ──────────────────────────────────────────
    const primaryImg =
      crop.images?.find((image) => image.is_primary) ||
      crop.images?.[0] ||
      null;

    // ── Normalizar ruta de imagen ─────────────────────────────────────────
    const normalizeImagePath = (imagePath) => {
      if (!imagePath) return null;
      let path = String(imagePath).trim();
      path = path.replace(/^\/+/, '');
      path = path.replace(/^public\/+/, '');
      return `/${path}`;
    };

    // ── Imagen principal ──────────────────────────────────────────────────
    const primaryImage = primaryImg
      ? normalizeImagePath(primaryImg.image_url)
      : crop.image_url
      ? normalizeImagePath(crop.image_url)
      : null;

    // ── Normalizar imágenes del carrusel ──────────────────────────────────
    const carouselImages = (crop.images || []).map((image) => ({
      ...image,
      image_url: normalizeImagePath(image.image_url),
    }));

    crop.images = carouselImages;
    crop.image_url = primaryImage;

    // ── Enriquecer plagas con temas de riesgo ─────────────────────────────
    const riskThemes = {
      Alto: {
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
        textClass: 'text-rose-600',
        label: 'Crítico',
      },
      Medio: {
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        textClass: 'text-amber-600',
        label: 'Moderado',
      },
      Bajo: {
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        textClass: 'text-emerald-600',
        label: 'Bajo',
      },
    };

    if (Array.isArray(crop.plagues)) {
      crop.plagues = crop.plagues.map((p) => {
        const theme = riskThemes[p.risk_level] || riskThemes.Bajo;
        return {
          ...p,
          riskTheme: theme,
          riskLabel: theme.label,
        };
      });
    }

    // ── Enriquecer productos con URLs de imágenes ─────────────────────────
    if (Array.isArray(crop.products)) {
      crop.products = crop.products.map((prod) => {
        const primaryProdImg =
          prod.images?.find((img) => img.is_primary) || prod.images?.[0];

        let imgUrl = primaryProdImg?.image_url || prod.image_url;
        if (imgUrl) {
          imgUrl = normalizeImagePath(imgUrl);
        } else {
          imgUrl = '/images/products/confidor-350-sc.webp';
        }

        return {
          ...prod,
          image_url: imgUrl,
        };
      });
    }

    res.render('shared/crop-detail', {
      pageTitle: crop.name || crop.common_name,
      activePage: 'crops',
      isPrivate: false,
      crop,
      primaryImage,
      carouselImages,
    });
  } catch (error) {
    console.error('Error en renderCropDetail:', error);
    res.status(500).send('Error al cargar la información del cultivo');
  }
};
