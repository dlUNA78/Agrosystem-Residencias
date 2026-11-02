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

export const buildProductPdfFilename = (product = {}) => {
  const slug = String(product.name || 'producto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const idPart = product.id ? `${product.id}-` : '';
  return `INIFAP-Ficha-Producto-${idPart}${slug || 'insumo'}.pdf`;
};

const getPageBox = (doc) => {
  const startX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  return { startX, contentWidth };
};

const ensureVerticalSpace = (doc, neededHeight = 72) => {
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > bottomLimit) {
    doc.addPage();
  }
};

const drawSectionHeading = (doc, stepNumber, title) => {
  ensureVerticalSpace(doc, 54);
  doc.moveDown(0.6);
  const { startX, contentWidth } = getPageBox(doc);
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

const resolveBannerBadge = (product, isPrivate) => {
  if (product?.isVerified) return 'AVAL INIFAP';
  return isPrivate ? 'USO INTERNO' : 'REGISTRO FITOSANITARIO';
};

const drawInstitutionalHeader = (doc, detail, isPrivate) => {
  const { product } = detail;
  const { startX, contentWidth } = getPageBox(doc);
  const bannerY = doc.page.margins.top;

  doc.save();
  doc.roundedRect(startX, bannerY, contentWidth, 64, 6).fill(COLORS.brand);
  doc
    .fillColor('#a7f3d0')
    .font('Courier-Bold')
    .fontSize(8)
    .text(
      'INIFAP - SISTEMA NACIONAL DE REGISTRO FITOSANITARIO Y AGROQUIMICOS',
      startX + 14,
      bannerY + 11,
      { width: contentWidth - 150 },
    );
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(
      sanitizePdfText(product?.name, 'Ficha tecnica de insumo'),
      startX + 14,
      bannerY + 24,
      { width: contentWidth - 155, lineBreak: false, ellipsis: true },
    );
  doc
    .fillColor('#d1fae5')
    .font('Courier')
    .fontSize(8.5)
    .text(
      `Ingrediente activo: ${sanitizePdfText(product?.active_ingredient, 'No especificado')}`,
      startX + 14,
      bannerY + 43,
      { width: contentWidth - 155, lineBreak: false, ellipsis: true },
    );

  doc
    .fillColor('#ffffff')
    .font('Courier-Bold')
    .fontSize(8.5)
    .text(
      `EXPEDIENTE #${sanitizePdfText(product?.id, 'S/N')}`,
      startX + contentWidth - 140,
      bannerY + 14,
      { width: 126, align: 'right' },
    );
  doc
    .fillColor('#d1fae5')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(
      resolveBannerBadge(product, isPrivate),
      startX + contentWidth - 140,
      bannerY + 30,
      { width: 126, align: 'right' },
    );
  doc.restore();
  doc.y = bannerY + 74;
};

const drawToxicologicalBand = (doc, detail) => {
  const hazard = detail?.product?.hazardTheme || {};
  const { startX, contentWidth } = getPageBox(doc);
  const topY = doc.y;
  const bg = hazard.pdfBg || '#f3f4f6';
  const ink = hazard.pdfInk || '#374151';

  doc.save();
  doc
    .roundedRect(startX, topY, contentWidth, 42, 5)
    .fillAndStroke(bg, COLORS.border);
  doc
    .fillColor(ink)
    .font('Courier-Bold')
    .fontSize(7.8)
    .text(
      'CLASIFICACION TOXICOLOGICA OFICIAL (NOM-232-SSA1-2009 / COFEPRIS)',
      startX + 12,
      topY + 8,
      { width: contentWidth - 24 },
    );
  doc
    .fillColor(ink)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(
      sanitizePdfText(hazard.fullLabel, 'Sin clasificacion capturada'),
      startX + 12,
      topY + 21,
      { width: contentWidth - 24 },
    );
  doc.restore();
  doc.y = topY + 48;
};

const drawKeyValueGrid = (doc, pairs) => {
  const { startX, contentWidth } = getPageBox(doc);
  const colGap = 10;
  const colWidth = (contentWidth - colGap) / 2;

  for (let i = 0; i < pairs.length; i += 2) {
    ensureVerticalSpace(doc, 42);
    const rowY = doc.y;
    const rowItems = pairs.slice(i, i + 2);
    rowItems.forEach((item, colIdx) => {
      const cellX = startX + colIdx * (colWidth + colGap);
      doc.save();
      doc
        .roundedRect(cellX, rowY, colWidth, 34, 4)
        .fillAndStroke(COLORS.surface, COLORS.border);
      doc
        .fillColor(COLORS.subtle)
        .font('Courier-Bold')
        .fontSize(7.2)
        .text(sanitizePdfText(item.label).toUpperCase(), cellX + 9, rowY + 6, {
          width: colWidth - 18,
          lineBreak: false,
        });
      doc
        .fillColor(COLORS.ink)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(
          sanitizePdfText(item.value, 'No especificado'),
          cellX + 9,
          rowY + 18,
          { width: colWidth - 18, lineBreak: false, ellipsis: true },
        );
      doc.restore();
    });
    doc.y = rowY + 40;
  }
};

const drawIdentitySection = (doc, product) => {
  drawSectionHeading(doc, 1, 'Identificacion comercial y registro sanitario');
  drawKeyValueGrid(doc, [
    { label: 'Nombre comercial', value: product.name },
    { label: 'Categoria agronomica', value: product.category },
    { label: 'Registro COFEPRIS / RSCO', value: product.registration_code },
    { label: 'Fabricante / Titular', value: product.manufacturer },
    { label: 'Ingrediente activo', value: product.active_ingredient },
    {
      label: 'Vigencia del registro',
      value: product.expiration?.formatted || 'Registro vigente',
    },
  ]);
};

const drawSpecsSection = (doc, product) => {
  drawSectionHeading(doc, 2, 'Parametros fitosanitarios y dosificacion');
  drawKeyValueGrid(doc, [
    {
      label: 'Mecanismo de accion',
      value: product.mode_of_action || 'No especificado',
    },
    {
      label: 'Tipo de formulacion',
      value: product.formulation_type || 'No especificada',
    },
    {
      label: 'Dosis sugerida en campo',
      value: product.suggested_dosage || 'No especificada',
    },
    {
      label: 'Intervalo de seguridad (carencia)',
      value: product.safetyInterval?.value || 'No especificado',
    },
  ]);
};

const drawIdentityAndSpecsSections = (doc, detail) => {
  const product = detail?.product || {};
  drawIdentitySection(doc, product);
  drawSpecsSection(doc, product);
};

const drawDescriptionSection = (doc, detail) => {
  const { product } = detail;
  drawSectionHeading(doc, 3, 'Descripcion tecnica y alcance agronomico');
  const { startX, contentWidth } = getPageBox(doc);

  doc
    .fillColor(COLORS.ink)
    .font('Helvetica')
    .fontSize(9.5)
    .text(
      sanitizePdfText(
        product?.descriptionText,
        'Sin descripcion tecnica detallada en el expediente.',
      ),
      startX,
      doc.y,
      { width: contentWidth, lineGap: 2.5 },
    );

  if (product?.target_crops) {
    doc.moveDown(0.5);
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica-Bold')
      .fontSize(8.8)
      .text(
        `Cultivos objetivo declarados en etiqueta: ${sanitizePdfText(product.target_crops)}`,
        startX,
        doc.y,
        { width: contentWidth },
      );
  }
};

const drawListSection = (doc, stepNumber, title, items, emptyMessage) => {
  drawSectionHeading(doc, stepNumber, title);
  const { startX, contentWidth } = getPageBox(doc);

  if (!Array.isArray(items) || items.length === 0) {
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica-Oblique')
      .fontSize(9)
      .text(sanitizePdfText(emptyMessage), startX, doc.y, {
        width: contentWidth,
      });
    return;
  }

  items.forEach((entry) => {
    ensureVerticalSpace(doc, 28);
    const scientific = entry.scientific_name
      ? ` (${sanitizePdfText(entry.scientific_name)})`
      : '';
    const category = entry.category
      ? ` - ${sanitizePdfText(entry.category)}`
      : '';
    doc
      .fillColor(COLORS.ink)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(
        `- ${sanitizePdfText(entry.name)}${scientific}${category}`,
        startX + 4,
        doc.y,
        { width: contentWidth - 8 },
      );
  });
};

const drawRegulatoryClosing = (doc, detail) => {
  ensureVerticalSpace(doc, 68);
  doc.moveDown(0.8);
  const { startX, contentWidth } = getPageBox(doc);
  const topY = doc.y;
  const verifier = sanitizePdfText(
    detail?.product?.verifiedByLabel,
    'Comite Tecnico INIFAP',
  );

  doc.save();
  doc
    .roundedRect(startX, topY, contentWidth, 48, 4)
    .fillAndStroke(COLORS.surface, COLORS.border);
  doc
    .fillColor(COLORS.brand)
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .text(`Dictamen tecnico: ${verifier}`, startX + 10, topY + 8, {
      width: contentWidth - 20,
    });
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(7.8)
    .text(
      'Aviso normativo: Antes de aplicar cualquier insumo fitosanitario verifique la etiqueta autorizada por COFEPRIS/SADER, respete estrictamente la dosis, el equipo de proteccion personal y el intervalo de seguridad pre-cosecha.',
      startX + 10,
      topY + 21,
      { width: contentWidth - 20, lineGap: 1.5 },
    );
  doc.restore();
  doc.y = topY + 54;
};

const stampPageFooters = (doc, productId) => {
  const pages = doc.bufferedPageRange();
  const totalPages = pages.count;

  for (let i = 0; i < totalPages; i += 1) {
    doc.switchToPage(pages.start + i);
    const { startX, contentWidth } = getPageBox(doc);
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
        `INIFAP Agrosystem - Ficha Fitosanitaria #${sanitizePdfText(productId, 'S/N')}`,
        startX,
        footerY,
        { width: contentWidth * 0.7, lineBreak: false },
      );
    doc
      .fillColor(COLORS.subtle)
      .font('Courier')
      .fontSize(7.8)
      .text(
        `Pagina ${i + 1} de ${totalPages}`,
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

export const generateProductPdfBuffer = (detail, { isPrivate = false } = {}) =>
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
        Title: `Ficha Fitosanitaria INIFAP - ${sanitizePdfText(detail?.product?.name, 'Producto')}`,
        Author: 'INIFAP Agrosystem',
        Subject: 'Ficha Tecnica y Seguridad Fitosanitaria',
      },
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawInstitutionalHeader(doc, detail, isPrivate);
    drawToxicologicalBand(doc, detail);
    drawIdentityAndSpecsSections(doc, detail);
    drawDescriptionSection(doc, detail);
    drawListSection(
      doc,
      4,
      'Plagas blanco controladas',
      detail?.relatedPlagues,
      'Sin plagas especificas vinculadas en el catalogo digital. Consulte etiqueta oficial.',
    );
    drawListSection(
      doc,
      5,
      'Cultivos autorizados',
      detail?.relatedCrops,
      'Sin cultivos especificos vinculados en el catalogo digital. Consulte registro CICOPLAFEST.',
    );
    drawRegulatoryClosing(doc, detail);
    stampPageFooters(doc, detail?.product?.id);

    doc.end();
  });

export const sendProductPdfResponse = async (
  res,
  detail,
  { download = false, isPrivate = false } = {},
) => {
  const pdfBuffer = await generateProductPdfBuffer(detail, { isPrivate });
  const filename = buildProductPdfFilename(detail?.product);
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
