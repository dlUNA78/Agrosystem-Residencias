export const renderForumPublic = (req, res) => {
  const threads = [
    {
      id: 1,
      title: 'Protocolo oficial para el control de Tuta absoluta en tomate bajo invernadero',
      author: {
        name: 'Dr. Roberto Mendoza',
        role: 'inifap',
        roleLabel: 'Investigador INIFAP',
        avatar:
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
        location: 'Campo Exp. Culiacán',
      },
      category: 'Plagas',
      cropName: 'Tomate Bola',
      cropUrl: '/crops/1',
      badgeStatus: 'verified',
      badgeLabel: '✅ Respuesta Verificada INIFAP',
      badgeClass:
        'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
      summary:
        'Evaluación del protocolo fitosanitario con Nesidiocoris tenuis y extractos botánicos en el Valle de Culiacán. Reducción del 45% de minado foliar.',
      imageUrl:
        'https://images.unsplash.com/photo-1592417817098-8f3d6eb231fc?auto=format&fit=crop&w=600&q=80',
      repliesCount: 24,
      upvotesCount: 56,
      viewsCount: '1.2k',
      timeAgo: 'hace 2 horas',
      isPinned: true,
    },
    {
      id: 2,
      title: 'Aparición de manchas amarillentas y necrosis en envés de hojas de chile jalapeño',
      author: {
        name: 'Juan Pérez',
        role: 'agricultor',
        roleLabel: 'Agricultor',
        avatar:
          'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
        location: 'Bellavista, Culiacán',
      },
      category: 'Hongos',
      cropName: 'Chile Jalapeño',
      cropUrl: '/crops/2',
      badgeStatus: 'evaluating',
      badgeLabel: '🔍 En evaluación INIFAP',
      badgeClass:
        'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
      summary:
        'Detecté manchas circulares con halo amarillento en el 15% del cultivo tras las lluvias recientes. Adjunto fotografías para apoyo en diagnóstico.',
      imageUrl:
        'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&w=600&q=80',
      repliesCount: 12,
      upvotesCount: 18,
      viewsCount: '480',
      timeAgo: 'hace 5 horas',
      isPinned: false,
    },
    {
      id: 3,
      title: 'Dosificación recomendada de fungicida para control de cenicilla en calabacita',
      author: {
        name: 'Carlos Ruiz',
        role: 'agricultor',
        roleLabel: 'Productor',
        avatar:
          'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
        location: 'Los Mochis, Sinaloa',
      },
      category: 'Tratamientos',
      cropName: 'Calabacita',
      cropUrl: '/crops/3',
      badgeStatus: 'solved',
      badgeLabel: '✅ Solucionado',
      badgeClass:
        'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
      summary:
        '¿Cuál es la concentración óptima de Amistar Top y el intervalo de seguridad recomendado antes del corte?',
      imageUrl: null,
      repliesCount: 18,
      upvotesCount: 44,
      viewsCount: '890',
      timeAgo: 'hace 1 día',
      isPinned: false,
    },
  ];

  res.render('public/forum', {
    pageTitle: 'Foro de Consulta Fitosanitaria',
    activePage: 'forum',
    threads,
    totalCount: 354,
    verifiedPercent: '98.4%',
    extraScripts: '<script src="/js/public/forum.js"></script>',
  });
};

