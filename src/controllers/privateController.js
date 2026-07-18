import path from 'path';
import { fileURLToPath } from 'url';

import db from "../models/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta absoluta al layout privado (express-hbs lo requiere cuando no es el defaultLayout)
const privateLayout = path.join(__dirname, '../views/layouts/private');

export const dashboard = (req, res) => {
    res.render('private/dashboard', {
        layout: privateLayout,
        pageTitle: 'Dashboard',
        activePage: 'dashboard',
    });
};

export const plaguesPrivate = async (req, res) => {
    try {
        const { search = "", category = "", status = "" } = req.query;

        const { Op } = db.Sequelize;

        const where = {};

        // BUSCADOR
        if (search.trim()) {
            where[Op.or] = [
                {
                    name: {
                        [Op.iLike]: `%${search.trim()}%`
                    }
                },
                {
                    scientific_name: {
                        [Op.iLike]: `%${search.trim()}%`
                    }
                },
                {
                    region: {
                        [Op.iLike]: `%${search.trim()}%`
                    }
                }
            ];
        }

        // FILTRO POR CATEGORÍA
        if (category.trim()) {
            where.category = category;
        }

        // FILTRO POR ESTATUS
        if (status.trim()) {
            where.status = status === "true";
        }

        // CONSULTAR PLAGAS DE LA BASE DE DATOS
        const plagues = await db.Plague.findAll({
            where,
            order: [["createdAt", "DESC"]],
            raw: true
        });

        console.log("PLAGAS ENCONTRADAS:", plagues);

        return res.render("private/plagues", {
            layout: privateLayout,
            pageTitle: "Plagas",
            activePage: "plagues",

            // IMPORTANTE: esto es lo que usará tu vista
            plagues,

            searchId: "plague-search",
            searchPlaceholder:
                "Buscar por nombre, especie o cultivo afectado...",

            searchFilters: [
                {
                    id: "filter-crop",
                    label: "Cultivo: Todos",
                    options: [
                        { value: "maiz", text: "Maíz" },
                        { value: "sorgo", text: "Sorgo" },
                        { value: "mango", text: "Mango" },
                        { value: "limon", text: "Limón" }
                    ]
                },
                {
                    id: "filter-status",
                    label: "Estatus: Todos",
                    options: [
                        { value: "true", text: "Activo" },
                        { value: "false", text: "Inactivo" }
                    ]
                }
            ],

            ctaLabel: "Añadir Plaga",
            ctaIcon: "bug_report",
            ctaBtnId: "btn-add-plague",
            showViewToggle: true
        });

    } catch (error) {
        console.error("Error al cargar las plagas:", error);

        return res.status(500).send("Error al cargar las plagas");
    }
};

export const suppliersPrivate = (req, res) => {
    res.render('private/suppliers', {
        layout: privateLayout,
        pageTitle: 'Proveedores',
        activePage: 'suppliers',
        searchId: 'supplier-search',
        searchPlaceholder: 'Buscar por empresa, contacto o RFC...',
        searchFilters: [
            {
                id: 'filter-type',
                label: 'Tipo: Todos',
                options: [
                    { value: 'agroquimicos', text: 'Agroquímicos' },
                    { value: 'semillas', text: 'Semillas' },
                    { value: 'equipo', text: 'Equipo' },
                    { value: 'servicios', text: 'Servicios' },
                ],
            },
            {
                id: 'filter-status',
                label: 'Estatus: Todos',
                options: [
                    { value: 'activo', text: 'Activo' },
                    { value: 'inactivo', text: 'Inactivo' },
                    { value: 'pendiente', text: 'Pendiente' },
                ],
            },
        ],
        ctaLabel: 'Añadir Proveedor',
        ctaIcon: 'add_business',
        ctaBtnId: 'btn-add-supplier',
        showViewToggle: true,
    });
};

export const auditPrivate = (req, res) => {
    res.render('private/audit', {
        layout: privateLayout,
        pageTitle: 'Auditoría',
        activePage: 'audit',
        searchId: 'audit-search',
        searchPlaceholder: 'Buscar por usuario, acción o detalles...',
        searchFilters: [
            {
                id: 'filter-module',
                label: 'Módulo: Todos',
                options: [
                    { value: 'plagas', text: 'Plagas' },
                    { value: 'cultivos', text: 'Cultivos' },
                    { value: 'productos', text: 'Productos' },
                    { value: 'usuarios', text: 'Usuarios' },
                    { value: 'proveedores', text: 'Proveedores' },
                ],
            },
            {
                id: 'filter-action',
                label: 'Acción: Todas',
                options: [
                    { value: 'crear', text: 'Creación' },
                    { value: 'editar', text: 'Edición' },
                    { value: 'eliminar', text: 'Eliminación' },
                    { value: 'aprobar', text: 'Aprobación' },
                ],
            },
        ],
        ctaLabel: 'Exportar Log',
        ctaIcon: 'download',
        ctaBtnId: 'btn-export-audit',
        showViewToggle: true,
    });
};

