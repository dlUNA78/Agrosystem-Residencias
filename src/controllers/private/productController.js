import path from "path";
import { fileURLToPath } from "url";

import db from "../../models/index.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Ruta absoluta al layout privado
const privateLayout = path.join(
    __dirname,
    "../../views/layouts/private"
);

const { Product } = db;

export const productsPrivate = async (req, res) => {
    try {

        const { search = "", category = "" } = req.query;

        const Op = db.Sequelize.Op;

        const where = {};

        // Buscar por nombre, registro o fabricante
        if (search.trim()) {
            where[Op.or] = [
                {
                    name: {
                        [Op.like]: `%${search}%`
                    }
                },
                {
                    registration_code: {
                        [Op.like]: `%${search}%`
                    }
                },
                {
                    manufacturer: {
                        [Op.like]: `%${search}%`
                    }
                }
            ];
        }


        // Filtrar por categoría
        if (category.trim()) {
            where.category = category;
        }
        const products = await db.Product.findAll({
            where,
            raw: true
        });
        const norm = (v) => (v || "").toString().trim().toLowerCase();

        const total = products.length;

        const aprobados = products.filter(
            p => norm(p.validation_status) === "validado").length;
        const pendientes = products.filter(
            p => norm(p.validation_status) === "en revisión").length;
        const restringidos = products.filter(
            p => norm(p.validation_status) === "restringido").length;
        // Productos que vencen en los próximos 60 días
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const limit = new Date(today);
        limit.setDate(limit.getDate() + 60);

        const expiringProducts = products.filter(product => {

            if (!product.expiration_date) return false;

            const expDate = new Date(
                product.expiration_date + "T00:00:00"
            );

            if (isNaN(expDate)) return false;

            expDate.setHours(0, 0, 0, 0);

            return expDate >= today && expDate <= limit;
        });

        const expiringSoon = expiringProducts.length;

        const expiringProductsFormatted = expiringProducts.map(product => {

            return {
                ...product,

                expiration_date_formatted:
                    new Date(product.expiration_date + "T00:00:00")
                        .toLocaleDateString("es-MX", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric"
                        })
            };

        });
        res.render("private/catalog/products", {
            layout: privateLayout, pageTitle: "Productos", activePage: "products",
            // Productos filtrados
            products,

            // Productos próximos a vencer
            expiringProducts: expiringProductsFormatted,

            expiringSoon,

            stats: {
                total, aprobados, pendientes, restringidos
            },

            searchId: "product-search",

            searchPlaceholder: "Buscar por nombre, registro y fabricante....",
            // Mantener valores del filtro
            search, category,
            searchFilters: [
                {
                    id: "filter-category",
                    param: "category",
                    label: "Categoría:",

                    options: [
                        { value: "", text: "Todas" },
                        { value: "Herbicida", text: "Herbicidas" },
                        { value: "Insecticida", text: "Insecticidas" },
                        { value: "Fungicida", text: "Fungicidas" },
                        { value: "Fertilizante", text: "Fertilizantes" },
                        { value: "Acaricida", text: "Acaricidas" },
                        { value: "Bactericida", text: "Bactericidas" },
                        { value: "Coadyuvante", text: "Coadyuvantes" }
                    ]
                }
            ],
            ctaLabel: "Añadir Producto", ctaIcon: "add_circle", ctaBtnId: "btn-add-product", showViewToggle: true,
        });


    } catch (error) {

        console.error(error);

        res.status(500).send("Error al obtener los productos");

    }
};
// Detalle de producto
export const createProduct = async (req, res) => {
    try {

        const image_url = req.file
            ? `images/products/${req.file.filename}`
            : null;

        await db.Product.create({
            name: req.body.name,
            category: req.body.category,
            active_ingredient: req.body.active_ingredient,
            registration_code: req.body.registration_code,
            manufacturer: req.body.manufacturer,
            validation_status: req.body.validation_status,
            expiration_date: req.body.expiration_date || null,
            target_crops: req.body.target_crops,
            description: req.body.description,
            image_url,
            status: req.body.status === "true" || req.body.status === "on"
        });

        return res.redirect("/private/products");

    } catch (error) {
        console.error(error);
        return res.status(500).send("Error al crear producto");
    }
};
// ACTUALIZAR PRODUCTO
export const updateProduct = async (req, res) => {
    try {

        const { id } = req.params;

        const product = await db.Product.findByPk(id);

        if (!product) {
            return res.status(404).send("Producto no encontrado");
        }

        let image_url = product.image_url;

        if (req.file) {
            image_url = `images/products/${req.file.filename}`;
        }

        await product.update({
            name: req.body.name,
            category: req.body.category,
            active_ingredient: req.body.active_ingredient,
            registration_code: req.body.registration_code,
            manufacturer: req.body.manufacturer,
            validation_status: req.body.validation_status,
            expiration_date: req.body.expiration_date || null,
            target_crops: req.body.target_crops,
            description: req.body.description,
            image_url,
            status: req.body.status === "true" || req.body.status === "on"
        });

        res.redirect("/private/products");

    } catch (error) {
        console.error(error);
        res.status(500).send("Error al actualizar producto");
    }
};
// ELIMINAR PRODUCTO
export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        await db.Product.destroy({
            where: { id }
        });

        return res.redirect("/private/products");

    } catch (error) {
        console.error(error);
        return res.status(500).send("Error al eliminar producto");
    }
};

export const getGlyphomaxDetail = (req, res) => {
    res.render('shared/product-detail', {
        layout: privateLayout,
        pageTitle: 'Glyphomax Pro 480 - Productos',
        activePage: 'products',
    });
};
