import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Ruta absoluta al layout privado (express-hbs lo requiere cuando no es el defaultLayout)
const privateLayout = path.join(__dirname, '../views/layouts/private');

export const dashboard = (req, res) => {
    res.render('private/dashboard', {
        layout:      privateLayout,
        pageTitle:   'Dashboard',
        activePage:  'dashboard',
    });
};

export const plaguesPrivate = (req, res) => {
    res.render('private/plagues', {
        layout:      privateLayout,
        pageTitle:   'Plagas',
        activePage:  'plagues',
    });
};

export const cropsPrivate = (req, res) => {
    res.render('private/crops', {
        layout:      privateLayout,
        pageTitle:   'Cultivos',
        activePage:  'crops',
    });
};

export const landsPrivate = (req, res) => {
    res.render('private/lands', {
        layout:      privateLayout,
        pageTitle:   'Terrenos',
        activePage:  'lands',
        isAdmin:     true,   // TODO: reemplazar con req.user.role === 'admin'
    });
};

// Mapa de datos de prueba por ID (en producción vendrá de la DB)
const DEMO_LANDS = {
    '1': { landName: 'La Esperanza',     landLocation: 'Culiacán, Sinaloa',  landLat: '24.7994', landLng: '-107.3877', landHectares: '142', landId: '#PRD-0041' },
    '2': { landName: 'El Progreso',      landLocation: 'Navolato, Sinaloa',  landLat: '24.7608', landLng: '-107.6988', landHectares: '280', landId: '#PRD-0038' },
    '3': { landName: 'Rancho San Miguel',landLocation: 'Mocorito, Sinaloa',  landLat: '25.4847', landLng: '-107.9606', landHectares: '95',  landId: '#PRD-0035' },
    '4': { landName: 'Los Álamos',       landLocation: 'Guasave, Sinaloa',   landLat: '25.5666', landLng: '-108.4697', landHectares: '210', landId: '#PRD-0049' },
};

export const landDetail = (req, res) => {
    const land = DEMO_LANDS[req.params.id];
    if (!land) return res.status(404).send('Predio no encontrado');
    res.render('private/land-detail', {
        layout:     privateLayout,
        pageTitle:  `Expediente — ${land.landName}`,
        activePage: 'lands',
        ...land,
    });
};
