import PDFDocument from 'pdfkit';

const COLORS = Object.freeze({
  brand: '#1b4332',
  ink: '#0f172a',
  muted: '#334155',
  subtle: '#64748b',
  border: '#cbd5e1',
  surface: '#f8fafc',
  dangerBg: '#fef2f2',
  dangerInk: '#991b1b',
});

const PAGE_MARGIN = 42;

const sanitizePdfText = (value, fallback = '') => {
  const raw = value === null || value === undefined ? '' : String(value);
  const cleaned = raw
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2022/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\t\n\r\x20-\xFF]/g, '')
    .trim();
  return cleaned || fallback;
};

export const buildProductHdsFilename = (product = {}) => {
  const slug = String(product.name || 'insumo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 44);
  const idPart = product.id ? `${product.id}-` : '';
  return `HDS-MSDS-NOM018-${idPart}${slug || 'agroquimico'}.pdf`;
};

const ensureVerticalSpace = (doc, neededHeight = 56) => {
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > bottomLimit) {
    doc.addPage();
  }
};

const drawHdsHeader = (doc, product) => {
  const startX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const topY = doc.page.margins.top;

  doc.save();
  doc.rect(startX, topY, contentWidth, 3.5).fill(COLORS.brand);
  doc
    .fillColor(COLORS.brand)
    .font('Courier-Bold')
    .fontSize(8)
    .text(
      'HOJA DE DATOS DE SEGURIDAD (HDS / MSDS) · NOM-018-STPS-2015 / SGA',
      startX,
      topY + 10,
      { width: contentWidth - 155 },
    );
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(15)
    .text(
      sanitizePdfText(product.name, 'Insumo Fitosanitario'),
      startX,
      topY + 23,
      { width: contentWidth - 155, lineBreak: false, ellipsis: true },
    );
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(8.5)
    .text(
      `Registro Sanitario RSCO/COFEPRIS: ${sanitizePdfText(product.registration_code, 'En tramite')}  |  Titular: ${sanitizePdfText(product.manufacturer, 'No especificado')}`,
      startX,
      topY + 42,
      { width: contentWidth - 155, lineBreak: false, ellipsis: true },
    );

  const boxX = startX + contentWidth - 146;
  doc
    .roundedRect(boxX, topY + 9, 146, 42, 4)
    .fillAndStroke(COLORS.dangerBg, COLORS.border);
  doc
    .fillColor(COLORS.dangerInk)
    .font('Courier-Bold')
    .fontSize(7.5)
    .text('EMERGENCIAS SINTOX / ATOX', boxX + 8, topY + 16, {
      width: 130,
      align: 'right',
    });
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .text('800-000-2869 (24 HRS)', boxX + 8, topY + 30, {
      width: 130,
      align: 'right',
    });

  doc
    .moveTo(startX, topY + 58)
    .lineTo(startX + contentWidth, topY + 58)
    .strokeColor(COLORS.border)
    .lineWidth(0.75)
    .stroke();
  doc.restore();
  doc.y = topY + 66;
};

const drawHdsSection = (doc, secNum, title, lines) => {
  ensureVerticalSpace(doc, 60);
  const startX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const topY = doc.y;

  doc.save();
  doc.rect(startX, topY, 3, 14).fill(COLORS.brand);
  doc
    .fillColor(COLORS.brand)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(
      `SECCION ${secNum}. ${sanitizePdfText(title).toUpperCase()}`,
      startX + 8,
      topY + 2,
      { width: contentWidth - 12 },
    );
  doc.restore();
  doc.y = topY + 18;

  lines.forEach((line) => {
    ensureVerticalSpace(doc, 22);
    doc
      .fillColor(COLORS.ink)
      .font('Helvetica')
      .fontSize(8.5)
      .text(`- ${sanitizePdfText(line)}`, startX + 6, doc.y, {
        width: contentWidth - 12,
        lineGap: 1.4,
      });
    doc.moveDown(0.15);
  });
  doc.moveDown(0.35);
};

