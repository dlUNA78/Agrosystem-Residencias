import PDFDocument from 'pdfkit';

const COLORS = Object.freeze({
  brand: '#1b4332',
  brandSoft: '#e8f3ee',
  accent: '#2d6a4f',
  ink: '#111827',
  muted: '#4b5563',
  subtle: '#6b7280',
  border: '#d1d5db',
  surface: '#f9fafb',
  dangerBg: '#ffe4e6',
  dangerInk: '#9f1239',
  warnBg: '#fef3c7',
  warnInk: '#92400e',
  okBg: '#d1fae5',
  okInk: '#065f46',
});

const PAGE_MARGIN = 44;

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

export const buildCropPdfFilename = (crop = {}) => {
  const slug = String(crop.commonName || crop.name || 'cultivo')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const idPart = crop.id ? `${crop.id}-` : '';
  return `INIFAP-Ficha-Cultivo-${idPart}${slug || 'expediente'}.pdf`;
};

const ensureVerticalSpace = (doc, neededHeight = 72) => {
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > bottomLimit) {
    doc.addPage();
  }
};

const drawSectionHeading = (doc, stepNumber, title) => {
  ensureVerticalSpace(doc, 54);
  doc.moveDown(0.7);
  const startX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const topY = doc.y;

  doc.save();
  doc.roundedRect(startX, topY, contentWidth, 22, 4).fill(COLORS.brandSoft);
  doc
    .fillColor(COLORS.brand)
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .text(
      `${stepNumber}. ${sanitizePdfText(title).toUpperCase()}`,
      startX + 10,
      topY + 6,
      { width: contentWidth - 20 },
    );
  doc.restore();
  doc.y = topY + 28;
};

const drawInstitutionalHeader = (doc, detail, isPrivate) => {
  const { crop } = detail;
  const startX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const bannerY = doc.page.margins.top;

  doc.save();
  doc.roundedRect(startX, bannerY, contentWidth, 58, 6).fill(COLORS.brand);
  doc
    .fillColor('#a7f3d0')
    .font('Courier-Bold')
    .fontSize(8)
    .text(
      'INIFAP · SISTEMA NACIONAL DE INFORMACIÓN AGRONÓMICA',
      startX + 14,
      bannerY + 12,
      { width: contentWidth - 150 },
    );
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(
      sanitizePdfText(crop.commonName || crop.name, 'Ficha técnica de cultivo'),
      startX + 14,
      bannerY + 25,
      { width: contentWidth - 155, lineBreak: false, ellipsis: true },
    );

  const folioLabel = `EXPEDIENTE #${sanitizePdfText(crop.id, 'S/N')}`;
  const statusLabel = crop.isVerified
    ? 'AVAL INIFAP'
    : isPrivate
      ? 'USO INTERNO'
      : 'CATÁLOGO OFICIAL';

  doc
    .fillColor('#ffffff')
    .font('Courier-Bold')
    .fontSize(8.5)
    .text(folioLabel, startX + contentWidth - 140, bannerY + 14, {
      width: 126,
      align: 'right',
    });
  doc
    .fillColor('#d1fae5')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(statusLabel, startX + contentWidth - 140, bannerY + 30, {
      width: 126,
      align: 'right',
    });
  doc.restore();

  doc.y = bannerY + 68;
};

