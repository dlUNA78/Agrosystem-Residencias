export default {
  async up(queryInterface) {
    await queryInterface.bulkInsert("Plagues", [
      {
        name: "Pulgón Verde",
        scientific_name: "Schizaphis graminum",
        category: "Insecto — Hemiptera: Aphididae",
        description:
          "Considerada una de las plagas más devastadoras para cereales en etapas tempranas. Succiona la savia del floema causando clorosis y transmite virus como el BYDV. Se requiere intervención inmediata en zonas de alerta.",
        risk_level: "Alto",
        region: "El Bajío, Norte de Tamaulipas, Sonora",
        image_url: "https://picsum.photos/seed/pulgon-verde/1200/900",
        symptoms:
          "Hojas enrolladas, amarillamiento (clorosis) y manchas plateadas en el haz. En infestaciones severas se observa melaza pegajosa que favorece la aparición de fumagina. Las plantas atacadas presentan enanismo y pérdida de vigor.",
        control_methods:
          "Aplicación foliar de insecticidas sistémicos bajo umbrales de acción (50 pulgones/planta). Se recomienda el uso de Imidacloprid o Tiametoxam siguiendo estrictamente las dosis validadas por INIFAP para evitar resistencia. Monitoreo semanal en etapas de plántula a macollamiento.",
        biological_control:
          "Implementación de depredadores naturales como Hippodamia convergens (catarinitas) y Chrysoperla spp. El uso de parasitoides como Lysiphlebus testaceipes ha demostrado una reducción del 40% en poblaciones activas. Liberaciones preventivas de 500–1000 individuos/ha son efectivas en etapas tempranas.",
        biological_cycle: JSON.stringify([
          { title: "Huevo / Fundación", description: "En climas fríos pasan el invierno como huevos. En México predominan hembras fundatrices que se reproducen de forma vivípara sin necesidad de machos." },
          { title: "Ninfas (4 Instares)", description: "Crecimiento rápido de 5 a 10 días según temperatura. Succionan savia activamente y provocan clorosis desde los primeros instares." },
          { title: "Adulto Áptero", description: "Hembras sin alas dedicadas a la reproducción masiva por partenogénesis. Una sola hembra puede producir hasta 80 descendientes en su vida." },
          { title: "Adulto Alado", description: "Formas migratorias que surgen cuando la planta se deteriora, hay sobrepoblación o cambios estacionales. Son el principal vector de dispersión entre parcelas." },
        ]),
        verified_by: "Dr. José Luis Leyva Mir — CEVAMEX INIFAP",
        verified_at: new Date("2024-03-15"),
        status: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Roya Amarilla del Trigo",
        scientific_name: "Puccinia striiformis f. sp. tritici",
        category: "Hongo — Pucciniales: Pucciniaceae",
        description:
          "Enfermedad fúngica de gran impacto económico en zonas trigueras. Las esporas se dispersan fácilmente por el viento y en condiciones favorables puede devastar hasta el 70% del rendimiento en pocas semanas.",
        risk_level: "Alto",
        region: "Sonora, Sinaloa, Guanajuato, Jalisco",
        image_url: "https://picsum.photos/seed/roya-amarilla/1200/900",
        symptoms:
          "Pústulas amarillas o anaranjadas dispuestas en franjas longitudinales sobre las hojas. Las lesiones liberan uredosporas polvosas al tacto. En ataques severos las hojas se necrosan prematuramente y la espiga queda estéril.",
        control_methods:
          "Uso de variedades resistentes certificadas por INIFAP. Aplicación preventiva de triazoles (Tebuconazol, Propiconazol) en dosis de 500–750 ml/ha al detectar las primeras pústulas. Evitar siembras tardías en zonas de alta incidencia.",
        biological_control:
          "El control se basa principalmente en resistencia genética varietal y manejo cultural: eliminación de hospedantes alternos (gramíneas silvestres) en márgenes de parcela. No existen agentes biológicos comerciales eficientes para esta enfermedad.",
        biological_cycle: JSON.stringify([
          { title: "Uredosporas", description: "Esporas asexuales transportadas por el viento a grandes distancias. Germinan con humedad y temperaturas de 7–15°C." },
          { title: "Infección y penetración", description: "La espora penetra por los estomas en 6–8 horas con rocío. El periodo de incubación es de 7–14 días según temperatura." },
          { title: "Colonización", description: "El micelio coloniza el tejido intercelular. Las primeras pústulas visibles aparecen entre los 10–18 días post-infección." },
          { title: "Esporulación", description: "Cada pústula produce millones de uredosporas que reinician el ciclo. En una temporada pueden ocurrir múltiples ciclos de infección." },
        ]),
        verified_by: "Dr. Julio Huerta Espino — CIANO INIFAP",
        verified_at: new Date("2024-01-20"),
        status: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Gusano Cogollero",
        scientific_name: "Spodoptera frugiperda",
        category: "Insecto — Lepidoptera: Noctuidae",
        description:
          "Plaga polífaga de alta movilidad que ataca principalmente el cogollo del maíz en sus primeras etapas. Las larvas consumen el tejido foliar desde el interior, dificultando la detección temprana.",
        risk_level: "Alto",
        region: "Veracruz, Tabasco, Chiapas, Oaxaca, Jalisco",
        image_url: "https://picsum.photos/seed/cogollero/1200/900",
        symptoms:
          "Raspado superficial de hojas en estadios tempranos. En larvas mayores: perforaciones irregulares con excrementos (frass) dentro del cogollo. Las plantas atacadas presentan daño en forma de ventana en hojas jóvenes.",
        control_methods:
          "Monitoreo con trampas de feromonas para adultos. Umbral de acción: 20% de plantas con larvas pequeñas. Aplicación de insecticidas en el cogollo (Clorpirifós, Spinetoram) en las primeras 3 semanas del cultivo.",
        biological_control:
          "Aplicación de Bacillus thuringiensis var. kurstaki (Bt) en larvas de 1er y 2do instar. Liberación de Trichogramma spp. como parasitoide de huevos. Conservación de depredadores naturales como Doru taeniatum (tijereta) y arañas.",
        biological_cycle: JSON.stringify([
          { title: "Huevo", description: "La hembra deposita masas de 100–200 huevos cubiertos de escamas en el haz de las hojas. La eclosión ocurre en 2–4 días con temperaturas de 25–30°C." },
          { title: "Larva (6 instares)", description: "Periodo de mayor daño. Las larvas pequeñas raspan el tejido foliar; las mayores perforan el cogollo. El ciclo larval dura 14–22 días." },
          { title: "Pupa", description: "Se empupa en el suelo a 2–8 cm de profundidad. El periodo pupal dura 8–12 días. La labranza puede exponer y destruir pupas." },
          { title: "Adulto (Polilla)", description: "El adulto vive 10–21 días. Las hembras pueden migrar hasta 100 km en una noche, lo que explica la rápida dispersión regional." },
        ]),
        verified_by: "M.C. Miriam Martínez Reyes — CEVAMEX INIFAP",
        verified_at: new Date("2024-05-10"),
        status: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Cenicilla Polvorienta",
        scientific_name: "Erysiphe cichoracearum",
        category: "Hongo — Erysiphales: Erysiphaceae",
        description:
          "Enfermedad fúngica que afecta principalmente calabacita, pepino y melón. Se caracteriza por la formación de un polvo blanco en la superficie foliar que reduce la fotosíntesis.",
        risk_level: "Medio",
        region: "Sonora, Sinaloa, Baja California",
        image_url: "https://picsum.photos/seed/cenicilla/1200/900",
        symptoms:
          "Polvo blanco harinoso en haz y envés de hojas, tallos y frutos jóvenes. Las hojas afectadas se deforman, amarillan y caen prematuramente. En frutos causa manchado y pérdida de valor comercial.",
        control_methods:
          "Aplicación de azufre mojable (2–3 kg/ha) como medida preventiva. En infecciones establecidas usar fungicidas del grupo de los triazoles o estrobilurinas. Evitar exceso de nitrógeno y mantener buena aireación entre plantas.",
        biological_control:
          "Aplicación de Ampelomyces quisqualis como micoparasitoide de la cenicilla. Extractos de ajo y bicarbonato de sodio al 1% muestran actividad fungistática. Trichoderma harzianum como inductor de resistencia sistémica.",
        biological_cycle: JSON.stringify([
          { title: "Conidias", description: "Esporas asexuales dispersadas por el viento. Germinan directamente sobre la superficie foliar sin necesidad de agua libre." },
          { title: "Infección superficial", description: "El hongo coloniza solo la epidermis, proyectando haustorios al interior celular. No penetra en el mesófilo, facilitando el control químico superficial." },
          { title: "Colonización y esporulación", description: "El micelio blanco se extiende rápidamente. Cada mancha puede producir miles de conidias en 5–7 días, iniciando nuevos ciclos." },
          { title: "Cleistotecios (invierno)", description: "Estructuras sexuales negras que permanecen en residuos vegetales como inóculo para la siguiente temporada." },
        ]),
        verified_by: "Dra. Rosa Elena Mora Aguilera — CEVACU INIFAP",
        verified_at: new Date("2024-02-28"),
        status: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("Plagues", null, {});
  },
};