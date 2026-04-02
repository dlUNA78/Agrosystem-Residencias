import express from 'express';
import hbs from 'express-hbs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

// __dirname no existe en ES Modules — lo reconstruimos
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Rutas MVC
import publicRoutes from './src/routes/publicRoutes.js';

const app  = express();
const PORT = process.env.PORT || 3000;

// Configuración de Handlebars
app.engine('hbs', hbs.express4({
    partialsDir:   path.join(__dirname, 'src/views/partials'),
    layoutsDir:    path.join(__dirname, 'src/views/layouts'),
    defaultLayout: path.join(__dirname, 'src/views/layouts/main.hbs'),
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'src/views'));

// Helpers de Handlebars
hbs.registerHelper('eq', (a, b) => a === b);
hbs.registerHelper('urlEncode', (str) => encodeURIComponent(str));

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- RUTAS ---
app.use('/', publicRoutes);

// Arrancar el servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor AgroSystem encendido en: http://localhost:${PORT}`);
});

export default app;