const drawIdentitySummary = (doc, detail) => {
  const { crop, kpis } = detail;
  const startX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const rowY = doc.y;

  doc
    .fillColor(COLORS.muted)
    .font('Helvetica-Oblique')
    .fontSize(10.5)
    .text(
      sanitizePdfText(
        crop.scientificName,
        'Nombre científico pendiente de registro',
      ),
      startX,
      rowY,
      { width: contentWidth - 140 },
    );

  doc.save();
  doc
    .roundedRect(startX + contentWidth - 130, rowY - 2, 130, 18, 9)
    .fill(COLORS.brandSoft);
  doc
    .fillColor(COLORS.brand)
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .text(
      sanitizePdfText(crop.category, 'Agrícola').toUpperCase(),
      startX + contentWidth - 124,
      rowY + 3,
      { width: 118, align: 'center' },
    );
  doc.restore();

  doc.y = Math.max(doc.y, rowY + 22);

  const metaParts = [
    `Familia: ${sanitizePdfText(crop.botanicalFamily, 'No especificada')}`,
    `Ciclo: ${sanitizePdfText(kpis?.cycle, 'No documentado')}`,
    `Temporada: ${sanitizePdfText(kpis?.season, 'No documentada')}`,
    `Rendimiento: ${sanitizePdfText(kpis?.yield, 'No documentado')}`,
  ];

  doc
    .fillColor(COLORS.subtle)
    .font('Helvetica')
    .fontSize(8.5)
    .text(metaParts.join('   |   '), startX, doc.y, { width: contentWidth });

  doc.moveDown(0.5);
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica')
    .fontSize(9.5)
    .text(
      sanitizePdfText(
        crop.description,
        'Sin descripción general registrada en el expediente.',
      ),
      startX,
      doc.y,
      { width: contentWidth, lineGap: 2 },
    );
};

const drawDataRow = (doc, label, value, x, y, width) => {
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .text(label, x, y, { width: 130 });
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica')
    .fontSize(8.5)
    .text(sanitizePdfText(value, 'No documentado'), x + 135, y, {
      width: width - 135,
    });
};

const drawAgroclimaticSection = (doc, detail) => {
  drawSectionHeading(doc, '01', 'Requerimientos agroclimáticos y edafológicos');
  const startX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const { crop } = detail;

  const colWidth = (contentWidth - 16) / 2;
  const leftX = startX;
  const rightX = startX + colWidth + 16;
  const startY = doc.y;

  drawDataRow(
    doc,
    'Clima óptimo:',
    crop.optimal_climate,
    leftX,
    startY,
    colWidth,
  );
  drawDataRow(
    doc,
    'Temperatura:',
    crop.temperatureRange,
    leftX,
    startY + 16,
    colWidth,
  );
  drawDataRow(
    doc,
    'Precipitación:',
    crop.rainfallRange,
    leftX,
    startY + 32,
    colWidth,
  );
  drawDataRow(
    doc,
    'Humedad relativa:',
    crop.humidity,
    leftX,
    startY + 48,
    colWidth,
  );

  drawDataRow(
    doc,
    'Tipo de suelo:',
    crop.soilSummary,
    rightX,
    startY,
    colWidth,
  );
  drawDataRow(
    doc,
    'Rango de pH:',
    crop.ph_range,
    rightX,
    startY + 16,
    colWidth,
  );
  drawDataRow(
    doc,
    'Materia orgánica:',
    crop.organic_matter,
    rightX,
    startY + 32,
    colWidth,
  );
  drawDataRow(doc, 'Drenaje:', crop.drainage, rightX, startY + 48, colWidth);

  doc.y = startY + 68;
};