export const cropsPrivate = (req, res) => {
    res.render('private/crops', {
        layout: privateLayout,
        pageTitle: 'Cultivos',
        activePage: 'crops',
        searchId: 'crop-search',
        searchPlaceholder: 'Buscar por nombre, especie o tipo de cultivo...',
        searchFilters: [
            {
                id: 'filter-type',
                label: 'Tipo: Todos',
                options: [
                    { value: 'cereal', text: 'Cereal' },
                    { value: 'frutal', text: 'Frutal' },
                    { value: 'hortaliza', text: 'Hortaliza' },
                    { value: 'leguminosa', text: 'Leguminosa' },
                ],
            },
            {
                id: 'filter-status',
                label: 'Estatus: Todos',
                options: [
                    { value: 'aprobado', text: 'Aprobado' },
                    { value: 'pendiente', text: 'Pendiente' },
                ],
            },
        ],
        ctaLabel: 'Añadir Cultivo',
        ctaIcon: 'agriculture',
        ctaBtnId: 'btn-add-crop',
        showViewToggle: true,
    });
};

export const landsPrivate = (req, res) => {
    res.render('private/lands', {
        layout: privateLayout,
        pageTitle: 'Terrenos',
        activePage: 'lands',
        isAdmin: true,   // TODO: reemplazar con req.user.role === 'admin'
        searchId: 'land-search',
        searchPlaceholder: 'Buscar predio o propietario...',
        searchFilters: [
            {
                id: 'land-filter-status',
                label: 'Estatus: Todos',
                options: [
                    { value: 'activo', text: 'Activo' },
                    { value: 'pendiente', text: 'Pendiente' },
                    { value: 'inactivo', text: 'Inactivo' },
                ],
            },
            {
                id: 'land-filter-health',
                label: 'Salud: Todos',
                options: [
                    { value: 'sano', text: '🟢 Sano' },
                    { value: 'alerta', text: '🔴 Plaga activa' },
                ],
            },
        ],
        ctaLabel: '+ Registrar Nuevo Predio',
        ctaIcon: 'add_location_alt',
        ctaBtnId: 'btn-open-new-land',
        showViewToggle: true,
    });
};

// Mapa de datos de prueba por ID (en producción vendrá de la DB)
const DEMO_LANDS = {
    '1': { landName: 'La Esperanza', landLocation: 'Culiacán, Sinaloa', landLat: '24.7994', landLng: '-107.3877', landHectares: '142', landId: '#PRD-0041' },
    '2': { landName: 'El Progreso', landLocation: 'Navolato, Sinaloa', landLat: '24.7608', landLng: '-107.6988', landHectares: '280', landId: '#PRD-0038' },
    '3': { landName: 'Rancho San Miguel', landLocation: 'Mocorito, Sinaloa', landLat: '25.4847', landLng: '-107.9606', landHectares: '95', landId: '#PRD-0035' },
    '4': { landName: 'Los Álamos', landLocation: 'Guasave, Sinaloa', landLat: '25.5666', landLng: '-108.4697', landHectares: '210', landId: '#PRD-0049' },
};

export const landDetail = (req, res) => {
    const land = DEMO_LANDS[req.params.id];
    if (!land) return res.status(404).send('Predio no encontrado');
    res.render('private/land-detail', {
        layout: privateLayout,
        pageTitle: `Expediente — ${land.landName}`,
        activePage: 'lands',
        ...land,
    });
};

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
        res.render("private/products", {
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

                    label: "Categoría: Todas",

                    options: [
                        { value: "herbicida", text: "Herbicidas" },
                        { value: "insecticida", text: "Insecticidas" },
                        { value: "fungicida", text: "Fungicidas" },
                        { value: "fertilizante", text: "Fertilizantes" },
                        { value: "acaricida", text: "Acaricidas" },
                        { value: "bactericida", text: "Bactericidas" },
                        { value: "coadyuvante", text: "Coadyuvantes" },
                    ],
                },
            ],
            ctaLabel: "Añadir Producto", ctaIcon: "add_circle", ctaBtnId: "btn-add-product", showViewToggle: true,
        });


    } catch (error) {

        console.error(error);

        res.status(500).send("Error al obtener los productos");

    }
};

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

// CREAR PLAGA
export const createPlague = async (req, res) => {
    try {
        const image_url = req.file
            ? `images/plagues/${req.file.filename}`
            : null;

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
            image_url,

            // Si el checkbox está marcado, será true
            status:
                req.body.status === "true" ||
                req.body.status === "on" ||
                req.body.status === true
        });

        return res.redirect("/private/plagues");

    } catch (error) {
        console.error("Error al crear la plaga:", error);
        return res.status(500).send("Error al crear la plaga");
    }
};


