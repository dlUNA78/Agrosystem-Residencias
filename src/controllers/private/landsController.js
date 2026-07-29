import path from "path";
import { fileURLToPath } from "url";

import db from "../../models/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta absoluta al layout privado
const privateLayout = path.join(__dirname, "../../views/layouts/private");

// ============================================================
// LANDS — Mapa de datos demo por ID (reemplazar con DB real)
// ============================================================
const DEMO_LANDS = {
  1: {
    landName: "La Esperanza",
    landLocation: "Culiacán, Sinaloa",
    landLat: "24.7994",
    landLng: "-107.3877",
    landHectares: "142",
    landId: "#PRD-0041",
  },
  2: {
    landName: "El Progreso",
    landLocation: "Navolato, Sinaloa",
    landLat: "24.7608",
    landLng: "-107.6988",
    landHectares: "280",
    landId: "#PRD-0038",
  },
  3: {
    landName: "Rancho San Miguel",
    landLocation: "Mocorito, Sinaloa",
    landLat: "25.4847",
    landLng: "-107.9606",
    landHectares: "95",
    landId: "#PRD-0035",
  },
  4: {
    landName: "Los Álamos",
    landLocation: "Guasave, Sinaloa",
    landLat: "25.5666",
    landLng: "-108.4697",
    landHectares: "210",
    landId: "#PRD-0049",
  },
};

// ============================================================
// GET /private/lands — Vista principal con datos reales del DB
// REGLA DE SEGURIDAD: Consulta siempre aislada por user_id
// ============================================================
export const renderLandsPrivate = async (req, res) => {
  try {
    // Obtener todas las regiones para poblar el select del formulario
    const regions = await db.Region.findAll({
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
      raw: true,
    });

    // Obtener únicamente los terrenos ACTIVOS del usuario logueado
    const farms = await db.Farm.findAll({
      where: {
        user_id: req.user.id,
        status: true,
      },
      include: [
        {
          model: db.Region,
          as: "region",
          attributes: ["id", "name"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Serializar para pasar a la vista de forma segura
    const farmsData = farms.map((f) => f.toJSON());

    return res.render("private/lands", {
      layout: privateLayout,
      pageTitle: "Mis Terrenos",
      activePage: "lands",

      // Datos
      farms: farmsData,
      regions,
      farmsCount: farmsData.length,

      // Leaflet CSS → se inyecta en el <head> vía el slot extraHead del layout
      extraHead:
        '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />',

      // Leaflet JS + script estático de interactividad
      extraScripts: `
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
        <script src="/js/private/lands.js"></script>
      `,
    });
  } catch (error) {
    console.error("Error al cargar los terrenos:", error);
    return res.status(500).send("Error al cargar los terrenos");
  }
};

// ============================================================
// GET /private/lands/:id/expediente — Detalle de un terreno
// ============================================================
export const landDetail = (req, res) => {
  const land = DEMO_LANDS[req.params.id];
  if (!land) return res.status(404).send("Predio no encontrado");
  res.render("private/land-detail", {
    layout: privateLayout,
    pageTitle: `Expediente — ${land.landName}`,
    activePage: "lands",
    ...land,
  });
};