const drawManagementSection = (doc, detail) => {
  drawSectionHeading(doc, '02', 'Establecimiento y manejo agronómico');
  const startX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const { crop, calendar } = detail;

  const colWidth = (contentWidth - 16) / 2;
  const leftX = startX;
  const rightX = startX + colWidth + 16;
  const startY = doc.y;

  drawDataRow(
    doc,
    'Temporada:',
    crop.season || crop.planting_season,
    leftX,
    startY,
    colWidth,
  );
  drawDataRow(
    doc,
    'Densidad de siembra:',
    crop.planting_density,
    leftX,
    startY + 16,
    colWidth,
  );
  drawDataRow(
    doc,
    'Profundidad de siembra:',
    crop.planting_depth,
    leftX,
    startY + 32,
    colWidth,
  );
  drawDataRow(
    doc,
    'Sistema de riego:',
    crop.irrigation_type,
    leftX,
    startY + 48,
    colWidth,
  );

  drawDataRow(
    doc,
    'Requerimiento hídrico:',
    crop.water_requirements || crop.water_requirement,
    rightX,
    startY,
    colWidth,
  );
  drawDataRow(
    doc,
    'Exposición solar:',
    crop.sunlight_requirement,
    rightX,
    startY + 16,
    colWidth,
  );
  drawDataRow(
    doc,
    'Poda de manejo:',
    crop.requiresPruningLabel,
    rightX,
    startY + 32,
    colWidth,
  );
  drawDataRow(
    doc,
    'Polinización:',
    crop.pollination_type,
    rightX,
    startY + 48,
    colWidth,
  );

  let currentY = startY + 68;

  if (calendar.hasCalendar) {
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text('Calendario estimado:', leftX, currentY, { width: 130 });
    doc
      .fillColor(COLORS.ink)
      .font('Helvetica')
      .fontSize(8.5)
      .text(calendar.description, leftX + 135, currentY, {
        width: contentWidth - 135,
      });
    currentY += 22;
  }

  if (crop.fertilization || crop.nutrients) {
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .text('Nutrición y abono:', leftX, currentY, { width: 130 });
    doc
      .fillColor(COLORS.ink)
      .font('Helvetica')
      .fontSize(8.5)
      .text(
        sanitizePdfText(crop.fertilization || crop.nutrients),
        leftX + 135,
        currentY,
        { width: contentWidth - 135, lineGap: 1.5 },
      );
    currentY = doc.y + 8;
  }

  doc.y = currentY;
};

const drawPlaguesSection = (doc, plagues = []) => {
  drawSectionHeading(doc, '03', 'Sanidad fitosanitaria y plagas monitoreadas');
  const startX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  if (!Array.isArray(plagues) || plagues.length === 0) {
    doc
      .fillColor(COLORS.subtle)
      .font('Helvetica-Oblique')
      .fontSize(9)
      .text(
        'Sin plagas registradas con afectación directa para este cultivo.',
        startX,
        doc.y,
        {
          width: contentWidth,
        },
      );
    return;
  }

  const entries = plagues.slice(0, 8);
  entries.forEach((plague) => {
    ensureVerticalSpace(doc, 22);
    const itemY = doc.y;
    doc
      .fillColor(COLORS.brand)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(`• ${sanitizePdfText(plague.name)}`, startX + 6, itemY, {
        width: contentWidth * 0.45,
      });

    if (plague.scientificName) {
      doc
        .fillColor(COLORS.muted)
        .font('Helvetica-Oblique')
        .fontSize(8.5)
        .text(
          `(${sanitizePdfText(plague.scientificName)})`,
          startX + contentWidth * 0.46,
          itemY,
          {
            width: contentWidth * 0.34,
          },
        );
    }

    doc
      .fillColor(COLORS.ink)
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(
        `Riesgo ${sanitizePdfText(plague.riskLabel)}`,
        startX + contentWidth * 0.82,
        itemY,
        {
          width: contentWidth * 0.18,
          align: 'right',
        },
      );

    doc.y = itemY + 16;
  });

  if (plagues.length > 8) {
    doc
      .fillColor(COLORS.subtle)
      .font('Helvetica-Oblique')
      .fontSize(8)
      .text(
        `y ${plagues.length - 8} plagas adicionales registradas en el catálogo.`,
        startX + 10,
        doc.y,
      );
  }
};

const drawProductsSection = (doc, products = []) => {
  drawSectionHeading(doc, '04', 'Agroquímicos e insumos autorizados');
  const startX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  if (!Array.isArray(products) || products.length === 0) {
    doc
      .fillColor(COLORS.subtle)
      .font('Helvetica-Oblique')
      .fontSize(9)
      .text(
        'Sin insumos agroquímicos vinculados directamente.',
        startX,
        doc.y,
        {
          width: contentWidth,
        },
      );
    return;
  }

  const entries = products.slice(0, 8);
  entries.forEach((product) => {
    ensureVerticalSpace(doc, 22);
    const itemY = doc.y;
    doc
      .fillColor(COLORS.brand)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(`• ${sanitizePdfText(product.name)}`, startX + 6, itemY, {
        width: contentWidth * 0.45,
      });

    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(8.5)
      .text(
        sanitizePdfText(
          product.activeIngredient,
          'Ingrediente no especificado',
        ),
        startX + contentWidth * 0.46,
        itemY,
        {
          width: contentWidth * 0.34,
        },
      );

    doc
      .fillColor(COLORS.subtle)
      .font('Helvetica')
      .fontSize(8)
      .text(
        sanitizePdfText(product.category, 'Insumo'),
        startX + contentWidth * 0.82,
        itemY,
        {
          width: contentWidth * 0.18,
          align: 'right',
        },
      );

    doc.y = itemY + 16;
  });
};

