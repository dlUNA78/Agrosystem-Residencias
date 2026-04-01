'use strict';

/**
 * Controlador para la página de inicio pública (home-public.hbs).
 * Aquí se preparan todos los datos que la vista necesita renderizar.
 */

const homeIndex = (req, res) => {
    // Datos para la sección Hero
    const heroImage = '/img/hero-agrosystem.jpg';
    const certYear  = new Date().getFullYear();

    // Estadísticas de la plataforma
    const stats = [
        { icon: '🐛', value: '1.2k', label: 'Plagas registradas'     },
        { icon: '🌱', value: '450',  label: 'Cultivos documentados'   },
        { icon: '🧴', value: '800',  label: 'Productos catalogados'   },
        { icon: '👥', value: '3.5k', label: 'Usuarios activos'        },
    ];

    // Tendencias de búsqueda
    const trends = [
        'Riego por goteo',
        'Control de roya',
        'Fertilizantes orgánicos',
        'Mosca blanca',
    ];

    // Últimas conversaciones del foro (en producción vendrían de la BD)
    const recentThreads = [
        {
            slug:    'como-combatir-la-mosca-blanca',
            title:   '¿Cómo combatir la mosca blanca en tomate?',
            author:  'Carlos M.',
            timeAgo: '2 horas',
            replies: 8,
            views:   142,
        },
        {
            slug:    'mejores-fertilizantes-maiz-2024',
            title:   'Mejores fertilizantes para maíz en temporal 2024',
            author:  'Ana R.',
            timeAgo: '5 horas',
            replies: 12,
            views:   230,
        },
        {
            slug:    'control-biologico-pulgon',
            title:   'Experiencias con control biológico contra el pulgón',
            author:  'Miguel T.',
            timeAgo: '1 día',
            replies: 5,
            views:   98,
        },
    ];

    // Renderizar la vista pasando todos los datos
    res.render('public/home-public', {
        layout:        'main',
        pageTitle:     'Inicio',
        activePage:    'home',
        heroImage,
        certYear,
        currentYear:   new Date().getFullYear(),
        stats,
        trends,
        recentThreads,
    });
};

module.exports = { homeIndex };