// ACTUALIZAR PLAGA
export const updatePlague = async (req, res) => {
    try {
        const { id } = req.params;

        const plague = await db.Plague.findByPk(id);

        if (!plague) {
            return res.status(404).send("Plaga no encontrada");
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

            status:
                req.body.status === "true" ||
                req.body.status === "on" ||
                req.body.status === true
        };

        // Solo reemplaza la imagen si se seleccionó una nueva
        if (req.file) {
            data.image_url = `images/plagues/${req.file.filename}`;
        }

        await plague.update(data);

        return res.redirect("/private/plagues");

    } catch (error) {
        console.error("Error al actualizar la plaga:", error);
        return res.status(500).send("Error al actualizar la plaga");
    }
};


// ELIMINAR PLAGA
export const deletePlague = async (req, res) => {
    try {
        const { id } = req.params;

        const plague = await db.Plague.findByPk(id);

        if (!plague) {
            return res.status(404).send("Plaga no encontrada");
        }

        await plague.destroy();

        return res.redirect("/private/plagues");

    } catch (error) {
        console.error("Error al eliminar la plaga:", error);
        return res.status(500).send("Error al eliminar la plaga");
    }
};

export const reportsPrivate = (req, res) => {
    res.render('private/reports', {
        layout: privateLayout,
        pageTitle: 'Reportes y Estadísticas',
        activePage: 'reports',
    });
};

export const ingredientsPrivate = (req, res) => {
    res.render('private/ingredients', {
        layout: privateLayout,
        pageTitle: 'Ingredientes Activos',
        activePage: 'ingredients',
        searchId: 'ingredient-search',
        searchPlaceholder: 'Buscar por nombre, grupo químico o mecanismo de acción...',
        searchFilters: [
            {
                id: 'filter-tipo',
                label: 'Tipo: Todos',
                options: [
                    { value: 'herbicida', text: 'Herbicida' },
                    { value: 'insecticida', text: 'Insecticida' },
                    { value: 'fungicida', text: 'Fungicida' },
                    { value: 'acaricida', text: 'Acaricida' },
                    { value: 'nematicida', text: 'Nematicida' },
                    { value: 'bactericida', text: 'Bactericida' },
                ],
            },
            {
                id: 'filter-toxicidad',
                label: 'Toxicidad OMS: Todas',
                options: [
                    { value: 'clase-i', text: 'Clase I — Extremadamente tóxico' },
                    { value: 'clase-ii', text: 'Clase II — Altamente tóxico' },
                    { value: 'clase-iii', text: 'Clase III — Moderadamente tóxico' },
                    { value: 'clase-iv', text: 'Clase IV — Ligeramente tóxico' },
                ],
            },
            {
                id: 'filter-status',
                label: 'Estatus: Todos',
                options: [
                    { value: 'aprobado', text: 'Aprobado' },
                    { value: 'pendiente', text: 'Pendiente' },
                    { value: 'restringido', text: 'Restringido' },
                ],
            },
        ],
        ctaLabel: 'Añadir Ingrediente',
        ctaIcon: 'science',
        ctaBtnId: 'btn-add-ingredient',
        showViewToggle: true,
    });
};

export const usersPrivate = (req, res) => {
    res.render('private/users', {
        layout: privateLayout,
        pageTitle: 'Usuarios',
        activePage: 'users',
        searchId: 'user-search',
        searchPlaceholder: 'Buscar por nombre, correo o institución...',
        searchFilters: [
            {
                id: 'filter-rol',
                label: 'Rol: Todos',
                options: [
                    { value: 'admin', text: 'Admin' },
                    { value: 'investigador', text: 'Investigador' },
                    { value: 'tecnico', text: 'Técnico' },
                    { value: 'agricultor', text: 'Agricultor' },
                ],
            },
            {
                id: 'filter-status',
                label: 'Estatus: Todos',
                options: [
                    { value: 'activo', text: 'Activo' },
                    { value: 'pendiente', text: 'Pendiente' },
                    { value: 'suspendido', text: 'Suspendido' },
                ],
            },
        ],
        ctaLabel: 'Añadir Usuario',
        ctaIcon: 'person_add',
        ctaBtnId: 'btn-add-user',
        showViewToggle: true,
    });
};

export const getPestDetail = (req, res) => {
    res.render('private/pest-detail', {
        layout: privateLayout,
        pageTitle: 'Pulgón Verde - Plagas',
        activePage: 'plagues',
    });
};

export const getGlyphomaxDetail = (req, res) => {
    res.render('private/product-detail', {
        layout: privateLayout,
        pageTitle: 'Glyphomax Pro 480 - Productos',
        activePage: 'products',
    });
};

export const getCropDetail = (req, res) => {
    res.render('private/crop-detail', {
        layout: privateLayout,
        pageTitle: 'Maíz - Cultivos',
        activePage: 'crops',
    });
};
