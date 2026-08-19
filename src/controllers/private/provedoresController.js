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

const { Supplier } = db;

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

        res.render("private/admin/suppliers", {

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