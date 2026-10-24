export default {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkDelete('Plagues', null, {});
    const plagues = [
      {
        name: 'Cenicilla Polvorienta',
        scientific_name: 'Erysiphe cichoracearum',
        category: 'Hongos',
        risk_level: 'Medio',
        region: 'Michoacán, Sinaloa',
        description:
          'Enfermedad fúngica que afecta calabacita, pepino y melón, produciendo polvo blanco foliar.',
        symptoms:
          'Polvo blanco harinoso en haz y envés de hojas, deformación de brotes y caída prematura de hojas.',
        control_methods:
          'Aplicación de azufre mojable preventivo y triazoles en infecciones avanzadas.',
        biological_control: 'Ampelomyces quisqualis, Bacillus subtilis.',
        biological_cycle: JSON.stringify([
          {
            title: 'Germinación de conidias',
            duration: '1-2 días',
            plantZone: 'Haz y envés foliar',
            damageLevel: 'Bajo',
            isControlWindow: true,
            description:
              'Las conidias aerotransportadas germinan sobre tejido seco con humedad relativa moderada y forman apresorios de anclaje.',
            recommendedAction:
              'Aspersión preventiva con azufre mojable o Bacillus subtilis al inicio de floración.',
          },
          {
            title: 'Colonización micelial',
            duration: '3-4 días',
            plantZone: 'Epidermis foliar y brotes',
            damageLevel: 'Moderado',
            isControlWindow: true,
            description:
              'El micelio superficial extrae nutrientes mediante haustorios epidérmicos, originando manchas cloróticas incipientes.',
            recommendedAction:
              'Aplicación dirigida de biofungicidas micoparásitos (Ampelomyces quisqualis) en focos iniciales.',
          },
          {
            title: 'Esporulación secundaria',
            duration: '5-7 días',
            plantZone: 'Lámina foliar completa',
            damageLevel: 'Severo',
            isControlWindow: false,
            description:
              'Producción masiva de cadenas de conidias que forman el polvo blanco harinoso y dispersan la enfermedad por viento.',
            recommendedAction:
              'Rotación con fungicidas sistémicos autorizados para frenar ciclos secundarios.',
          },
          {
            title: 'Cleistotecios invernantes',
            duration: '15-30 días',
            plantZone: 'Residuos vegetales senescentes',
            damageLevel: 'Sin daño directo',
            isControlWindow: false,
            description:
              'Estructuras resistentes de supervivencia entre ciclos agrícolas sobre rastrojo de cucurbitáceas.',
            recommendedAction:
              'Eliminación e incorporación sanitaria de residuos de cosecha.',
          },
        ]),
        verified_by: 'INIFAP Michoacán',
        verified_at: now,
        status: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Gusano Cogollero',
        scientific_name: 'Spodoptera frugiperda',
        category: 'Insectos',
        risk_level: 'Alto',
        region: 'El Bajío, Michoacán, Sinaloa, Veracruz',
        description:
          'Lepidóptero de alta movilidad que devora el cogollo en maizales y sorgo.',
        symptoms:
          'Perforaciones irregulares en hojas jóvenes, excrementos acumulados en el cogollo y raspado foliar.',
        control_methods:
          'Monitoreo de adultos con trampas de feromonas y aplicaciones dirigidas al cogollo.',
        biological_control:
          'Bacillus thuringiensis, Trichogramma spp., Doru taeniatum.',
        biological_cycle: JSON.stringify([
          {
            title: 'Huevo (Masa ovígera)',
            duration: '2-4 días',
            plantZone: 'Envés de hojas inferiores',
            damageLevel: 'Sin daño directo',
            isControlWindow: true,
            description:
              'Masas de 100 a 200 huevecillos cubiertos por escamas grisáceas depositadas durante la noche.',
            recommendedAction:
              'Liberación inundativa de parasitoides Trichogramma spp. y conservación de Doru taeniatum.',
          },
          {
            title: 'Larva neonatal (L1-L2)',
            duration: '4-6 días',
            plantZone: 'Follaje tierno y verticilo',
            damageLevel: 'Moderado',
            isControlWindow: true,
            description:
              'Raspado epidérmico que deja lesiones traslúcidas tipo ventanilla antes de internarse en el cogollo.',
            recommendedAction:
              'Ventana crítica: aplicación dirigida de Bacillus thuringiensis o ingredientes selectivos al cogollo.',
          },
          {
            title: 'Larva desarrollada (L3-L6)',
            duration: '10-16 días',
            plantZone: 'Interior del cogollo',
            damageLevel: 'Severo',
            isControlWindow: false,
            description:
              'Voracidad máxima con perforaciones irregulares severas protegidas por tapón de excremento húmedo.',
            recommendedAction:
              'Calibrar boquillas dirigidas al verticilo con volumen suficiente si rebasa umbral.',
          },
          {
            title: 'Pupa subterránea',
            duration: '8-12 días',
            plantZone: 'Suelo (2 a 8 cm de profundidad)',
            damageLevel: 'Sin daño directo',
            isControlWindow: false,
            description:
              'Crisálida café rojiza en cámara pupal subterránea donde completa la metamorfosis sin alimentarse.',
            recommendedAction:
              'Labranza sanitaria postcosecha para exponer pupas a depredadores naturales.',
          },
          {
            title: 'Adulto (Palomilla)',
            duration: '10-21 días',
            plantZone: 'Dosel del cultivo (hábito nocturno)',
            damageLevel: 'Sin daño directo',
            isControlWindow: false,
            description:
              'Vuelo migratorio nocturno, apareamiento y reinicio de oviposición preferentemente en etapas V2 a V8.',
            recommendedAction:
              'Monitoreo semanal mediante trampas con feromona sexual para anticipar nacimientos.',
          },
        ]),
        verified_by: 'INIFAP Michoacán',
        verified_at: now,
        status: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Mosca del Mediterráneo',
        scientific_name: 'Ceratitis capitata',
        category: 'Insectos',
        risk_level: 'Alto',
        region: 'Chiapas (Zona de Vigilancia)',
        description:
          'Díptico frugívoro cuarentenario de alto impacto comercial en huertos frutícolas.',
        symptoms:
          'Punturas de oviposición en frutos, pudrición interna por galerías de larvas y caída prematura de fruto.',
        control_methods:
          'Trampeo de detección con Trimedlure, aspersión de cebos tóxicos específicos y destrucción de frutos caídos.',
        biological_control:
          'Técnica del Insecto Estéril (TIE), Diachasmimorpha longicaudata.',
        biological_cycle: JSON.stringify([
          {
            title: 'Oviposición y Huevo',
            duration: '2-4 días',
            plantZone: 'Epicarpio del fruto en maduración',
            damageLevel: 'Bajo',
            isControlWindow: false,
            description:
              'La hembra perfora la cáscara depositando cámaras de 3 a 10 huevos fusiformes bajo la epidermis.',
            recommendedAction:
              'Inspección de punturas en frutos pintones y muestreo dirigido en bordes del huerto.',
          },
          {
            title: 'Larva frugívora (L1-L3)',
            duration: '9-11 días',
            plantZone: 'Pulpa interna del fruto',
            damageLevel: 'Severo',
            isControlWindow: false,
            description:
              'Alimentación gregaria en el mesocarpio que provoca galerías internas, pudrición secundaria y caída prematura.',
            recommendedAction:
              'Recolección y destrucción sanitaria inmediata de frutos caídos o infestados.',
          },
          {
            title: 'Pupa',
            duration: '9-11 días',
            plantZone: 'Suelo superficial bajo el dosel (2-5 cm)',
            damageLevel: 'Sin daño directo',
            isControlWindow: false,
            description:
              'La larva madura salta al suelo y forma un pupario cilíndrico color pardo donde se transforma en adulto.',
            recommendedAction:
              'Liberación del parasitoide Diachasmimorpha longicaudata y manejo del cajete.',
          },
          {
            title: 'Adulto reproductivo',
            duration: '30-60 días',
            plantZone: 'Follaje soleado y frutos hospederos',
            damageLevel: 'Moderado',
            isControlWindow: true,
            description:
              'Adultos emergentes requieren ingesta proteica durante la preoviposición antes de infestar nuevos frutos.',
            recommendedAction:
              'Trampeo oficial con Trimedlure, cebos selectivos y Técnica del Insecto Estéril (TIE).',
          },
        ]),
        verified_by: 'SENASICA / INIFAP',
        verified_at: now,
        status: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Psílido Asiático de los Cítricos',
        scientific_name: 'Diaphorina citri',
        category: 'Insectos',
        risk_level: 'Crítico',
        region: 'Michoacán, Colima, Veracruz, Yucatán',
        description:
          'Hemíptero vector principal de la bacteria Candidatus Liberibacter, causante del HLB.',
        symptoms:
          'Deformación y enroscamiento de brotes tiernos, secreciones cerosas blanquecinas y presencia de fumagina.',
        control_methods:
          'Monitoreo de brotes vegetativos, control químico coordinado en ventanas regionales y poda sanitaria.',
        biological_control: 'Tamarixia radiata, Chrysoperla carnea.',
        biological_cycle: JSON.stringify([
          {
            title: 'Huevo',
            duration: '3-4 días',
            plantZone: 'Ápices y pliegues de brotes tiernos',
            damageLevel: 'Sin daño directo',
            isControlWindow: false,
            description:
              'Huevos ovoides amarillo-anaranjados colocados exclusivamente sobre primordios foliares recién emergidos.',
            recommendedAction:
              'Inspección visual quincenal de brotes vegetativos tiernos en árboles centinela.',
          },
          {
            title: 'Ninfa (N1-N5)',
            duration: '12-15 días',
            plantZone: 'Brotes vegetativos en expansión',
            damageLevel: 'Moderado',
            isControlWindow: true,
            description:
              'Estadios sésiles aplanados que secretan túbulos cerosos blancos y adquieren con alta eficiencia la bacteria del HLB.',
            recommendedAction:
              'Liberación de Tamarixia radiata y aplicaciones selectivas dirigidas a la brotación.',
          },
          {
            title: 'Adulto vector',
            duration: '30-40 días',
            plantZone: 'Envés de hojas maduras y brotes',
            damageLevel: 'Severo',
            isControlWindow: true,
            description:
              'Se posa en ángulo de 45° al alimentarse del floema y transmite permanentemente Candidatus Liberibacter.',
            recommendedAction:
              'Control regional coordinado en ventanas oficiales y monitoreo con trampas amarillas.',
          },
        ]),
        verified_by: 'INIFAP Michoacán',
        verified_at: now,
        status: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Pulgón Verde',
        scientific_name: 'Schizaphis graminum',
        category: 'Insectos',
        risk_level: 'Alto',
        region: 'El Bajío, Sonora, Jalisco, Sinaloa',
        description:
          'Áfido chupador que forma colonias densas en espigas, follaje y envés de las hojas.',
        symptoms:
          'Manchas cloróticas por toxinas salivares, enrollamiento de hojas, debilitamiento general y secreción de melaza.',
        control_methods:
          'Ajuste de fertilización nitrogenada, rotación con insecticidas sistémicos y conservación de fauna benéfica.',
        biological_control:
          'Coccinella septempunctata, Chrysoperla comanche, Lysiphlebus testaceipes.',
        biological_cycle: JSON.stringify([
          {
            title: 'Ninfa partenogenética (N1-N4)',
            duration: '7-10 días',
            plantZone: 'Envés de hojas basales y medias',
            damageLevel: 'Moderado',
            isControlWindow: true,
            description:
              'Desarrollo acelerado en colonias densas; inyecta saliva fitotóxica desde los primeros estadios ninfales.',
            recommendedAction:
              'Conservar Coccinella septempunctata y aplicar control selectivo al alcanzar umbral económico.',
          },
          {
            title: 'Hembra áptera (Multiplicación)',
            duration: '15-20 días',
            plantZone: 'Follaje, tallos y espigas',
            damageLevel: 'Severo',
            isControlWindow: true,
            description:
              'Reproducción vivípara continua que ocasiona manchas necróticas, clorosis aguda y secreción abundante de melaza.',
            recommendedAction:
              'Balancear fertilización nitrogenada y rotar aficidas sistémicos respetando parasitoides.',
          },
          {
            title: 'Adulto alado (Dispersión)',
            duration: '10-15 días',
            plantZone: 'Dosel superior y lotes vecinos',
            damageLevel: 'Moderado',
            isControlWindow: false,
            description:
              'Forma alada inducida por alta densidad poblacional que migra con el viento y disemina virus en cereales.',
            recommendedAction:
              'Vigilancia en bordes parcelarios y eliminación de gramíneas voluntarias hospederas.',
          },
        ]),
        verified_by: 'INIFAP Michoacán',
        verified_at: now,
        status: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Roya Amarilla del Trigo',
        scientific_name: 'Puccinia striiformis',
        category: 'Hongos',
        risk_level: 'Crítico',
        region: 'El Bajío, Sonora, Valles Altos de México',
        description:
          'Hongo biotrófico aerotransportado que afecta principalmente el tejido foliar de cereales.',
        symptoms:
          'Rayas paralelas longitudinales de pústulas amarillas (uredinios) con polvo amarillo en el haz foliar.',
        control_methods:
          'Uso de variedades resistentes; aspersiones preventivas con triazoles al detectar los primeros focos.',
        biological_control:
          'Bacillus amyloliquefaciens, extractos botánicos de Melaleuca alternifolia.',
        biological_cycle: JSON.stringify([
          {
            title: 'Infección por urediniosporas',
            duration: '2-3 días',
            plantZone: 'Superficie foliar con rocío libre',
            damageLevel: 'Bajo',
            isControlWindow: true,
            description:
              'Germinación de esporas transportadas por viento y penetración estomática bajo temperaturas frescas (10 a 15 °C).',
            recommendedAction:
              'Monitoreo temprano en variedades susceptibles tras eventos de rocío prolongado.',
          },
          {
            title: 'Latencia endotrófica',
            duration: '6-9 días',
            plantZone: 'Mesófilo foliar',
            damageLevel: 'Moderado',
            isControlWindow: true,
            description:
              'Colonización intercelular silenciosa previa a romper la epidermis; aparecen estrías cloróticas pálidas.',
            recommendedAction:
              'Ventana óptima para aplicación de triazoles protegiendo la integridad de la hoja bandera.',
          },
          {
            title: 'Esporulación en estrías',
            duration: '14-21 días',
            plantZone: 'Haz de hojas superiores y espiga',
            damageLevel: 'Severo',
            isControlWindow: false,
            description:
              'Ruptura epidérmica con pústulas amarillas alineadas paralelamente a las nervaduras y merma fotosintética severa.',
            recommendedAction:
              'Manejo focalizado en lotes afectados y siembra de variedades resistentes en ciclos subsecuentes.',
          },
        ]),
        verified_by: 'INIFAP Michoacán',
        verified_at: now,
        status: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Tizón Tardío',
        scientific_name: 'Phytophthora infestans',
        category: 'Hongos',
        risk_level: 'Crítico',
        region: 'Estado de México, Puebla, Michoacán, Sinaloa',
        description:
          'Oomiceto fitopatógeno de alta virulencia y rápido avance foliar bajo condiciones húmedas y templadas.',
        symptoms:
          'Lesiones irregulares acuosas marrón oscuro en hojas y tallos; halo clorótico y vellosidad blanca en envés.',
        control_methods:
          'Destrucción de restos de cosecha, ventilación de cultivos y aplicaciones combinadas sistémicas/contacto.',
        biological_control: 'Trichoderma harzianum, Bacillus subtilis.',
        biological_cycle: JSON.stringify([
          {
            title: 'Germinación y zoosporas',
            duration: '1-2 días',
            plantZone: 'Película de agua sobre hojas y tallos',
            damageLevel: 'Bajo',
            isControlWindow: true,
            description:
              'En noches frescas y húmedas (>90% HR), los esporangios liberan zoosporas móviles que infectan tejido sano en horas.',
            recommendedAction:
              'Protección preventiva antes de lluvias continuas y manejo de ventilación del dosel.',
          },
          {
            title: 'Lesión acuosa e invasión',
            duration: '2-3 días',
            plantZone: 'Folíolos, pecíolos y tallos',
            damageLevel: 'Severo',
            isControlWindow: true,
            description:
              'Manchas irregulares acuosas marrón oscuro rodeadas de halo verde pálido con rápido avance necrótico.',
            recommendedAction:
              'Aplicación inmediata de fungicidas sistémicos translaminares alternando modos de acción.',
          },
          {
            title: 'Esporulación policíclica',
            duration: '4-6 días',
            plantZone: 'Envés foliar, frutos y tubérculos',
            damageLevel: 'Severo',
            isControlWindow: false,
            description:
              'Vellosidad blanquecina en el envés de la lesión que dispersa miles de nuevos esporangios por lluvia y viento.',
            recommendedAction:
              'Saneamiento de focos severos, aporque protector y destrucción total de residuos al cosechar.',
          },
        ]),
        verified_by: 'INIFAP Michoacán',
        verified_at: now,
        status: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: 'Trips Oriental',
        scientific_name: 'Frankliniella occidentalis',
        category: 'Insectos',
        risk_level: 'Alto',
        region: 'Sinaloa, Baja California, Michoacán, Morelos',
        description:
          'Tisanóptero raspador-chupador diminuto que daña flores y frutos en desarrollo y transmite tospovirus.',
        symptoms:
          'Plateado y moteado en hojas, aborto de flores y deformaciones cicatrizadas en frutos jóvenes.',
        control_methods:
          'Colocación de trampas cromáticas azules/amarillas y rotación de espinosinas con aceites vegetales.',
        biological_control: 'Orius insidiosus, Amblyseius swirskii.',
        biological_cycle: JSON.stringify([
          {
            title: 'Huevo endofítico',
            duration: '3-5 días',
            plantZone: 'Parénquima foliar y pétalos florales',
            damageLevel: 'Sin daño directo',
            isControlWindow: false,
            description:
              'Huevos reniformes insertados dentro del tejido vegetal tierno, protegidos del contacto directo superficial.',
            recommendedAction:
              'Instalación temprana de trampas cromáticas azules o amarillas desde prefloración.',
          },
          {
            title: 'Larva raspadora (L1-L2)',
            duration: '6-8 días',
            plantZone: 'Botones florales y brotes terminales',
            damageLevel: 'Severo',
            isControlWindow: true,
            description:
              'Raspado celular activo que produce plateado foliar, deformación de frutos recién cuajados y adquisición viral.',
            recommendedAction:
              'Liberación de Orius insidiosus o Amblyseius swirskii y rotación selectiva con espinosinas.',
          },
          {
            title: 'Prepupa y Pseudopupa',
            duration: '3-4 días',
            plantZone: 'Hojarasca y suelo superficial (1-3 cm)',
            damageLevel: 'Sin daño directo',
            isControlWindow: false,
            description:
              'Estadios inmóviles ocultos en grietas del suelo o sustrato donde no se alimentan ni reciben aspersiones foliares.',
            recommendedAction:
              'Manejo de acolchado plástico, humedad del suelo e higiene entre ciclos.',
          },
          {
            title: 'Adulto alado',
            duration: '15-30 días',
            plantZone: 'Interior de flores abiertas y follaje',
            damageLevel: 'Severo',
            isControlWindow: true,
            description:
              'Alta movilidad floral, cicatrizado en frutos jóvenes y transmisión persistente de tospovirus.',
            recommendedAction:
              'Eliminación de malezas florales hospederas y manejo secuencial para cortar generaciones superpuestas.',
          },
        ]),
        verified_by: 'INIFAP Michoacán',
        verified_at: now,
        status: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    await queryInterface.bulkInsert(
      'Plagues',
      plagues.map((plague) => ({
        ...plague,
        workflow_status: 'published',
        published_at: now,
      })),
      {},
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Plagues', null, {});
  },
};
