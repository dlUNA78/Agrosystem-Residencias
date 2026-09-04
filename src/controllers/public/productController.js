import db from '../../models/index.js';
const { Product, ProductImage, Plague, Crop } = db;
const { Op } = db.Sequelize;

export const getProductsData = async (req, res) => {
  try {
    const { search = '', page = 1, limit: customLimit } = req.query;
    const limit = parseInt(customLimit, 10) || 8;
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const offset = (currentPage - 1) * limit;

    const where = { status: true };

    if (search.trim()) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search.trim()}%` } },
        { active_ingredient: { [Op.iLike]: `%${search.trim()}%` } },
        { manufacturer: { [Op.iLike]: `%${search.trim()}%` } },
        { category: { [Op.iLike]: `%${search.trim()}%` } },
      ];
    }

    const { count, rows } = await Product.findAndCountAll({
      where,
      include: [
        {
          model: ProductImage,
          as: 'images',
          required: false,
        },
      ],
      order: [['name', 'ASC']],
      limit,
      offset,
      distinct: true,
    });

    const plainProducts = rows.map((pRecord) => {
      const p = pRecord.toJSON();
      const primaryImg = p.images?.find((i) => i.is_primary) || p.images?.[0];
      return {
        ...p,
        image_url: primaryImg?.image_url || '/images/products/default.png',
      };
    });

    res.json({
      products: plainProducts,
      totalCount: count,
      totalPages: Math.ceil(count / limit) || 1,
      currentPage,
    });
  } catch (error) {
    console.error('Error en getProductsData:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const renderProductsPublic = async (req, res) => {
  try {
    const { search = '' } = req.query;

    const where = { status: true };

    if (search.trim()) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search.trim()}%` } },
        { active_ingredient: { [Op.iLike]: `%${search.trim()}%` } },
        { manufacturer: { [Op.iLike]: `%${search.trim()}%` } },
      ];
    }

    const products = await Product.findAll({
      where,
      include: [
        {
          model: ProductImage,
          as: 'images',
          required: false,
        },
      ],
      order: [['name', 'ASC']],
    });

    const plainProducts = products.map((pRecord) => {
      const p = pRecord.toJSON();
      const primaryImg = p.images?.find((i) => i.is_primary) || p.images?.[0];
      return {
        ...p,
        image_url: primaryImg?.image_url || '/images/products/default.png',
      };
    });

    res.render('public/products', {
      pageTitle: 'Catálogo de Agroquímicos y Productos',
      activePage: 'products',
      products: plainProducts,
      totalCount: plainProducts.length,
      search: search.trim(),
    });
  } catch (error) {
    console.error('Error al renderizar productos públicos:', error);
    res.status(500).render('public/products', {
      pageTitle: 'Productos',
      activePage: 'products',
      products: [],
      error: 'Error al cargar el catálogo de productos.',
    });
  }
};

export const renderProductDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const productRecord = await Product.findByPk(id, {
      include: [
        { model: ProductImage, as: 'images', required: false },
        {
          model: Plague,
          as: 'plagues',
          through: { attributes: [] },
          include: [
            {
              model: db.PlagueImage,
              as: 'images',
              required: false,
            },
          ],
        },
        {
          model: Crop,
          as: 'crops',
          through: { attributes: [] },
          include: [
            {
              model: db.CropImage,
              as: 'images',
              required: false,
            },
          ],
        },
      ],
    });

    if (!productRecord || !productRecord.status) {
      return res.status(404).render('shared/product-detail', {
        pageTitle: 'Producto no encontrado',
        error: 'El producto solicitado no existe o fue deshabilitado.',
      });
    }

    const product = productRecord.toJSON();

    const normalizeImagePath = (imagePath) => {
      if (!imagePath) return null;
      let path = String(imagePath).trim();
      path = path.replace(/^\/+/, '');
      path = path.replace(/^public\/+/, '');
      return `/${path}`;
    };

    const primaryImg =
      product.images?.find((i) => i.is_primary) || product.images?.[0];

    let mainImg = primaryImg?.image_url || product.image_url;
    if (mainImg) {
      mainImg = normalizeImagePath(mainImg);
    } else {
      mainImg = '/images/products/confidor-350-sc.webp';
    }
    product.image_url = mainImg;

    // ── Enriquecer plagas blanco asociadas ─────────────────────────────────
    const riskThemes = {
      Alto: {
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
        label: 'Crítico',
      },
      Medio: {
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        label: 'Moderado',
      },
      Bajo: {
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        label: 'Bajo',
      },
    };

    const plagueFallbackImages = {
      'Pulgón Verde': '/images/plagas/pulgon-verde.webp',
      'Gusano Cogollero': '/images/plagas/gusano-cogollero.webp',
      Cenicilla: '/images/plagas/cenicilla.webp',
      'Mosca del Mediterráneo': '/images/plagas/mosca-mediterraneo.webp',
      'Psílido Asiático': '/images/plagas/psilido-asiatico.webp',
      'Roya Amarilla': '/images/plagas/roya-amarilla.webp',
      'Tizón Tardío': '/images/plagas/tizon-tardio.webp',
      'Trips Oriental': '/images/plagas/trips-oriental.webp',
    };

    if (Array.isArray(product.plagues)) {
      product.plagues = product.plagues.map((p) => {
        const theme = riskThemes[p.risk_level] || riskThemes.Bajo;
        const primaryPlagueImg =
          p.images?.find((img) => img.is_primary) || p.images?.[0];

        let imgUrl =
          primaryPlagueImg?.image_url || primaryPlagueImg?.url || p.image_url;

        if (imgUrl) {
          imgUrl = normalizeImagePath(imgUrl);
        } else {
          imgUrl =
            plagueFallbackImages[p.name] || '/images/plagas/pulgon-verde.webp';
        }

        return {
          ...p,
          image_url: imgUrl,
          riskTheme: theme,
        };
      });
    }

    // ── Enriquecer cultivos autorizados ────────────────────────────────────
    if (Array.isArray(product.crops)) {
      product.crops = product.crops.map((c) => {
        const primaryCropImg =
          c.images?.find((img) => img.is_primary) || c.images?.[0];

        let imgUrl = primaryCropImg?.image_url || c.image_url;
        if (imgUrl) {
          imgUrl = normalizeImagePath(imgUrl);
        } else {
          imgUrl = '/images/test/default.png';
        }

        return {
          ...c,
          image_url: imgUrl,
        };
      });
    }

    res.render('shared/product-detail', {
      pageTitle: product.name,
      activePage: 'products',
      isPrivate: false,
      product,
    });
  } catch (error) {
    console.error('Error al renderizar el detalle del producto:', error);
    res.status(500).render('shared/product-detail', {
      pageTitle: 'Error',
      error: 'Error al cargar el detalle del producto.',
    });
  }
};
