import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta absoluta al layout privado
const privateLayout = path.join(__dirname, '../../views/layouts/private');

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
