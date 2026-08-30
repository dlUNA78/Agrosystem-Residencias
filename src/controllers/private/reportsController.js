import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta absoluta al layout privado
const privateLayout = path.join(__dirname, '../../views/layouts/private');

export const reportsPrivate = (req, res) => {
  res.render('private/admin/reports', {
    layout: privateLayout,
    pageTitle: 'Reportes y Estadísticas',
    activePage: 'reports',
  });
};
