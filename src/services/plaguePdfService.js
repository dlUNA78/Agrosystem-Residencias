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

export const buildPlaguePdfFilename = (plague = {}) => {
  const slug = String(plague.name || 'plaga')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const idPart = plague.id ? `${plague.id}-` : '';
  return `INIFAP-Expediente-Plaga-${idPart}${slug || 'ficha'}.pdf`;
};

const getRiskPalette = (riskLabel) => {
  if (riskLabel === 'Crítico' || riskLabel === 'Alto') {
    return { bg: COLORS.dangerBg, ink: COLORS.dangerInk };
  }
  if (riskLabel === 'Moderado' || riskLabel === 'Medio') {
    return { bg: COLORS.warnBg, ink: COLORS.warnInk };
  }
  return { bg: COLORS.okBg, ink: COLORS.okInk };
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
  const { plague } = detail;
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
      'INIFAP · SISTEMA NACIONAL DE VIGILANCIA FITOSANITARIA',
      startX + 14,
      bannerY + 12,
      { width: contentWidth - 150 },
    );
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(
      sanitizePdfText(plague.name, 'Expediente fitosanitario'),
      startX + 14,
      bannerY + 25,
      { width: contentWidth - 155, lineBreak: false, ellipsis: true },
    );

  const folioLabel = `EXPEDIENTE #${sanitizePdfText(plague.id, 'S/N')}`;
  const statusLabel = plague.isVerified
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
  const { plague, cycleSummary, incidenceRegions } = detail;
  const startX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const riskPalette = getRiskPalette(plague.riskLabel);
  const rowY = doc.y;

  doc
    .fillColor(COLORS.muted)
    .font('Helvetica-Oblique')
    .fontSize(10.5)
    .text(
      sanitizePdfText(
        plague.scientificName,
        'Nombre científico pendiente de registro',
      ),
      startX,
      rowY,
      { width: contentWidth - 140 },
    );

  doc.save();
  doc
    .roundedRect(startX + contentWidth - 130, rowY - 2, 130, 18, 9)
    .fill(riskPalette.bg);
  doc
    .fillColor(riskPalette.ink)
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .text(
      `RIESGO: ${sanitizePdfText(plague.riskLabel, 'Bajo').toUpperCase()}`,
      startX + contentWidth - 124,
      rowY + 3,
      { width: 118, align: 'center' },
    );
  doc.restore();

  doc.y = Math.max(doc.y, rowY + 22);

  const metaParts = [
    `Categoría: ${sanitizePdfText(plague.category, 'Sin categoría')}`,
    `Ciclo estimado: ${sanitizePdfText(cycleSummary?.totalDurationLabel, 'No especificado')}`,
    `Zonas con reporte: ${incidenceRegions.length}`,
    `Actualizado: ${sanitizePdfText(plague.updatedAt, 'Sin fecha')}`,
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
        plague.description,
        'Sin descripción general registrada en el expediente.',
      ),
      startX,
      doc.y,
      { width: contentWidth, lineGap: 2 },
    );
};

const drawHostCropsSection = (doc, relatedCrops) => {
  drawSectionHeading(doc, '01', 'Cultivos hospederos susceptibles');
  const startX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  if (!Array.isArray(relatedCrops) || relatedCrops.length === 0) {
    doc
      .fillColor(COLORS.subtle)
      .font('Helvetica-Oblique')
      .fontSize(9)
      .text(
        'Sin cultivos hospederos vinculados en este expediente.',
        startX,
        doc.y,
        {
          width: contentWidth,
        },
      );
    return;
  }

  const formatted = relatedCrops
    .map((crop) =>
      crop.scientificName
        ? `${sanitizePdfText(crop.name)} (${sanitizePdfText(crop.scientificName)})`
        : sanitizePdfText(crop.name),
    )
    .join('  •  ');

  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .text(formatted, startX, doc.y, { width: contentWidth, lineGap: 2 });
};

const drawBulletList = (doc, items, emptyMessage) => {
  const startX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  if (!Array.isArray(items) || items.length === 0) {
    doc
      .fillColor(COLORS.subtle)
      .font('Helvetica-Oblique')
      .fontSize(9)
      .text(emptyMessage, startX, doc.y, { width: contentWidth });
    return;
  }

  items.forEach((item) => {
    ensureVerticalSpace(doc, 26);
    doc
      .fillColor(COLORS.ink)
      .font('Helvetica')
      .fontSize(9.2)
      .text(`- ${sanitizePdfText(item)}`, startX + 4, doc.y, {
        width: contentWidth - 8,
        lineGap: 1.5,
      });
    doc.moveDown(0.2);
  });
};

