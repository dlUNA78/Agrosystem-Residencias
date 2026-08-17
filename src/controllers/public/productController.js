import db from "../../models/index.js";
const { Product, Plague, Crop } = db;
const { Op } = db.Sequelize;

export const renderProductsPublic = async (req, res) => {
  try {
    const { search = "" } = req.query;

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
      order: [["name", "ASC"]],
    });

    const plainProducts = products.map((p) => p.toJSON());

    res.render("public/products", {
      pageTitle: "Catálogo de Agroquímicos y Productos",
      activePage: "products",
      products: plainProducts,
      totalCount: plainProducts.length,
      search: search.trim(),
    });
  } catch (error) {
    console.error("Error al renderizar productos públicos:", error);
    res.status(500).render("public/products", {
      pageTitle: "Productos",
      activePage: "products",
      products: [],
      error: "Error al cargar el catálogo de productos.",
    });
  }
};

export const renderProductDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id, {
      include: [
        { model: Plague, as: "plagues", through: { attributes: [] } },
        { model: Crop, as: "crops", through: { attributes: [] } },
      ],
    });

    if (!product) {
      return res.status(404).render("shared/product-detail", {
        pageTitle: "Producto no encontrado",
        error: "El producto solicitado no existe o fue deshabilitado.",
      });
    }

    res.render("shared/product-detail", {
      pageTitle: product.name,
      activePage: "products",
      isPrivate: false,
      product: product.toJSON(),
    });
  } catch (error) {
    console.error("Error al renderizar el detalle del producto:", error);
    res.status(500).redirect("/products");
  }
};