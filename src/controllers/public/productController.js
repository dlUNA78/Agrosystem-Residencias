import db from "../../models/index.js";
const { Product, Plague, Crop } = db;

export const renderProductsPublic = async (req, res) => {
  try {
    const products = await Product.findAll({
      where: { status: true },
      order: [["name", "ASC"]],
    });

    res.render("public/products", {
      pageTitle: "Catálogo de Agroquímicos y Productos",
      activePage: "products",
      products,
      totalCount: products.length,
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
      return res.status(404).render("shared/crop-detail", {
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