const drawSymptomsSection = (doc, detail) => {
  drawSectionHeading(doc, '02', 'Diagnóstico clínico y síntomas observables');
  const items =
    detail.symptomItems?.length > 0
      ? detail.symptomItems
      : detail.plague.symptoms
        ? [detail.plague.symptoms]
        : [];
  drawBulletList(
    doc,
    items,
    'Sin sintomatología clínica registrada en este expediente.',
  );
};

const formatStageMetaLine = (stage) => {
  const tags = [];
  if (stage.duration) tags.push(`Duración: ${sanitizePdfText(stage.duration)}`);
  if (stage.plantZone)
    tags.push(`Zona vegetal: ${sanitizePdfText(stage.plantZone)}`);
  if (stage.damageLevel)
    tags.push(`Daño: ${sanitizePdfText(stage.damageLevel)}`);
  if (stage.isControlWindow) tags.push('VENTANA CRÍTICA DE CONTROL');
  return tags.join('  |  ');
};

const renderBiologicalStageRow = (doc, stage, startX, contentWidth) => {
  ensureVerticalSpace(doc, 62);
  const titleLine = `${sanitizePdfText(stage.step, '01')} · ${sanitizePdfText(stage.title, 'Etapa')}`;
  const metaLine = formatStageMetaLine(stage);

  doc
    .fillColor(COLORS.brand)
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .text(titleLine, startX + 4, doc.y, { width: contentWidth - 8 });

  if (metaLine) {
    doc
      .fillColor(COLORS.accent)
      .font('Courier-Bold')
      .fontSize(8)
      .text(metaLine, startX + 12, doc.y + 1, { width: contentWidth - 16 });
  }

  if (stage.description) {
    doc
      .fillColor(COLORS.ink)
      .font('Helvetica')
      .fontSize(9)
      .text(sanitizePdfText(stage.description), startX + 12, doc.y + 2, {
        width: contentWidth - 16,
      });
  }

  if (stage.recommendedAction) {
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica-Oblique')
      .fontSize(8.8)
      .text(
        `Acción sugerida: ${sanitizePdfText(stage.recommendedAction)}`,
        startX + 12,
        doc.y + 1,
        { width: contentWidth - 16 },
      );
  }
  doc.moveDown(0.45);
};

const drawBiologicalCycleSection = (doc, detail) => {
  drawSectionHeading(
    doc,
    '03',
    'Ciclo biológico y ventanas críticas de intervención',
  );
  const stages = detail.plague?.biologicalCycle || [];
  const startX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  if (stages.length === 0) {
    doc
      .fillColor(COLORS.subtle)
      .font('Helvetica-Oblique')
      .fontSize(9)
      .text('Sin etapas biológicas registradas.', startX, doc.y, {
        width: contentWidth,
      });
    return;
  }

  stages.forEach((stage) =>
    renderBiologicalStageRow(doc, stage, startX, contentWidth),
  );
};

const drawManagementSection = (doc, detail) => {
  drawSectionHeading(
    doc,
    '04',
    'Manejo Integrado de Plagas (MIP) y control biológico',
  );
  const startX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc
    .fillColor(COLORS.brand)
    .font('Helvetica-Bold')
    .fontSize(9.2)
    .text('Prácticas culturales, monitoreo y control:', startX, doc.y, {
      width: contentWidth,
    });
  doc.moveDown(0.2);

  const methodItems =
    detail.controlMethodItems?.length > 0
      ? detail.controlMethodItems
      : detail.plague.controlMethods
        ? [detail.plague.controlMethods]
        : [];
  drawBulletList(doc, methodItems, 'Sin métodos de control registrados.');

  doc.moveDown(0.35);
  ensureVerticalSpace(doc, 40);
  doc
    .fillColor(COLORS.brand)
    .font('Helvetica-Bold')
    .fontSize(9.2)
    .text('Agentes benéficos y control biológico:', startX, doc.y, {
      width: contentWidth,
    });
  doc.moveDown(0.2);

  const bioItems =
    detail.biologicalAgents?.length > 0
      ? detail.biologicalAgents
      : detail.plague.biologicalControl
        ? [detail.plague.biologicalControl]
        : [];
  drawBulletList(
    doc,
    bioItems,
    'Sin agentes de control biológico registrados.',
  );
};