const drawDistributionAndValidationSection = (doc, detail) => {
  drawSectionHeading(doc, '05', 'Distribución geográfica y validación');
  const startX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const { crop } = detail;

  const colWidth = (contentWidth - 16) / 2;
  const leftX = startX;
  const rightX = startX + colWidth + 16;
  const startY = doc.y;

  drawDataRow(
    doc,
    'Estados/Regiones:',
    crop.state || crop.region,
    leftX,
    startY,
    colWidth,
  );
  drawDataRow(
    doc,
    'Altitud de adaptación:',
    crop.altitudeRange,
    leftX,
    startY + 16,
    colWidth,
  );

  const validationLabel = crop.isVerified
    ? `Verificado por ${crop.verifiedBy || 'Especialista INIFAP'} (${crop.verifiedAt || 'Fecha registrada'})`
    : 'Expediente técnico en proceso de verificación';

  drawDataRow(
    doc,
    'Validación institucional:',
    validationLabel,
    rightX,
    startY,
    colWidth,
  );
  drawDataRow(
    doc,
    'Última actualización:',
    crop.updatedAt,
    rightX,
    startY + 16,
    colWidth,
  );

  doc.y = startY + 40;
};

const stampPageFooters = (doc, cropId) => {
  const range = doc.bufferedPageRange();
  const totalPages = range.count;

  for (let i = 0; i < totalPages; i += 1) {
    doc.switchToPage(i);
    const startX = doc.page.margins.left;
    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const footerY = doc.page.height - doc.page.margins.bottom + 18;

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
      .fontSize(7.8)
      .text(
        `INIFAP Agrosystem · Ficha Técnica de Cultivo #${sanitizePdfText(cropId, 'S/N')}`,
        startX,
        footerY,
        { width: contentWidth * 0.7, lineBreak: false },
      );
    doc
      .fillColor(COLORS.subtle)
      .font('Courier')
      .fontSize(7.8)
      .text(
        `Página ${i + 1} de ${totalPages}`,
        startX + contentWidth * 0.7,
        footerY,
        {
          width: contentWidth * 0.3,
          align: 'right',
          lineBreak: false,
        },
      );
    doc.restore();
  }
};

export const generateCropPdfBuffer = (detail, { isPrivate = false } = {}) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: PAGE_MARGIN,
        bottom: 52,
        left: PAGE_MARGIN,
        right: PAGE_MARGIN,
      },
      bufferPages: true,
      info: {
        Title: `Ficha Técnica INIFAP - ${sanitizePdfText(detail?.crop?.commonName || detail?.crop?.name, 'Cultivo')}`,
        Author: 'INIFAP Agrosystem',
        Subject: 'Ficha Técnica Agronómica',
      },
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawInstitutionalHeader(doc, detail, isPrivate);
    drawIdentitySummary(doc, detail);
    drawAgroclimaticSection(doc, detail);
    drawManagementSection(doc, detail);
    drawPlaguesSection(doc, detail.plagues);
    drawProductsSection(doc, detail.products);
    drawDistributionAndValidationSection(doc, detail);
    stampPageFooters(doc, detail?.crop?.id);

    doc.end();
  });

export const sendCropPdfResponse = async (
  res,
  detail,
  { download = false, isPrivate = false } = {},
) => {
  const pdfBuffer = await generateCropPdfBuffer(detail, { isPrivate });
  const filename = buildCropPdfFilename(detail?.crop);
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
