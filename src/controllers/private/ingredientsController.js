import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta absoluta al layout privado
const privateLayout = path.join(__dirname, '../../views/layouts/private');

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