const drawProductsSection = (doc, relatedProducts) => {
  drawSectionHeading(doc, '05', 'Insumos fitosanitarios relacionados');
  const startX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  if (!Array.isArray(relatedProducts) || relatedProducts.length === 0) {
    doc
      .fillColor(COLORS.subtle)
      .font('Helvetica-Oblique')
      .fontSize(9)
      .text(
        'Sin productos fitosanitarios vinculados a este expediente.',
        startX,
        doc.y,
        {
          width: contentWidth,
        },
      );
    return;
  }

  relatedProducts.forEach((product) => {
    ensureVerticalSpace(doc, 32);
    const ingredient = sanitizePdfText(
      product.activeIngredient,
      'Ingrediente activo no especificado',
    );
    const category = sanitizePdfText(product.category, 'Insumo');
    const validation = product.isValidated ? 'Validado INIFAP' : 'Relacionado';
    doc
      .fillColor(COLORS.ink)
      .font('Helvetica-Bold')
      .fontSize(9.2)
      .text(`- ${sanitizePdfText(product.name)}`, startX + 4, doc.y, {
        width: contentWidth - 8,
      });
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(8.5)
      .text(
        `  Ingrediente activo: ${ingredient}  |  Categoría: ${category}  |  ${validation}`,
        startX + 8,
        doc.y,
        { width: contentWidth - 12 },
      );
    doc.moveDown(0.25);
  });
};

const formatRegionItem = (region) => {
  const coords = region.hasCoords ? ` (${region.lat}, ${region.lng})` : '';
  return `${sanitizePdfText(region.name)} - Riesgo ${sanitizePdfText(region.riskLabel, 'Bajo')}${coords}`;
};

const drawDistributionAndValidationSection = (doc, detail) => {
  drawSectionHeading(
    doc,
    '06',
    'Distribución territorial y aval técnico institucional',
  );
  const startX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const regionItems = (detail.incidenceRegions || []).map(formatRegionItem);

  drawBulletList(
    doc,
    regionItems,
    'Sin regiones fitosanitarias vinculadas en este momento.',
  );

  ensureVerticalSpace(doc, 68);
  doc.moveDown(0.5);
  const boxY = doc.y;
  doc
    .save()
    .roundedRect(startX, boxY, contentWidth, 52, 5)
    .fillAndStroke(COLORS.surface, COLORS.border);

  const validator = detail.plague.isVerified
    ? sanitizePdfText(detail.plague.verifiedBy, 'Especialista INIFAP')
    : 'Pendiente de asignación';
  const verifiedDate = sanitizePdfText(detail.plague.verifiedAt, 'Sin fecha');
  const updatedDate = sanitizePdfText(detail.plague.updatedAt, 'Sin fecha');

  doc
    .fillColor(COLORS.brand)
    .font('Helvetica-Bold')
    .fontSize(8.8)
    .text(
      'RESPALDO TÉCNICO INSTITUCIONAL · INIFAP CAMPO EXPERIMENTAL',
      startX + 12,
      boxY + 10,
      { width: contentWidth - 24 },
    );
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(8.5)
    .text(
      `Especialista validador: ${validator}   |   Fecha de validación: ${verifiedDate}   |   Última actualización: ${updatedDate}`,
      startX + 12,
      boxY + 26,
      { width: contentWidth - 24 },
    );
  doc.restore();
  doc.y = boxY + 60;
};

const stampPageFooters = (doc, plagueId) => {
  const range = doc.bufferedPageRange();
  const totalPages = range.count;

  for (let i = 0; i < totalPages; i += 1) {
    doc.switchToPage(range.start + i);
    const startX = doc.page.margins.left;
    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const footerY = doc.page.height - 34;

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
        `INIFAP Agrosystem · Ficha Técnica Fitosanitaria #${sanitizePdfText(plagueId, 'S/N')}`,
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

export const generatePlaguePdfBuffer = (detail, { isPrivate = false } = {}) =>
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
        Title: `Ficha Técnica INIFAP - ${sanitizePdfText(detail?.plague?.name, 'Plaga')}`,
        Author: 'INIFAP Agrosystem',
        Subject: 'Expediente Técnico Fitosanitario',
      },
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawInstitutionalHeader(doc, detail, isPrivate);
    drawIdentitySummary(doc, detail);
    drawHostCropsSection(doc, detail.relatedCrops);
    drawSymptomsSection(doc, detail);
    drawBiologicalCycleSection(doc, detail);
    drawManagementSection(doc, detail);
    drawProductsSection(doc, detail.relatedProducts);
    drawDistributionAndValidationSection(doc, detail);
    stampPageFooters(doc, detail?.plague?.id);

    doc.end();
  });

export const sendPlaguePdfResponse = async (
  res,
  detail,
  { download = false, isPrivate = false } = {},
) => {
  const pdfBuffer = await generatePlaguePdfBuffer(detail, { isPrivate });
  const filename = buildPlaguePdfFilename(detail?.plague);
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
