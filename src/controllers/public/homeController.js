export const renderHomeIndex = (req, res) => {
  const heroImage   = '/img/hero-agrosystem.jpg';
  const certYear    = new Date().getFullYear();
  const currentYear = certYear;

  const stats = [
    { icon: '🐛', value: '1.2k', label: 'Plagas registradas'   },
    { icon: '🌱', value: '450',  label: 'Cultivos documentados' },
    { icon: '🧴', value: '800',  label: 'Productos catalogados' },
    { icon: '👥', value: '3.5k', label: 'Usuarios activos'      },
  ];

  const trends = [
    'Riego por goteo',
    'Control de roya',
    'Fertilizantes orgánicos',
    'Mosca blanca',
  ];

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

  res.render('public/home', {
    pageTitle:    'Inicio',
    activePage:   'home',
    heroImage,
    certYear,
    currentYear,
    stats,
    trends,
    recentThreads,
  });
};