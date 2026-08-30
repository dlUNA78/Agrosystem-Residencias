import {
  getStatePaths,
  MAP_WIDTH,
  MAP_HEIGHT,
} from '../../services/mexicoGeo.js';

export const renderHomeIndex = (req, res) => {
  const lastUpdate = '22.08.2026 · 06:00 H (CDMX)';

  const heroStats = {
    verifiedRecords: '2,490',
    coverageEntities: '32',
    experimentalFields: '11',
  };

  const frequentSearches = [
    'Gusano cogollero en maíz',
    'HLB en cítricos',
    'Umbral económico de pulgón amarillo',
    'Riego por goteo en aguacate',
  ];

  // Diccionario de alertas fitosanitarias por entidad federativa
  const estadosData = {
    Sinaloa: {
      alertas: 41,
      nivel: 'alta',
      cultivo: 'Maíz',
      principal: 'Spodoptera frugiperda',
      comun: 'Gusano cogollero',
      fillColor: 'var(--level-4)',
    },
    Michoacán: {
      alertas: 38,
      nivel: 'alta',
      cultivo: 'Aguacate',
      principal: 'Scirtothrips perseae',
      comun: 'Trips del aguacate',
      fillColor: 'var(--level-4)',
    },
    Veracruz: {
      alertas: 35,
      nivel: 'alta',
      cultivo: 'Plátano',
      principal: 'Fusarium oxysporum R4T',
      comun: 'Marchitez del plátano',
      fillColor: 'var(--level-4)',
    },
    Jalisco: {
      alertas: 31,
      nivel: 'alta',
      cultivo: 'Agave',
      principal: 'Scyphophorus acupunctatus',
      comun: 'Picudo del agave',
      fillColor: 'var(--level-4)',
    },
    Sonora: {
      alertas: 28,
      nivel: 'media',
      cultivo: 'Trigo',
      principal: 'Tilletia indica',
      comun: 'Carbón parcial del trigo',
      fillColor: 'var(--level-3)',
    },
    Chiapas: {
      alertas: 26,
      nivel: 'media',
      cultivo: 'Café',
      principal: 'Hemileia vastatrix',
      comun: 'Roya del cafeto',
      fillColor: 'var(--level-3)',
    },
    Tamaulipas: {
      alertas: 22,
      nivel: 'media',
      cultivo: 'Cítricos',
      principal: 'Diaphorina citri',
      comun: 'Psílido asiático - HLB',
      fillColor: 'var(--level-3)',
    },
    Guanajuato: {
      alertas: 19,
      nivel: 'media',
      cultivo: 'Sorgo',
      principal: 'Melanaphis sacchari',
      comun: 'Pulgón amarillo',
      fillColor: 'var(--level-3)',
    },
    'Baja California': {
      alertas: 16,
      nivel: 'media',
      cultivo: 'Hortalizas',
      principal: 'Thrips parvispinus',
      comun: 'Trips oriental',
      fillColor: 'var(--level-2)',
    },
    Oaxaca: {
      alertas: 14,
      nivel: 'baja',
      cultivo: 'Frijol',
      principal: 'Schistocerca piceifrons',
      comun: 'Langosta centroamericana',
      fillColor: 'var(--level-2)',
    },
    Puebla: {
      alertas: 12,
      nivel: 'baja',
      cultivo: 'Hortalizas',
      principal: 'Bactericera cockerelli',
      comun: 'Paratrioza',
      fillColor: 'var(--level-2)',
    },
    'San Luis Potosí': {
      alertas: 11,
      nivel: 'baja',
      cultivo: 'Cítricos',
      principal: 'Diaphorina citri',
      comun: 'HLB',
      fillColor: 'var(--level-2)',
    },
    Chihuahua: {
      alertas: 9,
      nivel: 'baja',
      cultivo: 'Manzana',
      principal: 'Cydia pomonella',
      comun: 'Palomilla de la manzana',
      fillColor: 'var(--level-1)',
    },
    'Nuevo León': {
      alertas: 8,
      nivel: 'baja',
      cultivo: 'Cítricos',
      principal: 'Anastrepha ludens',
      comun: 'Mosca de la fruta',
      fillColor: 'var(--level-1)',
    },
    Zacatecas: {
      alertas: 7,
      nivel: 'baja',
      cultivo: 'Frijol',
      principal: 'Aphis glycines',
      comun: 'Pulgón',
      fillColor: 'var(--level-1)',
    },
    Durango: {
      alertas: 6,
      nivel: 'baja',
      cultivo: 'Algodón',
      principal: 'Anthonomus grandis',
      comun: 'Picudo del algodonero',
      fillColor: 'var(--level-1)',
    },
    Guerrero: {
      alertas: 5,
      nivel: 'baja',
      cultivo: 'Mango',
      principal: 'Anastrepha obliqua',
      comun: 'Mosca de la fruta',
      fillColor: 'var(--level-1)',
    },
    Nayarit: {
      alertas: 5,
      nivel: 'baja',
      cultivo: 'Mango',
      principal: 'Anastrepha striata',
      comun: 'Mosca de la guayaba',
      fillColor: 'var(--level-1)',
    },
    Tabasco: {
      alertas: 4,
      nivel: 'baja',
      cultivo: 'Cacao',
      principal: 'Moniliophthora roreri',
      comun: 'Moniliasis',
      fillColor: 'var(--level-1)',
    },
    Yucatán: {
      alertas: 3,
      nivel: 'baja',
      cultivo: 'Cítricos',
      principal: 'Diaphorina citri',
      comun: 'Psílido asiático',
      fillColor: 'var(--level-1)',
    },
    Campeche: {
      alertas: 3,
      nivel: 'baja',
      cultivo: 'Maíz',
      principal: 'Spodoptera frugiperda',
      comun: 'Gusano cogollero',
      fillColor: 'var(--level-1)',
    },
    'Quintana Roo': {
      alertas: 2,
      nivel: 'baja',
      cultivo: 'Caña de azúcar',
      principal: 'Aeneolamia albofasciata',
      comun: 'Mosca pinta',
      fillColor: 'var(--level-1)',
    },
    'Estado de México': {
      alertas: 4,
      nivel: 'baja',
      cultivo: 'Maíz',
      principal: 'Helicoverpa zea',
      comun: 'Gusano elotero',
      fillColor: 'var(--level-1)',
    },
    Hidalgo: {
      alertas: 3,
      nivel: 'baja',
      cultivo: 'Maíz',
      principal: 'Diabrotica virgifera',
      comun: 'Diabrótica',
      fillColor: 'var(--level-1)',
    },
    Querétaro: {
      alertas: 2,
      nivel: 'baja',
      cultivo: 'Maíz',
      principal: 'Spodoptera frugiperda',
      comun: 'Gusano cogollero',
      fillColor: 'var(--level-1)',
    },
    Colima: {
      alertas: 4,
      nivel: 'baja',
      cultivo: 'Limón',
      principal: 'Diaphorina citri',
      comun: 'HLB',
      fillColor: 'var(--level-1)',
    },
    Morelos: {
      alertas: 2,
      nivel: 'baja',
      cultivo: 'Caña de azúcar',
      principal: 'Diatraea saccharalis',
      comun: 'Barrenador',
      fillColor: 'var(--level-1)',
    },
    Tlaxcala: {
      alertas: 1,
      nivel: 'baja',
      cultivo: 'Cebada',
      principal: 'Rhopalosiphum padi',
      comun: 'Pulgón del cereal',
      fillColor: 'var(--level-1)',
    },
    'Baja California Sur': {
      alertas: 1,
      nivel: 'baja',
      cultivo: 'Tomate',
      principal: 'Bemisia tabaci',
      comun: 'Mosca blanca',
      fillColor: 'var(--level-1)',
    },
    Aguascalientes: {
      alertas: 1,
      nivel: 'baja',
      cultivo: 'Guayaba',
      principal: 'Anastrepha ludens',
      comun: 'Mosca de la fruta',
      fillColor: 'var(--level-1)',
    },
    Coahuila: {
      alertas: 2,
      nivel: 'baja',
      cultivo: 'Nogal',
      principal: 'Cydia caryana',
      comun: 'Gusano barrenador de la nuez',
      fillColor: 'var(--level-1)',
    },
    'Ciudad de México': {
      alertas: 0,
      nivel: 'nula',
      cultivo: 'Nopal',
      principal: 'Dactylopius coccus',
      comun: 'Grana cochinilla',
      fillColor: 'var(--level-0)',
    },
  };

  // Generar trazados vectoriales SVG con d3-geo
  const rawPaths = getStatePaths();
  const mapPaths = rawPaths.map((p) => {
    const info = estadosData[p.estado] || {
      alertas: 0,
      nivel: 'nula',
      cultivo: 'Sin registro',
      principal: 'Sin registro',
      fillColor: 'var(--level-0)',
    };
    return {
      ...p,
      alertas: info.alertas,
      nivel: info.nivel,
      cultivo: info.cultivo,
      principal: info.principal,
      comun: info.comun || '',
      fillColor: info.fillColor,
    };
  });

  // Ranking Top 8 para la columna lateral
  const ranking = mapPaths
    .filter((e) => e.alertas > 0)
    .sort((a, b) => b.alertas - a.alertas)
    .slice(0, 8);

  const maxAlertas = ranking[0]?.alertas || 1;
  const rankingConAncho = ranking.map((item, idx) => ({
    ...item,
    num: String(idx + 1).padStart(2, '0'),
    barWidth: Math.round((item.alertas / maxAlertas) * 120),
  }));

  const estadoInicial = estadosData['Sinaloa']
    ? { estado: 'Sinaloa', ...estadosData['Sinaloa'] }
    : mapPaths[0];

  const boletin = [
    {
      folio: 'SNVF-2026-0841',
      date: '22 AGO',
      state: 'Sinaloa',
      pestScientific: 'Spodoptera frugiperda',
      pestCommon: 'Gusano cogollero',
      crop: 'Maíz',
      level: 'ALTA',
      levelClass: 'text-red-700 bg-red-50 border-red-200',
    },
    {
      folio: 'SNVF-2026-0838',
      date: '21 AGO',
      state: 'Michoacán',
      pestScientific: 'Scirtothrips perseae',
      pestCommon: 'Trips del aguacate',
      crop: 'Aguacate',
      level: 'ALTA',
      levelClass: 'text-red-700 bg-red-50 border-red-200',
    },
    {
      folio: 'SNVF-2026-0835',
      date: '20 AGO',
      state: 'Tabasco',
      pestScientific: 'Fusarium oxysporum R4T',
      pestCommon: 'Marchitez del plátano',
      crop: 'Plátano',
      level: 'ALTA',
      levelClass: 'text-red-700 bg-red-50 border-red-200',
    },
    {
      folio: 'SNVF-2026-0829',
      date: '19 AGO',
      state: 'Tamaulipas',
      pestScientific: 'Diaphorina citri',
      pestCommon: 'Psílido asiático - HLB',
      crop: 'Cítricos',
      level: 'MEDIA',
      levelClass: 'text-amber-700 bg-amber-50 border-amber-200',
    },
    {
      folio: 'SNVF-2026-0824',
      date: '18 AGO',
      state: 'Guanajuato',
      pestScientific: 'Melanaphis sacchari',
      pestCommon: 'Pulgón amarillo',
      crop: 'Sorgo',
      level: 'MEDIA',
      levelClass: 'text-amber-700 bg-amber-50 border-amber-200',
    },
    {
      folio: 'SNVF-2026-0817',
      date: '16 AGO',
      state: 'Baja California',
      pestScientific: 'Thrips parvispinus',
      pestCommon: 'Trips oriental',
      crop: 'Hortalizas',
      level: 'MEDIA',
      levelClass: 'text-amber-700 bg-amber-50 border-amber-200',
    },
    {
      folio: 'SNVF-2026-0811',
      date: '14 AGO',
      state: 'Oaxaca',
      pestScientific: 'Schistocerca piceifrons',
      pestCommon: 'Langosta centroamericana',
      crop: 'Frijol',
      level: 'BAJA',
      levelClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
  ];

  const cultivosTemporada = [
    {
      nombre: 'Maíz de temporal',
      cientifico: 'Zea mays',
      siembra: [5, 8],
      cosecha: [10, 12],
      fichas: 86,
    },
    {
      nombre: 'Frijol',
      cientifico: 'Phaseolus vulgaris',
      siembra: [6, 7],
      cosecha: [10, 11],
      fichas: 54,
    },
    {
      nombre: 'Sorgo',
      cientifico: 'Sorghum bicolor',
      siembra: [5, 6],
      cosecha: [8, 11],
      fichas: 37,
    },
    {
      nombre: 'Aguacate',
      cientifico: 'Persea americana',
      siembra: [1, 12],
      cosecha: [1, 12],
      fichas: 62,
    },
    {
      nombre: 'Café',
      cientifico: 'Coffea arabica',
      siembra: [5, 7],
      cosecha: [10, 3],
      fichas: 48,
    },
    {
      nombre: 'Jitomate',
      cientifico: 'Solanum lycopersicum',
      siembra: [6, 9],
      cosecha: [10, 2],
      fichas: 71,
    },
    {
      nombre: 'Trigo',
      cientifico: 'Triticum aestivum',
      siembra: [10, 11],
      cosecha: [4, 6],
      fichas: 44,
    },
  ];

  const acervoStats = [
    {
      count: '1,240',
      title: 'Plagas y enfermedades',
      subtitle: 'FICHAS',
      description:
        'Diagnóstico, umbrales económicos y control biológico, químico y cultural.',
      link: '/plagues',
    },
    {
      count: '450',
      title: 'Cultivos',
      subtitle: 'PAQUETES',
      description:
        'Paquetes tecnológicos por zona climática, tipo de suelo y ciclo agrícola.',
      link: '/crops',
    },
    {
      count: '800',
      title: 'Insumos y productos',
      subtitle: 'REGISTROS',
      description:
        'Catálogo con registro sanitario, dosis autorizada e intervalo de seguridad.',
      link: '/products',
    },
  ];

  res.render('public/home', {
    pageTitle: 'Inicio',
    activePage: 'home',
    lastUpdate,
    heroStats,
    frequentSearches,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    mapPaths,
    ranking: rankingConAncho,
    estadoInicial,
    boletin,
    cultivosTemporada,
    acervoStats,
  });
};
