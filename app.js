import express from 'express';
import hbs from 'express-hbs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

// Importar la instancia de Sequelize
import sequelize from './src/config/database.js';

// __dirname no existe en ES Modules — lo reconstruimos
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Rutas MVC
import publicRoutes  from './src/routes/publicRoutes.js';
import privateRoutes from './src/routes/privateRoutes.js';

const app  = express();
const PORT = process.env.PORT || 3000;

// Configuración de Handlebars
app.engine('hbs', hbs.express4({
    extname:       '.hbs',
    layoutsDir:    path.join(__dirname, 'src/views/layouts'),
    defaultLayout: path.join(__dirname, 'src/views/layouts/public'),
    partialsDir:   path.join(__dirname, 'src/views/partials'),
}));

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'src/views'));

// Registrar helpers explícitamente (express-hbs ignora la opción helpers en express4)
hbs.registerHelper('eq',        (a, b) => a === b);
hbs.registerHelper('urlEncode', (str)  => encodeURIComponent(str));

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- RUTAS ---
app.use('/', publicRoutes);
app.use('/', privateRoutes);   // /dashboard, etc.

// Probar la conexión a la base de datos y arrancar el servidor
try {
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos PostgreSQL establecida exitosamente.');

    app.listen(PORT, () => {
        console.log(`✅ Servidor AgroSystem encendido en: http://localhost:${PORT}`);
    });
} catch (error) {
    console.error('❌ Error al conectar con la base de datos PostgreSQL:', error);
    process.exit(1); // Detiene el proceso si no hay base de datos como se solicitó
}

export default app;