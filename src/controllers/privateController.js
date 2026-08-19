import path from 'path';
import { fileURLToPath } from 'url';

import db from '../models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta absoluta al layout privado (express-hbs lo requiere cuando no es el defaultLayout)
const privateLayout = path.join(__dirname, '../views/layouts/private');

export const dashboard = (req, res) => {
  res.render('private/dashboard/index', {
    layout: privateLayout,
    pageTitle: 'Dashboard',
    activePage: 'dashboard',
  });
};

export const auditPrivate = (req, res) => {
  res.render('private/admin/audit', {
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

export const landsPrivate = (req, res) => {
  res.render('private/lands/list', {
    layout: privateLayout,
    pageTitle: 'Terrenos',
    activePage: 'lands',
    isAdmin: true, // TODO: reemplazar con req.user.role === 'admin'
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
  1: {
    landName: 'La Esperanza',
    landLocation: 'Culiacán, Sinaloa',
    landLat: '24.7994',
    landLng: '-107.3877',
    landHectares: '142',
    landId: '#PRD-0041',
  },
  2: {
    landName: 'El Progreso',
    landLocation: 'Navolato, Sinaloa',
    landLat: '24.7608',
    landLng: '-107.6988',
    landHectares: '280',
    landId: '#PRD-0038',
  },
  3: {
    landName: 'Rancho San Miguel',
    landLocation: 'Mocorito, Sinaloa',
    landLat: '25.4847',
    landLng: '-107.9606',
    landHectares: '95',
    landId: '#PRD-0035',
  },
  4: {
    landName: 'Los Álamos',
    landLocation: 'Guasave, Sinaloa',
    landLat: '25.5666',
    landLng: '-108.4697',
    landHectares: '210',
    landId: '#PRD-0049',
  },
};

export const landDetail = (req, res) => {
  const land = DEMO_LANDS[req.params.id];
  if (!land) return res.status(404).send('Predio no encontrado');
  res.render('private/lands/detail', {
    layout: privateLayout,
    pageTitle: `Expediente — ${land.landName}`,
    activePage: 'lands',
    ...land,
  });
};

export const reportsPrivate = (req, res) => {
  res.render('private/admin/reports', {
    layout: privateLayout,
    pageTitle: 'Reportes y Estadísticas',
    activePage: 'reports',
  });
};

export const ingredientsPrivate = (req, res) => {
  res.render('private/catalog/ingredients', {
    layout: privateLayout,
    pageTitle: 'Ingredientes Activos',
    activePage: 'ingredients',
    searchId: 'ingredient-search',
    searchPlaceholder:
      'Buscar por nombre, grupo químico o mecanismo de acción...',
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
  res.render('private/admin/users', {
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