export const renderForumDetailPublic = (req, res) => {
  const thread = {
    id: 1,
    title: 'Aparición de manchas amarillentas y necrosis en envés de hojas de chile jalapeño',
    author: {
      name: 'Juan Pérez',
      roleLabel: 'Agricultor Registrado',
      avatar:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
      location: 'Ejido Bellavista, Culiacán, Sin.',
    },
    category: 'Hongos y Enfermedades',
    cropName: 'Chile Jalapeño',
    cropUrl: '/crops/2',
    timeAgo: 'Publicado el 24 de Agosto, 2026',
    content:
      'Estimada comunidad y técnicos del INIFAP, en las últimas semanas he observado en una parcela de 3 hectáreas de chile jalapeño manchas amarillentas concéntricas en el haz de la hoja y una eflorescencia blanquecina por el envés. El problema aumentó rápidamente después de las lluvias de la semana pasada. ¿Podrían orientarme sobre la enfermedad y qué tratamiento aplicar?',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?auto=format&fit=crop&w=800&q=80',
        caption: 'Síntoma foliar en zona media del cultivo',
      },
      {
        url: 'https://images.unsplash.com/photo-1592417817098-8f3d6eb231fc?auto=format&fit=crop&w=800&q=80',
        caption: 'Detalle de necrosis en envés',
      },
    ],
    officialAnswer: {
      doctorName: 'Dr. Roberto Mendoza INIFAP',
      doctorRole: 'Investigador Fitosanitario Senior',
      doctorAvatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      date: 'Respuesta validada el 25 de Agosto, 2026',
      diagnosis:
        'Cenicilla del Chile (Oidiopsis sicula / Leveillula taurica). Patógeno común en solanáceas ante humedad relativa alta y temperaturas moderadas (22°C - 28°C).',
      treatmentTitle: 'Tratamiento Fitosanitario Recomendado:',
      productRecommended: {
        id: 1,
        name: 'Amistar Top',
        activeIngredient: 'Azoxistrobin + Difenoconazol',
        dose: '0.4 a 0.5 L/ha vía foliar',
        safetyDays: 3,
        productUrl: '/products/1',
      },
      recommendations: [
        'Realizar aplicación foliar al detectar los primeros síntomas.',
        'Asegurar buen cubrimiento del envés foliar.',
        'Respetar el intervalo de seguridad de 3 días antes de la cosecha.',
      ],
    },
    replies: [
      {
        id: 101,
        authorName: 'Ing. María Fernanda López',
        authorRole: 'Técnico INIFAP',
        authorAvatar:
          'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
        timeAgo: 'hace 18 horas',
        content:
          'Coincido totalmente con el dictamen del Dr. Mendoza. Le sugerimos además reducir la densidad de follaje con una poda de deshoje en la parte inferior para mejorar la ventilación del dosel.',
        upvotes: 14,
      },
      {
        id: 102,
        authorName: 'Carlos Ruiz',
        authorRole: 'Productor Agrícola',
        authorAvatar:
          'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
        timeAgo: 'hace 12 horas',
        content:
          'Aplicamos Amistar Top en el ciclo pasado en el Valle del Fuerte con excelentes resultados. En 48 horas frenó el avance de la cenicilla.',
        upvotes: 8,
      },
    ],
  };

  res.render('public/forum-detail', {
    pageTitle: thread.title,
    activePage: 'forum',
    thread,
    extraScripts: '<script src="/js/public/forum.js"></script>',
  });
};

export const renderForumSpecialistsPublic = (req, res) => {
  const specialists = [
    {
      id: 1,
      name: 'Dr. Roberto Mendoza',
      roleLabel: 'Investigador INIFAP Senior',
      specialty: 'Fitopatología y Micología',
      station: 'Campo Exp. Culiacán, Sin.',
      avatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      isOnline: true,
      diagnosticsCount: 142,
      bio: 'Especialista en identificación de patógenos foliares en hortalizas bajo invernadero y malla sombra. 15 años de investigación en el INIFAP.',
      tags: ['Hongos', 'Tomate', 'Chile', 'Control Químico'],
    },
    {
      id: 2,
      name: 'Ing. María Fernanda López',
      roleLabel: 'Técnico Fitosanitario INIFAP',
      specialty: 'Entomología y Control Biológico',
      station: 'Campo Exp. Valle del Fuerte, Sin.',
      avatar:
        'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
      isOnline: true,
      diagnosticsCount: 98,
      bio: 'Enfocada en el manejo integrado de plagas, parasitoides y predadores para minadores de hoja y ácaros en hortalizas.',
      tags: ['Plagas', 'Control Biológico', 'Maíz', 'Cucurbitáceas'],
    },
    {
      id: 3,
      name: 'Dr. Alejandro Gutiérrez',
      roleLabel: 'Investigador INIFAP',
      specialty: 'Nutrición Vegetal y Fisiología',
      station: 'Campo Exp. Hermosillo, Son.',
      avatar:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      isOnline: false,
      diagnosticsCount: 76,
      bio: 'Experto en corrección de deficiencias nutricionales, estrés calórico e hídrico en cultivos extensivos y frutales.',
      tags: ['Nutrición', 'Estrés Hídrico', 'Trigo', 'Cítricos'],
    },
    {
      id: 4,
      name: 'Dra. Claudia Morales',
      roleLabel: 'Investigadora Biotecnóloga',
      specialty: 'Biotecnología Fitosanitaria',
      station: 'Campo Exp. Bajío, Gto.',
      avatar:
        'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80',
      isOnline: true,
      diagnosticsCount: 115,
      bio: 'Investigación de extractos vegetales, bioestimulantes y resistencia varietal a enfermedades bacterianas.',
      tags: ['Biotecnología', 'Bacterias', 'Bioestimulantes'],
    },
  ];

  res.render('public/forum-specialists', {
    pageTitle: 'Directorio de Especialistas Fitosanitarios — INIFAP',
    activePage: 'forum',
    specialists,
    extraScripts: '<script src="/js/public/forum.js"></script>',
  });
};