const buildSixteenSections = (product) => {
  const name = sanitizePdfText(product.name, 'Insumo agroquimico');
  const active = sanitizePdfText(
    product.active_ingredient,
    'Declarado en etiqueta oficial',
  );
  const category = sanitizePdfText(product.category, 'Agroquimico');
  const hazard = sanitizePdfText(
    product.hazardTheme?.fullLabel || product.hazard_category,
    'Categoria IV - Precaucion (Banda Verde)',
  );
  const formulation = sanitizePdfText(
    product.formulation_type,
    'Formulacion agricola estandar',
  );
  const mode = sanitizePdfText(
    product.mode_of_action,
    'Accion especifica fitosanitaria',
  );
  const dosage = sanitizePdfText(
    product.suggested_dosage,
    'Consultar etiqueta autorizada',
  );
  const interval = sanitizePdfText(
    product.safetyInterval?.value,
    'Segun cultivo en etiqueta',
  );

  return [
    [
      '1',
      'Identificacion de la sustancia o mezcla y del fabricante',
      [
        `Nombre comercial: ${name} (${category})`,
        `Registro sanitario COFEPRIS / RSCO: ${sanitizePdfText(product.registration_code, 'En tramite')}`,
        `Fabricante / Formuladora titular: ${sanitizePdfText(product.manufacturer, 'Titular registrado')}`,
        'Uso recomendado: Insumo de uso exclusivamente agricola y fitosanitario.',
      ],
    ],
    [
      '2',
      'Identificacion de los peligros (NOM-232-SSA1 / SGA)',
      [
        `Clasificacion toxicologica oficial: ${hazard}`,
        'Indicaciones de peligro: Puede ser nocivo en caso de ingestion, inhalacion de neblina de aspersion o contacto prolongado con piel y ojos.',
        'Consejos de prudencia: No comer, beber ni fumar durante la preparacion y aplicacion. Mantener fuera del alcance de menores y animales.',
      ],
    ],
    [
      '3',
      'Composicion / Informacion sobre los componentes',
      [
        `Ingrediente(s) activo(s): ${active}`,
        `Tipo de formulacion: ${formulation}  |  Mecanismo de accion (IRAC/FRAC/HRAC): ${mode}`,
        'Ingredientes inertes: Diluyentes, surfactantes y coadyuvantes de grado agricola c.b.p. 100%.',
      ],
    ],
    [
      '4',
      'Primeros auxilios en caso de exposicion accidental',
      [
        'Inhalacion: Trasladar inmediatamente a la persona al aire fresco. Si presenta dificultad respiratoria, solicitar atencion medica urgente.',
        'Contacto dermal: Retirar ropa contaminada y lavar abundantemente la piel con agua y jabon neutro durante al menos 15 minutos.',
        'Contacto ocular: Enjuagar suavemente con agua limpia corriente durante 15 minutos manteniendo los parpados abiertos.',
        'Ingestion: No inducir el vomito a menos que lo indique el centro toxicologico. Llevar esta HDS o la etiqueta al medico.',
      ],
    ],
    [
      '5',
      'Medidas contra incendios',
      [
        'Medios de extincion apropiados: Espuma quimica seca, CO2, polvo quimico seco o niebla de agua. Evitar chorro directo de alto volumen.',
        'Equipo de proteccion para brigadistas: Equipo de respiracion autonomo (ERA) de presion positiva y traje encapsulado.',
      ],
    ],
    [
      '6',
      'Medidas que deben tomarse en caso de derrame o fuga accidental',
      [
        'Precauciones personales: Aislar el area, ventilar y utilizar Equipo de Proteccion Personal completo (Seccion 8).',
        'Contencion y limpieza: Absorber derrames liquidos con tierra seca, arena o vermiculita. Impedir que alcance drenajes o cuerpos de agua.',
      ],
    ],
    [
      '7',
      'Manejo y almacenamiento seguro',
      [
        `Manejo en campo: Respetar la dosis recomendada (${dosage}) y el intervalo de seguridad pre-cosecha (${interval}).`,
        'Almacenamiento: Conservar en su envase original cerrado, bajo llave, en bodega fresca, seca, ventilada y separada de alimentos o semillas.',
      ],
    ],
    [
      '8',
      'Controles de exposicion y Equipo de Proteccion Personal (EPP)',
      [
        'Proteccion respiratoria: Mascarilla con filtro para vapores organicos y neblinas de plaguicidas aprobada por NIOSH.',
        'Proteccion ocular y dermal: Goggles hermeticamente cerrados, guantes de nitrilo resistentes a quimicos, overol impermeable y botas de hule.',
      ],
    ],
    [
      '9',
      'Propiedades fisicas y quimicas',
      [
        `Estado fisico y formulacion: ${formulation}. Olor caracteristico.`,
        'Solubilidad / Miscibilidad: Emulsionable o dispersable en agua para caldo de aspersion agricola.',
      ],
    ],
    [
      '10',
      'Estabilidad y reactividad',
      [
        'Estabilidad quimica: Estable bajo condiciones normales de almacenamiento en envase original sellado.',
        'Incompatibilidad: Evitar mezcla con agentes fuertemente alcalinos o acidos concentrados sin prueba previa de compatibilidad.',
      ],
    ],
    [
      '11',
      'Informacion toxicologica',
      [
        `Categoria toxicologica COFEPRIS: ${hazard}.`,
        'Sintomas por sobreexposicion: Irritacion dermal u ocular, cefalea, nausea o mareo. Tratamiento sintomatico y de soporte.',
      ],
    ],
    [
      '12',
      'Informacion ecotoxicologica y proteccion ambiental',
      [
        'Precauciones ambientales: Evitar la deriva de aspersion hacia cuerpos de agua, canales de riego y colmenas.',
        'Proteccion a polinizadores: No aplicar durante la floracion activa ni en horas de pecoreo de abejas.',
      ],
    ],
    [
      '13',
      'Informacion relativa a la eliminacion de los productos y envases',
      [
        'Manejo de envases vacios: Realizar obligatoriamente el TRIPLE LAVADO del envase al agotar su contenido, perforar la base e inutilizarlo.',
        'Disposicion final: Entregar en el Centro de Acopio Temporal (CAT) del programa Campo Limpio / Amocali A.C.',
      ],
    ],
    [
      '14',
      'Informacion relativa al transporte (SCT / ONU)',
      [
        'Precaucion en transporte: Transportar separado de alimentos para consumo humano o animal, medicamentos y ropa.',
      ],
    ],
    [
      '15',
      'Informacion reglamentaria nacional',
      [
        'Normatividad aplicable en Mexico: NOM-232-SSA1-2009, NOM-018-STPS-2015, NOM-003-STPS-1999 (Actividades agricolas - Uso de insumos fitosanitarios).',
      ],
    ],
    [
      '16',
      'Otra informacion y descargo de responsabilidad',
      [
        'La informacion contenida en esta HDS resume los parametros técnicos registrados en el Sistema Nacional INIFAP Agrosystem y debe complementarse siempre con la etiqueta autorizada por COFEPRIS/SADER.',
      ],
    ],
  ];
};

