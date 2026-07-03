import db from "../../models/index.js";
const { Product } = db;

export const renderProductsPublic = async (req, res) => {
  res.render('public/products', {
    pageTitle:  'Productos',
    activePage: 'products',
  });
};

export const renderProductDetail = async (req, res) => {
  res.render('public/product-detail', {
    pageTitle:  'Detalle Producto',
    activePage: 'products',
  });
};