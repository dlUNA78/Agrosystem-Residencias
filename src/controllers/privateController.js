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
        searchId:          'plague-search',
        searchPlaceholder: 'Buscar por nombre, especie o cultivo afectado...',
        searchFilters: [
            {
                id: 'filter-crop',
                label: 'Cultivo: Todos',
                options: [
                    { value: 'maiz',  text: 'Maíz'  },
                    { value: 'sorgo', text: 'Sorgo'  },
                    { value: 'mango', text: 'Mango'  },
                    { value: 'limon', text: 'Limón'  },
                ],
            },
            {
                id: 'filter-status',
                label: 'Estatus: Todos',
                options: [
                    { value: 'aprobado',  text: 'Aprobado'  },
                    { value: 'pendiente', text: 'Pendiente' },
                ],
            },
        ],
        ctaLabel:   'Añadir Plaga',
        ctaIcon:    'bug_report',
        ctaBtnId:   'btn-add-plague',
        showViewToggle: false,
    });
};

export const cropsPrivate = (req, res) => {
    res.render('private/crops', {
        layout:      privateLayout,
        pageTitle:   'Cultivos',
        activePage:  'crops',
        searchId:          'crop-search',
        searchPlaceholder: 'Buscar por nombre, especie o tipo de cultivo...',
        searchFilters: [
            {
                id: 'filter-type',
                label: 'Tipo: Todos',
                options: [
                    { value: 'cereal',     text: 'Cereal'     },
                    { value: 'frutal',     text: 'Frutal'     },
                    { value: 'hortaliza',  text: 'Hortaliza'  },
                    { value: 'leguminosa', text: 'Leguminosa' },
                ],
            },
            {
                id: 'filter-status',
                label: 'Estatus: Todos',
                options: [
                    { value: 'aprobado',  text: 'Aprobado'  },
                    { value: 'pendiente', text: 'Pendiente' },
                ],
            },
        ],
        ctaLabel:   'Añadir Cultivo',
        ctaIcon:    'agriculture',
        ctaBtnId:   'btn-add-crop',
        showViewToggle: false,
    });
};

export const landsPrivate = (req, res) => {
    res.render('private/lands', {
        layout:      privateLayout,
        pageTitle:   'Terrenos',
        activePage:  'lands',
        isAdmin:     true,   // TODO: reemplazar con req.user.role === 'admin'
        searchId:          'land-search',
        searchPlaceholder: 'Buscar predio o propietario...',
        searchFilters: [
            {
                id: 'land-filter-status',
                label: 'Estatus: Todos',
                options: [
                    { value: 'activo',    text: 'Activo'    },
                    { value: 'pendiente', text: 'Pendiente' },
                    { value: 'inactivo',  text: 'Inactivo'  },
                ],
            },
            {
                id: 'land-filter-health',
                label: 'Salud: Todos',
                options: [
                    { value: 'sano',   text: '🟢 Sano'        },
                    { value: 'alerta', text: '🔴 Plaga activa' },
                ],
            },
        ],
        ctaLabel:   '+ Registrar Nuevo Predio',
        ctaIcon:    'add_location_alt',
        ctaBtnId:   'btn-open-new-land',
        showViewToggle: false,
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

export const productsPrivate = (req, res) => {
    res.render('private/products', {
        layout:      privateLayout,
        pageTitle:   'Productos',
        activePage:  'products',
        searchId:          'product-search',
        searchPlaceholder: 'Buscar por nombre, principio activo o ID...',
        searchFilters: [
            {
                id: 'filter-category',
                label: 'Categoría: Todas',
                options: [
                    { value: 'herbicida',    text: 'Herbicidas'    },
                    { value: 'insecticida',  text: 'Insecticidas'  },
                    { value: 'fungicida',    text: 'Fungicidas'    },
                    { value: 'fertilizante', text: 'Fertilizantes' },
                    { value: 'acaricida',    text: 'Acaricidas'    },
                    { value: 'coadyuvante',  text: 'Coadyuvantes'  },
                    { value: 'bactericida',  text: 'Bactericidas'  },
                ],
            },
            {
                id: 'filter-status',
                label: 'Estatus: Todos',
                options: [
                    { value: 'aprobado',    text: 'Aprobado'    },
                    { value: 'pendiente',   text: 'Pendiente'   },
                    { value: 'restringido', text: 'Restringido' },
                ],
            },
            {
                id: 'filter-manufacturer',
                label: 'Fabricante: Todos',
                options: [
                    { value: 'agroscience', text: 'AgroScience Labs'  },
                    { value: 'biocrop',     text: 'BioCrop Solutions' },
                    { value: 'terrachem',   text: 'TerraChem'         },
                    { value: 'naturagro',   text: 'NaturAgro MX'      },
                ],
            },
        ],
        ctaLabel:   'Añadir Producto',
        ctaIcon:    'add_circle',
        ctaBtnId:   'btn-add-product',
        showViewToggle: true,
    });
};

export const usersPrivate = (req, res) => {
    res.render('private/users', {
        layout:      privateLayout,
        pageTitle:   'Usuarios',
        activePage:  'users',
        searchId:          'user-search',
        searchPlaceholder: 'Buscar por nombre, correo o institución...',
        searchFilters: [
            {
                id: 'filter-rol',
                label: 'Rol: Todos',
                options: [
                    { value: 'admin',         text: 'Admin'         },
                    { value: 'investigador',  text: 'Investigador'  },
                    { value: 'tecnico',       text: 'Técnico'       },
                    { value: 'agricultor',    text: 'Agricultor'    },
                ],
            },
            {
                id: 'filter-status',
                label: 'Estatus: Todos',
                options: [
                    { value: 'activo',     text: 'Activo'     },
                    { value: 'pendiente',  text: 'Pendiente'  },
                    { value: 'suspendido', text: 'Suspendido' },
                ],
            },
        ],
        ctaLabel:   'Añadir Usuario',
        ctaIcon:    'person_add',
        ctaBtnId:   'btn-add-user',
        showViewToggle: false,
    });
};