const stampHdsFooters = (doc, productId) => {
  const pages = doc.bufferedPageRange();
  const totalPages = pages.count;

  for (let i = 0; i < totalPages; i += 1) {
    doc.switchToPage(pages.start + i);
    const prevBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const startX = doc.page.margins.left;
    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const footerY = doc.page.height - 32;

    doc.save();
    doc
      .moveTo(startX, footerY - 6)
      .lineTo(startX + contentWidth, footerY - 6)
      .strokeColor(COLORS.border)
      .lineWidth(0.6)
      .stroke();
    doc
      .fillColor(COLORS.subtle)
      .font('Courier')
      .fontSize(7.5)
      .text(
        `HDS / MSDS NOM-018-STPS-2015 · Insumo #${sanitizePdfText(productId, 'S/N')}`,
        startX,
        footerY,
        { width: contentWidth * 0.7, lineBreak: false },
      );
    doc
      .fillColor(COLORS.subtle)
      .font('Courier')
      .fontSize(7.5)
      .text(
        `Pagina ${i + 1} de ${totalPages}`,
        startX + contentWidth * 0.7,
        footerY,
        { width: contentWidth * 0.3, align: 'right', lineBreak: false },
      );
    doc.restore();
    doc.page.margins.bottom = prevBottom;
  }
};

export const generateProductHdsPdfBuffer = (detail) =>
  new Promise((resolve, reject) => {
    const product = detail?.product || {};
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: PAGE_MARGIN,
        bottom: 48,
        left: PAGE_MARGIN,
        right: PAGE_MARGIN,
      },
      bufferPages: true,
      info: {
        Title: `HDS / MSDS - ${sanitizePdfText(product.name, 'Insumo')}`,
        Author: 'INIFAP Agrosystem',
        Subject: 'Hoja de Datos de Seguridad NOM-018-STPS-2015',
      },
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHdsHeader(doc, product);
    buildSixteenSections(product).forEach(([secNum, title, lines]) => {
      drawHdsSection(doc, secNum, title, lines);
    });
    stampHdsFooters(doc, product.id);

    doc.end();
  });

export const sendProductHdsPdfResponse = async (
  res,
  detail,
  { download = true } = {},
) => {
  const pdfBuffer = await generateProductHdsPdfBuffer(detail);
  const filename = buildProductHdsFilename(detail?.product);
  const disposition = download ? 'attachment' : 'inline';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Length', pdfBuffer.length);
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${filename}"`,
  );
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).end(pdfBuffer);
};
