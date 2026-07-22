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
        const {
            search = "",
            category = "",
            status = ""
        } = req.query;

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
        if (status === "true") {
            where.status = true;
        }

        if (status === "false") {
            where.status = false;
        }

        // CONSULTAR PLAGAS
        const plagues = await db.Plague.findAll({
            where,
            order: [["createdAt", "DESC"]],
            raw: true
        });

        console.log("FILTRO STATUS:", status);
        console.log("PLAGAS ENCONTRADAS:", plagues);

        return res.render("private/plagues", {
            layout: privateLayout,
            pageTitle: "Plagas",
            activePage: "plagues",
            plagues,

            searchId: "plague-search",
            searchPlaceholder:
                "Buscar por nombre, especie o cultivo afectado...",

            searchFilters: [
                {
                    id: "filter-crop",
                    label: "Cultivo:",
                    options: [
                        { value: "maiz", text: "Maíz" },
                        { value: "sorgo", text: "Sorgo" },
                        { value: "mango", text: "Mango" },
                        { value: "limon", text: "Limón" }
                    ]
                },
                {
                    id: "filter-status",
                    label: "Estatus:",
                    options: [
                        { value: "", text: "Todos" },
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

export const suppliersPrivate = async (req, res) => {

    try {

        // =========================================
        // OBTENER FILTROS
        // =========================================

        const {
            search = "",
            supply_type = "",
            status = ""
        } = req.query;

        const { Op } = db.Sequelize;

        // =========================================
        // CONDICIONES DE BÚSQUEDA
        // =========================================

        const where = {};

        // BUSCADOR DE PROVEEDORES
        if (search.trim()) {

            const texto = `%${search.trim()}%`;

            where[Op.or] = [

                // DATOS DE LA EMPRESA
                {
                    name: {
                        [Op.iLike]: texto
                    }
                },

                {
                    commercial_name: {
                        [Op.iLike]: texto
                    }
                },

                {
                    rfc: {
                        [Op.iLike]: texto
                    }
                },

                // DATOS DE CONTACTO
                {
                    contact_name: {
                        [Op.iLike]: texto
                    }
                },

                {
                    contact_position: {
                        [Op.iLike]: texto
                    }
                },

                {
                    email: {
                        [Op.iLike]: texto
                    }
                },

                {
                    phone: {
                        [Op.iLike]: texto
                    }
                },

                // UBICACIÓN
                {
                    address: {
                        [Op.iLike]: texto
                    }
                },

                {
                    city: {
                        [Op.iLike]: texto
                    }
                },

                {
                    state: {
                        [Op.iLike]: texto
                    }
                },

                {
                    postal_code: {
                        [Op.iLike]: texto
                    }
                },

                // INFORMACIÓN DEL SUMINISTRO
                {
                    supplied_products: {
                        [Op.iLike]: texto
                    }
                },

                {
                    brands: {
                        [Op.iLike]: texto
                    }
                }

            ];

        }

        // =========================================
        // FILTRO POR TIPO DE SUMINISTRO
        // =========================================

        if (supply_type) {

            where.supply_type = supply_type;

        }

        // =========================================
        // FILTRO POR ESTATUS
        // =========================================

        if (status) {

            where.status = status;

        }

        // =========================================
        // OBTENER PROVEEDORES
        // =========================================

        const suppliers = await db.Supplier.findAll({

            where,

            order: [
                ["createdAt", "DESC"]
            ],

            raw: true

        });

        // =========================================
        // ESTADÍSTICAS REALES
        // =========================================

        const total = suppliers.length;
        const activos = suppliers.filter(supplier => supplier.status?.toLowerCase() === "activo").length;
        const pendientes = suppliers.filter(supplier => supplier.status?.toLowerCase() === "pendiente").length;
        const inactivos = suppliers.filter(supplier => supplier.status?.toLowerCase() === "inactivo").length;

        // =========================================
        // RENDERIZAR VISTA
        // =========================================

        res.render("private/suppliers", {

            layout: privateLayout,

            pageTitle: "Proveedores",

            activePage: "suppliers",

            suppliers,

            // ESTADÍSTICAS
            stats: { total, activos, pendientes, inactivos },

            // VALORES ACTUALES DE LOS FILTROS
            search, supply_type, status,

            // BARRA DE BÚSQUEDA
            searchId: "supplier-search",
            searchPlaceholder: "Buscar por empresa, contacto o RFC...",
            searchFilters: [
                // FILTRO POR TIPO
                {
                    id: "filter-type",
                    param: "supply_type",
                    label: "Tipo:",
                    options: [
                        {
                            value: "",
                            text: "Todos"
                        },
                        {
                            value: "agroquimicos",
                            text: "Agroquímicos"
                        },
                        {
                            value: "semillas",
                            text: "Semillas"
                        },
                        {
                            value: "equipo",
                            text: "Equipo agrícola"
                        },
                        {
                            value: "fertilizantes",
                            text: "Fertilizantes"
                        },
                        {
                            value: "herramientas",
                            text: "Herramientas"
                        },
                        {
                            value: "servicios",
                            text: "Servicios"
                        },
                        {
                            value: "otros",
                            text: "Otros"
                        }
                    ]
                },
                // FILTRO POR ESTATUS
                {
                    id: "filter-status",
                    param: "status",
                    label: "Estatus:",
                    options: [
                        {
                            value: "",
                            text: "Todos"
                        },
                        {
                            value: "activo",
                            text: "Activo"
                        },
                        {
                            value: "inactivo",
                            text: "Inactivo"
                        },
                        {
                            value: "pendiente",
                            text: "Pendiente"
                        }
                    ]
                }
            ],
            // BOTÓN PRINCIPAL
            ctaLabel: "Añadir Proveedor",
            ctaIcon: "add_business",
            ctaBtnId: "btn-add-supplier",
            showViewToggle: true
        });

    } catch (error) {
        console.error(
            "Error al cargar proveedores:", error
        );

        res.status(500).send(
            "Error al cargar proveedores"
        );
    }
};

// CREAR PROVEEDOR
export const createSupplier = async (req, res) => {
    try {

        await db.Supplier.create({

            // DATOS DE LA EMPRESA
            name: req.body.name?.trim(),
            commercial_name: req.body.commercial_name?.trim(),
            rfc: req.body.rfc?.trim().toUpperCase(),
            supply_type: req.body.supply_type,

            // DATOS DE CONTACTO
            contact_name: req.body.contact_name?.trim(),
            contact_position: req.body.contact_position?.trim(),
            email: req.body.email?.trim(),
            alternative_email: req.body.alternative_email?.trim() || null,
            phone: req.body.phone?.trim(),
            alternative_phone: req.body.alternative_phone?.trim() || null,

            // UBICACIÓN
            address: req.body.address?.trim(),
            city: req.body.city?.trim(),
            state: req.body.state?.trim(),
            postal_code: req.body.postal_code?.trim(),
            country: req.body.country?.trim() || "México",

            // INFORMACIÓN DEL SUMINISTRO
            supplied_products: req.body.supplied_products?.trim(),
            brands: req.body.brands?.trim() || null,
            delivery_time: req.body.delivery_time?.trim() || null,
            minimum_order: req.body.minimum_order || null,

            // INFORMACIÓN COMERCIAL
            payment_method: req.body.payment_method || null,

            // CONTROL
            status: req.body.status || "pendiente"

        });

        return res.redirect("/private/suppliers");

    } catch (error) {

        console.error("Error al crear el proveedor:", error);

        return res.status(500).send("Error al crear el proveedor");
    }
};

// ACTUALIZAR PROVEEDOR
export const updateSupplier = async (req, res) => {

    try {

        const { id } = req.params;

        const supplier = await db.Supplier.findByPk(id);

        if (!supplier) {
            return res.status(404).send("Proveedor no encontrado");
        }


        await supplier.update({

            // DATOS DE LA EMPRESA
            name: req.body.name?.trim(),
            commercial_name: req.body.commercial_name?.trim(),
            rfc: req.body.rfc?.trim().toUpperCase(),
            supply_type: req.body.supply_type,

            // DATOS DE CONTACTO
            contact_name: req.body.contact_name?.trim(),
            contact_position: req.body.contact_position?.trim(),
            email: req.body.email?.trim(),
            alternative_email:
                req.body.alternative_email?.trim() || null,
            phone: req.body.phone?.trim(),
            alternative_phone:
                req.body.alternative_phone?.trim() || null,

            // UBICACIÓN
            address: req.body.address?.trim(),
            city: req.body.city?.trim(),
            state: req.body.state?.trim(),
            postal_code: req.body.postal_code?.trim(),
            country:
                req.body.country?.trim() || "México",

            // INFORMACIÓN DEL SUMINISTRO
            supplied_products:
                req.body.supplied_products?.trim(),

            brands:
                req.body.brands?.trim() || null,

            delivery_time:
                req.body.delivery_time?.trim() || null,

            minimum_order:
                req.body.minimum_order || null,

            // INFORMACIÓN COMERCIAL
            payment_method:
                req.body.payment_method || null,

            // CONTROL
            status:
                req.body.status || "pendiente"

        });


        return res.redirect("/private/suppliers");


    } catch (error) {

        console.error(
            "Error al actualizar el proveedor:",
            error
        );

        return res.status(500).send(
            "Error al actualizar el proveedor"
        );

    }

};

// ELIMINAR PROVEEDOR
export const deleteSupplier = async (req, res) => {

    try {

        const { id } = req.params;

        const supplier = await db.Supplier.findByPk(id);

        if (!supplier) {
            return res.status(404).send("Proveedor no encontrado");
        }

        await supplier.destroy();

        return res.redirect("/private/suppliers");

    } catch (error) {

        console.error("Error al eliminar el proveedor:", error);

        return res.status(500).send("Error al eliminar el proveedor");

    }

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

export const cropsPrivate = async (req, res) => {

    try {

        const {

            search = "",

            category = "",

            status = ""

        } = req.query;


        const { Op } = db.Sequelize;


        const where = {};


        // ==========================================
        // BUSCADOR
        // ==========================================

        if (search.trim()) {

            where[Op.or] = [

                {

                    name: {

                        [Op.iLike]:
                            `%${search.trim()}%`

                    }

                },

                {

                    scientific_name: {

                        [Op.iLike]:
                            `%${search.trim()}%`

                    }

                },

                {

                    category: {

                        [Op.iLike]:
                            `%${search.trim()}%`

                    }

                }

            ];

        }


        // ==========================================
        // FILTRO POR CATEGORÍA
        // ==========================================

        if (category) {

            where.category = category;

        }


        // ==========================================
        // FILTRO POR ESTATUS
        // ==========================================

        if (status) {

            where.status = status;

        }


        // ==========================================
        // OBTENER CULTIVOS + IMÁGENES
        // ==========================================

        const crops = await db.Crop.findAll({

            where,

            include: [

                {

                    model: db.CropImage,

                    as: "images",

                    required: false,

                    separate: true,

                    order: [

                        ["is_primary", "DESC"],

                        ["display_order", "ASC"]

                    ]

                }

            ],

            order: [

                ["createdAt", "DESC"]

            ]

        });


        // ==========================================
        // PREPARAR DATOS PARA LA VISTA
        // ==========================================

        const cropsFormatted = crops.map(

            crop => {

                const cropData =
                    crop.toJSON();


                // Buscar imagen principal
                const primaryImage =
                    cropData.images?.find(

                        image =>
                            image.is_primary === true

                    );


                // Si no hay principal,
                // tomar la primera imagen
                const firstImage =
                    primaryImage ||
                    cropData.images?.[0];


                return {

                    ...cropData,


                    // La vista podrá usar:
                    // {{image_url}}

                    image_url:

                        firstImage
                            ? firstImage.image_url
                            : null,


                    // Conservamos todas
                    // las imágenes también
                    images:
                        cropData.images || []

                };

            }

        );


        console.log(

            "CULTIVOS CARGADOS:",

            cropsFormatted.map(

                crop => ({

                    id:
                        crop.id,

                    name:
                        crop.name,

                    image_url:
                        crop.image_url,

                    images:
                        crop.images

                })

            )

        );


        // ==========================================
        // RENDERIZAR
        // ==========================================

        res.render(

            "private/crops",

            {

                layout:
                    privateLayout,

                pageTitle:
                    "Cultivos",

                activePage:
                    "crops",

                crops:
                    cropsFormatted,


                // ==================================
                // BARRA DE BÚSQUEDA
                // ==================================

                searchId:
                    "crop-search",

                searchPlaceholder:

                    "Buscar por nombre, especie o tipo de cultivo...",


                searchFilters: [

                    {

                        id:
                            "filter-type",

                        param:
                            "category",

                        label:
                            "Tipo:",

                        options: [

                            {
                                value: "",
                                text: "Todos"
                            },

                            {
                                value: "cereal",
                                text: "Cereal"
                            },

                            {
                                value: "frutal",
                                text: "Frutal"
                            },

                            {
                                value: "hortaliza",
                                text: "Hortaliza"
                            },

                            {
                                value: "leguminosa",
                                text: "Leguminosa"
                            },

                            {
                                value: "oleaginosa",
                                text: "Oleaginosa"
                            },

                            {
                                value: "tuberculo",
                                text: "Tubérculo"
                            },

                            {
                                value: "forrajera",
                                text: "Forrajera"
                            },

                            {
                                value: "ornamental",
                                text: "Ornamental"
                            },

                            {
                                value: "industrial",
                                text: "Industrial"
                            },

                            {
                                value: "otro",
                                text: "Otro"
                            }

                        ]

                    },


                    {

                        id:
                            "filter-status",

                        param:
                            "status",

                        label:
                            "Estatus:",

                        options: [

                            {
                                value: "",
                                text: "Todos"
                            },

                            {
                                value: "aprobado",
                                text: "Aprobado"
                            },

                            {
                                value: "pendiente",
                                text: "Pendiente"
                            },

                            {
                                value: "rechazado",
                                text: "Rechazado"
                            }

                        ]

                    }

                ],


                ctaLabel:
                    "Añadir Cultivo",

                ctaIcon:
                    "agriculture",

                ctaBtnId:
                    "btn-add-crop",

                showViewToggle:
                    true

            }

        );


    } catch (error) {

        console.error(

            "Error al cargar los cultivos:",

            error

        );


        res.status(500).send(

            "Error al cargar los cultivos"

        );

    }

};

export const createCrop = async (req, res) => {

    const transaction = await db.sequelize.transaction();

    try {

        const {


            // IDENTIFICACIÓN
            name,
            scientific_name,
            category,
            family,
            genus,
            variety,
            // REGIÓN
            region,
            state,
            min_altitude,
            max_altitude,
            // CLIMA
            climate,
            min_temperature,
            max_temperature,
            min_rainfall,
            max_rainfall,
            humidity,
            // SUELO
            soil_type,
            ph_range,
            drainage,
            organic_matter,
            // CICLO Y PRODUCCIÓN
            season,
            cycle,
            harvest_days,
            average_yield,
            planting_density,
            planting_depth,
            // REQUERIMIENTOS
            water_requirement,
            irrigation_type,
            sunlight_requirement,
            // MANEJO
            nutrients,
            fertilization,
            requires_pruning,
            pollination_type,
            // INFORMACIÓN
            description,
            observations,
            // ESTADO
            status

        } = req.body;
        // CREAR CULTIVO

        const crop = await db.Crop.create({

            name,
            scientific_name,
            category,

            family:
                family || null,

            genus:
                genus || null,

            variety:
                variety || null,


            // REGIÓN
            region,

            state:
                state || null,

            min_altitude:
                min_altitude
                    ? Number(min_altitude)
                    : null,

            max_altitude:
                max_altitude
                    ? Number(max_altitude)
                    : null,

            // CLIMA
            climate:
                climate || null,

            min_temperature:
                min_temperature
                    ? Number(min_temperature)
                    : null,

            max_temperature:
                max_temperature
                    ? Number(max_temperature)
                    : null,

            min_rainfall:
                min_rainfall
                    ? Number(min_rainfall)
                    : null,

            max_rainfall:
                max_rainfall
                    ? Number(max_rainfall)
                    : null,

            humidity:
                humidity || null,

            // SUELO
            soil_type:
                soil_type || null,

            ph_range:
                ph_range || null,

            drainage:
                drainage || null,

            organic_matter:
                organic_matter || null,

            // CICLO
            season:
                season || null,

            cycle:
                cycle || null,

            harvest_days:
                harvest_days
                    ? Number(harvest_days)
                    : null,

            average_yield:
                average_yield || null,

            planting_density:
                planting_density || null,

            planting_depth:
                planting_depth || null,

            // REQUERIMIENTOS
            water_requirement:
                water_requirement || null,

            irrigation_type:
                irrigation_type || null,

            sunlight_requirement:
                sunlight_requirement || null,

            // MANEJO
            nutrients:
                nutrients || null,

            fertilization:
                fertilization || null,

            requires_pruning:

                requires_pruning === "true"
                    ? true
                    : requires_pruning === "false"
                        ? false
                        : null,

            pollination_type:
                pollination_type || null,

            // INFORMACIÓN
            description:
                description || null,

            observations:
                observations || null,

            // ESTADO
            status:
                status || "pendiente"

        }, {
            transaction
        });


        console.log(
            "CULTIVO CREADO:",
            crop.id
        );

        // GUARDAR IMÁGENES

        console.log(
            "ARCHIVOS RECIBIDOS:",
            req.files
        );


        if (
            req.files &&
            req.files.length > 0
        ) {

            const images = req.files.map(
                (file, index) => ({

                    crop_id:
                        crop.id,

                    image_url:
                        `images/crops/${file.filename}`,

                    original_name:
                        file.originalname,

                    is_primary:
                        index === 0,

                    display_order:
                        index,

                    createdAt:
                        new Date(),

                    updatedAt:
                        new Date()

                })
            );

            await db.CropImage.bulkCreate(
                images,
                {
                    transaction
                }
            );

            console.log(
                "IMÁGENES GUARDADAS:",
                images.length
            );

        }

        // CONFIRMAR

        await transaction.commit();
        return res.redirect(
            "/private/crops"
        );


    } catch (error) {

        await transaction.rollback();


        console.error(
            "ERROR AL CREAR CULTIVO:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Error al crear el cultivo",

            error:
                error.message

        });

    }

};

export const updateCrop = async (req, res) => {

    const transaction =
        await db.sequelize.transaction();

    try {

        const { id } = req.params;


        // ==========================================
        // DATOS DEL FORMULARIO
        // ==========================================

        const {

            // IDENTIFICACIÓN
            name,
            scientific_name,
            category,
            family,
            genus,
            variety,

            // REGIÓN
            region,
            state,
            min_altitude,
            max_altitude,

            // CLIMA
            climate,
            min_temperature,
            max_temperature,
            min_rainfall,
            max_rainfall,
            humidity,

            // SUELO
            soil_type,
            ph_range,
            drainage,
            organic_matter,

            // CICLO Y PRODUCCIÓN
            season,
            cycle,
            harvest_days,
            average_yield,
            planting_density,
            planting_depth,

            // REQUERIMIENTOS
            water_requirement,
            irrigation_type,
            sunlight_requirement,

            // MANEJO
            nutrients,
            fertilization,
            requires_pruning,
            pollination_type,

            // INFORMACIÓN
            description,
            observations,

            // ESTADO
            status

        } = req.body;


        // ==========================================
        // BUSCAR CULTIVO
        // ==========================================

        const crop =
            await db.Crop.findByPk(id, {
                transaction
            });


        if (!crop) {

            await transaction.rollback();

            return res.status(404).send(
                "Cultivo no encontrado"
            );

        }


        // ==========================================
        // ACTUALIZAR CULTIVO
        // ==========================================

        await crop.update({

            // IDENTIFICACIÓN
            name,
            scientific_name,
            category,
            family: family || null,
            genus: genus || null,
            variety: variety || null,


            // REGIÓN
            region,
            state: state || null,

            min_altitude:
                min_altitude
                    ? Number(min_altitude)
                    : null,

            max_altitude:
                max_altitude
                    ? Number(max_altitude)
                    : null,


            // CLIMA
            climate: climate || null,

            min_temperature:
                min_temperature
                    ? Number(min_temperature)
                    : null,

            max_temperature:
                max_temperature
                    ? Number(max_temperature)
                    : null,

            min_rainfall:
                min_rainfall
                    ? Number(min_rainfall)
                    : null,

            max_rainfall:
                max_rainfall
                    ? Number(max_rainfall)
                    : null,

            humidity: humidity || null,


            // SUELO
            soil_type: soil_type || null,
            ph_range: ph_range || null,
            drainage: drainage || null,
            organic_matter: organic_matter || null,


            // CICLO Y PRODUCCIÓN
            season: season || null,
            cycle: cycle || null,

            harvest_days:
                harvest_days
                    ? Number(harvest_days)
                    : null,

            average_yield:
                average_yield || null,

            planting_density:
                planting_density || null,

            planting_depth:
                planting_depth || null,


            // REQUERIMIENTOS
            water_requirement:
                water_requirement || null,

            irrigation_type:
                irrigation_type || null,

            sunlight_requirement:
                sunlight_requirement || null,


            // MANEJO
            nutrients:
                nutrients || null,

            fertilization:
                fertilization || null,

            requires_pruning:
                requires_pruning === "true"
                    ? true
                    : requires_pruning === "false"
                        ? false
                        : null,

            pollination_type:
                pollination_type || null,


            // INFORMACIÓN
            description:
                description || null,

            observations:
                observations || null,


            // ESTADO
            status:
                status || "pendiente"


        }, {

            transaction

        });


        console.log(
            "CULTIVO ACTUALIZADO:",
            crop.id
        );


        // ==========================================
        // AGREGAR NUEVAS IMÁGENES
        // ==========================================

        console.log(
            "NUEVAS IMÁGENES:",
            req.files
        );


        if (
            req.files &&
            req.files.length > 0
        ) {


            // Buscar si ya existe una imagen principal
            const existingPrimary =
                await db.CropImage.findOne({

                    where: {

                        crop_id: crop.id,

                        is_primary: true

                    },

                    transaction

                });


            const images =
                req.files.map(
                    (file, index) => ({

                        crop_id:
                            crop.id,

                        image_url:
                            `images/crops/${file.filename}`,

                        original_name:
                            file.originalname,

                        is_primary:
                            !existingPrimary &&
                            index === 0,

                        display_order:
                            index,

                        createdAt:
                            new Date(),

                        updatedAt:
                            new Date()

                    })
                );


            await db.CropImage.bulkCreate(

                images,

                {

                    transaction

                }

            );


            console.log(
                "NUEVAS IMÁGENES GUARDADAS:",
                images.length
            );

        }


        // ==========================================
        // CONFIRMAR
        // ==========================================

        await transaction.commit();


        return res.redirect(
            "/private/crops"
        );


    } catch (error) {


        await transaction.rollback();


        console.error(
            "ERROR AL ACTUALIZAR CULTIVO:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Error al actualizar el cultivo",

            error:
                error.message

        });

    }

};
export const getCropDetail = async (req, res) => {

    try {

        const { id } = req.params;


        const crop = await db.Crop.findByPk(id, {

            include: [

                {

                    model: db.CropImage,

                    as: "images",

                    attributes: [

                        "id",
                        "image_url",
                        "original_name",
                        "is_primary",
                        "display_order"

                    ],

                    order: [

                        ["is_primary", "DESC"],

                        ["display_order", "ASC"]

                    ]

                }

            ]

        });


        if (!crop) {

            return res.status(404).json({

                success: false,

                message:
                    "Cultivo no encontrado"

            });

        }


        return res.json({

            success: true,

            crop

        });


    } catch (error) {

        console.error(

            "ERROR AL OBTENER CULTIVO:",

            error

        );


        return res.status(500).json({

            success: false,

            message:
                "Error al obtener el cultivo"

        });

    }

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

