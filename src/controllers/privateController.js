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
