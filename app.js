const express = require('express');
const hbs = require('express-hbs');
const path = require('path');
require('dotenv').config();

// Rutas MVC
const publicRoutes = require('./src/routes/publicRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Handlebars
app.engine('hbs', hbs.express4({
    partialsDir:   path.join(__dirname, 'src/views/partials'),
    layoutsDir:    path.join(__dirname, 'src/views/layouts'),
    defaultLayout: path.join(__dirname, 'src/views/layouts/main.hbs')
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'src/views'));

// Helpers de Handlebars
hbs.registerHelper('eq', (a, b) => a === b);
hbs.registerHelper('urlEncode', (str) => encodeURIComponent(str));


// Archivos estáticos (aquí vivirá el CSS de Tailwind)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- RUTAS ---
app.use('/', publicRoutes);



// Arrancar el servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor AgroSystem encendido en: http://localhost:${PORT}`);
});

module.exports = app;