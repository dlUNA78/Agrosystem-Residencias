import path from 'path';
import { fileURLToPath } from 'url';
import db from '../../models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const privateLayout = path.join(__dirname, '../../views/layouts/private');

const { Product, ProductImage, Plague, Crop } = db;

// ─── LISTAR PRODUCTOS PRIVADOS ───────────────────────────────────────────────
export const productsPrivate = async (req, res) => {
  try {
    const { search = '', category = '', status = '' } = req.query;
    const { Op } = db.Sequelize;

    const where = {};

    if (search.trim()) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search.trim()}%` } },
        { active_ingredient: { [Op.iLike]: `%${search.trim()}%` } },
        { manufacturer: { [Op.iLike]: `%${search.trim()}%` } },
      ];
    }

    if (category.trim()) {
      where.category = category;
    }

    if (status === 'true') where.status = true;
    if (status === 'false') where.status = false;

    const products = await Product.findAll({
      where,
      include: [
        {
          model: ProductImage,
          as: 'images',
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const plainProducts = products.map((pRecord) => {
      const p = pRecord.toJSON();
      const primaryImg = p.images?.find((i) => i.is_primary) || p.images?.[0];
      return {
        ...p,
        image_url: primaryImg?.image_url || '/images/products/default.png',
      };
    });

    return res.render('private/catalog/products', {
      layout: privateLayout,
      pageTitle: 'Gestión de Productos Agroquímicos',
      activePage: 'products',
      products: plainProducts,
    });
  } catch (error) {
    console.error('Error al listar productos en panel privado:', error);
    return res.status(500).render('private/catalog/products', {
      layout: privateLayout,
      pageTitle: 'Productos',
      activePage: 'products',
      products: [],
      error: 'Error interno al cargar la lista de productos.',
    });
  }
};

// ─── DETALLE DE PRODUCTO PRIVADO (VISTA COMPARTIDA) ─────────────────────────
export const getProductDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const productRecord = await Product.findByPk(id, {
      include: [
        { model: ProductImage, as: 'images', required: false },
        { model: Plague, as: 'plagues', through: { attributes: [] } },
        { model: Crop, as: 'crops', through: { attributes: [] } },
      ],
    });

    if (!productRecord) {
      if (req.xhr || req.headers.accept?.includes('json')) {
        return res
          .status(404)
          .json({ success: false, message: 'Producto no encontrado' });
      }
      return res.status(404).send('Producto no encontrado');
    }

    const product = productRecord.toJSON();
    const primaryImg = product.images?.find((i) => i.is_primary) || product.images?.[0];
    product.image_url = primaryImg?.image_url || '/images/products/default.png';

    if (
      req.xhr ||
      (req.headers.accept &&
        req.headers.accept.includes('json') &&
        !req.headers.accept.includes('text/html'))
    ) {
      return res.json({ success: true, product });
    }

    return res.render('shared/product-detail', {
      layout: privateLayout,
      isPrivate: true,
      pageTitle: `Ficha Técnica: ${product.name}`,
      activePage: 'products',
      product,
    });
  } catch (error) {
    console.error('Error al obtener el detalle privado del producto:', error);
    return res
      .status(500)
      .send('Error interno al obtener el detalle del producto');
  }
};

// ─── CREAR PRODUCTO ─────────────────────────────────────────────────────────
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      active_ingredient,
      registration_code,
      manufacturer,
      validation_status,
      expiration_date,
      target_crops,
      description,
      mode_of_action,
      hazard_category,
      suggested_dosage,
      safety_interval_days,
      formulation_type,
      safety_sheet_url,
    } = req.body;

    const newProduct = await Product.create({
      name,
      category,
      active_ingredient,
      registration_code,
      manufacturer,
      validation_status,
      expiration_date,
      target_crops,
      description,
      mode_of_action,
      hazard_category,
      suggested_dosage,
      safety_interval_days: safety_interval_days
        ? parseInt(safety_interval_days)
        : null,
      formulation_type,
      safety_sheet_url,
      status: true,
    });

    if (req.file) {
      const image_url = `/uploads/${req.file.filename}`;
      await ProductImage.create({
        product_id: newProduct.id,
        image_url,
        original_name: req.file.originalname,
        is_primary: true,
        display_order: 1,
      });
    }

    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(201).json({
        success: true,
        message: 'Producto creado exitosamente',
        product: newProduct,
      });
    }

    return res.redirect('/private/products');
  } catch (error) {
    console.error('Error al crear producto:', error);
    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.status(500).json({ success: false, message: error.message });
    }
    return res.status(500).redirect('/private/products');
  }
};

// ─── ACTUALIZAR PRODUCTO ────────────────────────────────────────────────────
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).send('Producto no encontrado');
    }

    const updateData = { ...req.body };
    delete updateData.image_url;

    await product.update(updateData);

    if (req.file) {
      const image_url = `/uploads/${req.file.filename}`;
      await ProductImage.create({
        product_id: product.id,
        image_url,
        original_name: req.file.originalname,
        is_primary: true,
        display_order: 1,
      });
    }

    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.json({
        success: true,
        message: 'Producto actualizado',
        product,
      });
    }

    return res.redirect(`/private/products/${id}`);
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    return res.status(500).redirect('/private/products');
  }
};

// ─── ELIMINAR PRODUCTO ──────────────────────────────────────────────────────
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).send('Producto no encontrado');
    }

    await product.destroy();

    if (req.xhr || req.headers.accept?.includes('json')) {
      return res.json({
        success: true,
        message: 'Producto eliminado correctamente',
      });
    }

    return res.redirect('/private/products');
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    return res.status(500).redirect('/private/products');
  }
};