export const renderForumMessagesPublic = (req, res) => {
  const conversations = [
    {
      id: 1,
      contactName: 'Dr. Roberto Mendoza INIFAP',
      contactRole: 'Investigador INIFAP',
      contactAvatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      lastMessage: 'Le recomiendo aplicar Amistar Top en dosis de 0.5 L/ha con intervalo de 3 días.',
      timeAgo: '10:42 AM',
      unreadCount: 1,
      isActive: true,
    },
    {
      id: 2,
      contactName: 'Ing. María Fernanda López',
      contactRole: 'Técnico INIFAP',
      contactAvatar:
        'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80',
      lastMessage: 'Adjunto la ficha técnica del extracto botánico para ácaros.',
      timeAgo: 'Ayer',
      unreadCount: 0,
      isActive: false,
    },
    {
      id: 3,
      contactName: 'Carlos Ruiz',
      contactRole: 'Productor Agrícola',
      contactAvatar:
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
      lastMessage: '¿Cómo te fue con el corte de calabacita este fin de semana?',
      timeAgo: '23 Ago',
      unreadCount: 0,
      isActive: false,
    },
  ];

  const activeChat = {
    contactName: 'Dr. Roberto Mendoza INIFAP',
    contactRole: 'Investigador Fitosanitario Senior · Campo Exp. Culiacán',
    contactAvatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    isOnline: true,
    linkedThread: {
      id: 2,
      title: 'Aparición de manchas amarillentas en chile jalapeño',
    },
    messages: [
      {
        id: 1,
        sender: 'user',
        senderName: 'Juan Pérez',
        avatar:
          'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
        text: 'Hola Dr. Mendoza, le escribo por la consulta sobre las manchas en las hojas de chile jalapeño. Le adjunto el resultado del análisis foliar de la parcela 3.',
        attachment: {
          name: 'Analisis_Foliar_Chile_Jalapeno.pdf',
          size: '1.4 MB',
          type: 'pdf',
        },
        time: '10:30 AM',
      },
      {
        id: 2,
        sender: 'contact',
        senderName: 'Dr. Roberto Mendoza INIFAP',
        avatar:
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
        text: 'Hola Juan. Revisando las fotografías y el análisis foliar, efectivamente confirmamos Cenicilla del Chile (Oidiopsis sicula). Le sugiero aplicar la siguiente formulación fungicida autorizada en nuestro catálogo:',
        productRecommendation: {
          id: 1,
          name: 'Amistar Top',
          activeIngredient: 'Azoxistrobin + Difenoconazol',
          dose: '0.4 a 0.5 L/ha vía foliar',
          safetyDays: 3,
          productUrl: '/products/1',
        },
        time: '10:35 AM',
      },
      {
        id: 3,
        sender: 'user',
        senderName: 'Juan Pérez',
        avatar:
          'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
        text: 'Excelente Dr., muchas gracias. ¿Recomienda hacer la aplicación por la mañana o al atardecer?',
        time: '10:40 AM',
      },
      {
        id: 4,
        sender: 'contact',
        senderName: 'Dr. Roberto Mendoza INIFAP',
        avatar:
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
        text: 'Es preferible aplicar al atardecer para evitar la evaporación rápida del producto y asegurar una absorción foliar óptima. Quedo al pendiente del avance.',
        time: '10:42 AM',
      },
    ],
  };

  res.render('public/forum-messages', {
    pageTitle: 'Mensajes Privados — Chat Fitosanitario',
    activePage: 'forum',
    conversations,
    activeChat,
    extraScripts: '<script src="/js/public/forum.js"></script>',
  });
};
