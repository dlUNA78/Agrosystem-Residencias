const SEED_PRODUCT_DESCRIPTIONS = Object.freeze([
  {
    name: 'Amistar Top',
    target_crops: 'Tomate, chile, papa, maíz, cucurbitáceas y berries',
    description:
      'Fungicida de amplio espectro que combina una estrobilurina (Azoxistrobina) con un triazol (Difenoconazol). Ofrece acción preventiva, curativa y antiesporulante con movimiento sistémico y translaminar para el manejo integrado de tizón temprano, cenicilla, roya y manchas foliares.',
  },
  {
    name: 'Ridomil Gold Bravo',
    target_crops: 'Papa, jitomate, cebolla, calabacita, melón y pepino',
    description:
      'Fungicida coformulado con acción sistémica acropétala (Mefenoxam) y protección multisitio de contacto (Clorotalonil). Diseñado para el control contundente de oomicetos como tizón tardío (Phytophthora infestans) y mildiu velloso en etapas de activo crecimiento vegetativo.',
  },
  {
    name: 'Coragen',
    target_crops: 'Maíz, sorgo, jitomate, chile, brócoli, algodón y nogal',
    description:
      'Insecticida del grupo de las diamidas antranílicas (IRAC Grupo 28) altamente selectivo hacia artrópodos benéficos y polinizadores. Actúa sobre los receptores de rianodina provocando el cese inmediato de la alimentación en larvas de gusano cogollero, gusano del fruto y barrenadores.',
  },
  {
    name: 'Belt 480 SC',
    target_crops: 'Maíz, jitomate, chile, soya, garbanzo y crucíferas',
    description:
      'Insecticida especialista en el control de lepidópteros plaga (IRAC Grupo 28). Induce contracción muscular irreversible en estadios larvarios tras la ingestión del tejido tratado, brindando persistencia foliar y compatibilidad con programas de Manejo Integrado de Plagas (MIP).',
  },
  {
    name: 'Confidor 350 SC',
    target_crops: 'Jitomate, chile, papa, cítricos, aguacate y cucurbitáceas',
    description:
      'Insecticida sistémico cloronicotinilo (IRAC Grupo 4A) con absorción radicular y foliar vía xilema. Indicado para el control de insectos chupadores transmisores de virosis como mosquita blanca, pulgones, psílidos y chicharritas bajo esquemas de rotación de modo de acción.',
  },
  {
    name: 'Movento 150 SC',
    target_crops: 'Aguacate, cítricos, jitomate, chile, cebolla, uva y berries',
    description:
      'Insecticida-acaricida derivado de ácidos tetrónicos (IRAC Grupo 23) con sistemicidad bidireccional única vía xilema y floema. Inhibe la biosíntesis de lípidos protegiendo brotes nuevos, hojas desarrolladas y raíces frente a trips, pulgones, escamas y mosca blanca.',
  },
  {
    name: 'Success 120 SC',
    target_crops: 'Chile, jitomate, fresa, zarzamora, maíz dulce y crucíferas',
    description:
      'Insecticida de origen natural obtenido por fermentación de Saccharopolyspora spinosa (IRAC Grupo 5). Combina alta eficacia de choque por contacto e ingestión contra trips, minadores de la hoja y larvas de lepidópteros con un corto intervalo de seguridad a cosecha.',
  },
  {
    name: 'Folicur 250 EW',
    target_crops: 'Trigo, cebada, maíz, plátano, ajo, cebolla y manzano',
    description:
      'Fungicida sistémico del grupo de los triazoles (FRAC Grupo 3), inhibidor de la biosíntesis del ergosterol en membranas fúngicas. Presenta actividad preventiva, curativa y erradicante contra royas, manchas foliares, cenicillas y fusariosis en cereales y hortalizas.',
  },
]);

const HAZARD_UPDATES = Object.freeze([
  [
    'Categoría IV — Precaución (Banda Verde)',
    ['Categoría 5 - Precaución', 'Categoría IV - Precaución'],
  ],
  [
    'Categoría III — Ligeramente Peligroso (Banda Azul)',
    ['Categoría 4 - Precaución', 'Categoría III - Ligeramente Peligroso'],
  ],
  [
    'Categoría II — Moderadamente Peligroso (Banda Amarilla)',
    ['Categoría 3 - Peligro', 'Categoría II - Moderadamente Peligroso'],
  ],
  [
    'Categoría I — Altamente Peligroso (Banda Roja)',
    [
      'Categoría 2 - Peligro',
      'Categoría 1 - Peligro',
      'Categoría I - Altamente Peligroso',
    ],
  ],
]);

export default {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      for (const [canonical, legacyList] of HAZARD_UPDATES) {
        await queryInterface.sequelize.query(
          `UPDATE "Products"
           SET "hazard_category" = :canonical
           WHERE "hazard_category" IN (:legacyList)`,
          {
            replacements: { canonical, legacyList },
            transaction,
          },
        );
      }

      for (const item of SEED_PRODUCT_DESCRIPTIONS) {
        await queryInterface.sequelize.query(
          `UPDATE "Products"
           SET "description" = COALESCE(NULLIF(BTRIM("description"), ''), :description),
               "target_crops" = COALESCE(NULLIF(BTRIM("target_crops"), ''), :targetCrops)
           WHERE "name" = :name`,
          {
            replacements: {
              name: item.name,
              description: item.description,
              targetCrops: item.target_crops,
            },
            transaction,
          },
        );
      }

      await queryInterface.sequelize.query(
        `UPDATE "Products"
         SET "status" = false
         WHERE "workflow_status" <> 'published' AND "status" = true`,
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `UPDATE "Products"
         SET "status" = true
         WHERE "workflow_status" IN ('draft', 'in_review', 'changes_requested', 'verified')`,
        { transaction },
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
