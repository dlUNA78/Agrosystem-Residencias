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
const { Crop } = db;

export const cropsPrivate = async (req, res) => {
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

        // FILTRO POR CATEGORÍA

        if (category) {

            where.category = category;

        }

        // FILTRO POR ESTATUS

        if (status) {
            where.status = status;
        }

        // OBTENER CULTIVOS + IMÁGENES

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

        // PREPARAR DATOS PARA LA VISTA

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

        // RENDERIZAR

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
                // BARRA DE BÚSQUEDA

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
            name, scientific_name, category, family, genus, variety,
            // REGIÓN
            region, state, min_altitude, max_altitude,
            // CLIMA
            climate, min_temperature, max_temperature, min_rainfall, max_rainfall, humidity,
            // SUELO
            soil_type, ph_range, drainage, organic_matter,
            // CICLO Y PRODUCCIÓN
            season, cycle, harvest_days, average_yield, planting_density, planting_depth,
            // REQUERIMIENTOS
            water_requirement, irrigation_type, sunlight_requirement,
            // MANEJO
            nutrients, fertilization, requires_pruning, pollination_type,
            // INFORMACIÓN
            description, observations,
            // ESTADO
            status

        } = req.body;
        // CREAR CULTIVO

        const crop = await db.Crop.create({

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
            soil_type: soil_type || null,

            ph_range: ph_range || null,

            drainage:
                drainage || null,

            organic_matter: organic_matter || null,

            // CICLO
            season: season || null,

            cycle: cycle || null,

            harvest_days:
                harvest_days
                    ? Number(harvest_days)
                    : null,

            average_yield: average_yield || null,

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

        // DATOS DEL FORMULARIO
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

        // BUSCAR CULTIVO

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

        // ACTUALIZAR CULTIVO

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


        // AGREGAR NUEVAS IMÁGENES

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

        // CONFIRMAR
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
// ELIMINAR CULTIVO
export const deleteCrop = async (req, res) => {
    const transaction =
        await db.sequelize.transaction();
    try {
        const { id } = req.params;

        // BUSCAR CULTIVO
        const crop =
            await db.Crop.findByPk(id, {
                transaction
            });

        // VALIDAR SI EXISTE
        if (!crop) {
            await transaction.rollback();
            return res.redirect(
                "/private/crops"
            );
        }
        // ELIMINAR IMÁGENES RELACIONADAS
        await db.CropImage.destroy({
            where: {
                crop_id: id
            },
            transaction
        });

        // ELIMINAR CULTIVO
        await crop.destroy({
            transaction
        });

        // CONFIRMAR TRANSACCIÓN
        await transaction.commit();

        console.log(
            `CULTIVO ELIMINADO: ${crop.name} (ID: ${id})`
        );

        return res.redirect(
            "/private/crops"
        );

    } catch (error) {
        // DESHACER CAMBIOS
        await transaction.rollback();

        console.error(
            "ERROR AL ELIMINAR CULTIVO:",
            error
        );
        return res.status(500).json({
            success: false,
            message:
                "Error al eliminar el cultivo",
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