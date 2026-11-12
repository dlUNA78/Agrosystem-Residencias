import PDFDocument from 'pdfkit';

const COLORS = Object.freeze({
  brand: '#1b4332',
  brandMuted: '#2d6a4f',
  ink: '#0f172a',
  muted: '#334155',
  subtle: '#64748b',
  border: '#cbd5e1',
  borderLight: '#e2e8f0',
  surface: '#ffffff',
  headerBg: '#f8fafc',
  alertInk: '#991b1b',
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

export const buildOperationalReportPdfFilename = (period = 'mensual') => {
  const safePeriod = String(period || 'mensual')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');
  const datePart = new Date().toISOString().slice(0, 10);
  return `INIFAP-Reporte-Operativo-${safePeriod}-${datePart}.pdf`;
};

const getPageBox = (doc) => {
  const startX = doc.page.margins.left;
  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  return { startX, contentWidth };
};

const ensureVerticalSpace = (doc, neededHeight = 72) => {
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 24;
  if (doc.y + neededHeight > bottomLimit) {
    doc.addPage();
  }
};

const drawSectionTitle = (doc, indexLabel, title) => {
  ensureVerticalSpace(doc, 48);
  doc.moveDown(0.6);
  const { startX, contentWidth } = getPageBox(doc);
  const topY = doc.y;

  doc.save();
  doc
    .fillColor(COLORS.brand)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(
      `${indexLabel}. ${sanitizePdfText(title).toUpperCase()}`,
      startX,
      topY,
      { width: contentWidth },
    );

  doc
    .moveTo(startX, topY + 15)
    .lineTo(startX + contentWidth, topY + 15)
    .strokeColor(COLORS.border)
    .lineWidth(0.75)
    .stroke();
  doc.restore();
  doc.y = topY + 24;
};

const drawHeaderBanner = (doc, data, user) => {
  const { startX, contentWidth } = getPageBox(doc);
  const bannerY = doc.page.margins.top;
  const periodLabel = sanitizePdfText(
    data?.query?.period,
    'mensual',
  ).toUpperCase();
  const operatorName = sanitizePdfText(
    user?.full_name || user?.email,
    'Personal Técnico INIFAP',
  );
  const emittedAt = new Date().toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  doc.save();
  // Regla superior institucional
  doc.rect(startX, bannerY, contentWidth, 3).fill(COLORS.brand);

  // Títulos institucionales
  doc
    .fillColor(COLORS.brand)
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(
      'INSTITUTO NACIONAL DE INVESTIGACIONES FORESTALES, AGRICOLAS Y PECUARIAS',
      startX,
      bannerY + 10,
      { width: contentWidth - 170 },
    );
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(
      'Resumen Ejecutivo de Operacion Fitosanitaria',
      startX,
      bannerY + 24,
      { width: contentWidth - 170 },
    );
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(8)
    .text(
      'Sistema Nacional de Informacion y Trazabilidad Fitosanitaria - INIFAP Agrosystem',
      startX,
      bannerY + 44,
      { width: contentWidth - 170 },
    );

  // Cuadro formal de metadatos a la derecha
  const metaBoxWidth = 160;
  const metaBoxX = startX + contentWidth - metaBoxWidth;
  doc
    .roundedRect(metaBoxX, bannerY + 10, metaBoxWidth, 48, 4)
    .fillAndStroke(COLORS.headerBg, COLORS.border);

  doc
    .fillColor(COLORS.subtle)
    .font('Helvetica-Bold')
    .fontSize(7)
    .text('PERIODO OPERATIVO:', metaBoxX + 8, bannerY + 16);
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .text(periodLabel, metaBoxX + 90, bannerY + 15, {
      width: 62,
      align: 'right',
    });

  doc
    .fillColor(COLORS.subtle)
    .font('Helvetica-Bold')
    .fontSize(7)
    .text('FECHA DE EMISION:', metaBoxX + 8, bannerY + 28);
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica')
    .fontSize(8)
    .text(sanitizePdfText(emittedAt), metaBoxX + 80, bannerY + 28, {
      width: 72,
      align: 'right',
    });

  doc
    .fillColor(COLORS.subtle)
    .font('Helvetica-Bold')
    .fontSize(7)
    .text('RESPONSABLE:', metaBoxX + 8, bannerY + 40);
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica')
    .fontSize(7.5)
    .text(operatorName, metaBoxX + 68, bannerY + 40, {
      width: 84,
      align: 'right',
      ellipsis: true,
    });

  doc.restore();
  doc.y = bannerY + 68;
};

const drawKpiCards = (doc, rawKpis) => {
  const kpis = rawKpis || {};
  const { startX, contentWidth } = getPageBox(doc);
  const gap = 8;
  const cardWidth = (contentWidth - gap * 3) / 4;
  const topY = doc.y;

  const items = [
    [
      'PLAGAS REPORTADAS',
      String(kpis.reportedPlagues ?? 0),
      'Incidencias fitosanitarias',
    ],
    [
      'APLICACIONES',
      String(kpis.chemicalApplications ?? 0),
      sanitizePdfText(kpis.formattedHectares, '0 ha tratadas'),
    ],
    ['PREDIOS ACTIVOS', String(kpis.monitoredFarms ?? 0), 'Bajo monitoreo'],
    ['ALERTAS CRITICAS', String(kpis.criticalAlerts ?? 0), 'Prioridad alta'],
  ];

  items.forEach(([label, value, sub], index) => {
    const x = startX + index * (cardWidth + gap);
    const isAlert = index === 3 && Number(kpis.criticalAlerts) > 0;
    doc.save();
    doc
      .roundedRect(x, topY, cardWidth, 54, 4)
      .fillAndStroke(COLORS.surface, COLORS.border);

    doc
      .fillColor(COLORS.subtle)
      .font('Helvetica-Bold')
      .fontSize(7)
      .text(label, x + 8, topY + 8, { width: cardWidth - 16 });
    doc
      .fillColor(isAlert ? COLORS.alertInk : COLORS.ink)
      .font('Helvetica-Bold')
      .fontSize(15)
      .text(value, x + 8, topY + 20, { width: cardWidth - 16 });
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(7)
      .text(sub, x + 8, topY + 39, { width: cardWidth - 16 });
    doc.restore();
  });

  doc.y = topY + 64;
};

const drawDistributionsSection = (doc, data) => {
  drawSectionTitle(doc, '1', 'Comportamiento Mensual y Categorias de Insumos');
  const { startX, contentWidth } = getPageBox(doc);

  const months = data.monthlyApplications || [];
  const monthLine = months.length
    ? months
        .map((m) => `${sanitizePdfText(m.label)}: ${m.count} aplicacion(es)`)
        .join('   |   ')
    : 'Sin registros mensuales disponibles.';

  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('Historico reciente por mes:', startX, doc.y);
  doc
    .fillColor(COLORS.muted)
    .font('Courier')
    .fontSize(8.5)
    .text(monthLine, startX, doc.y + 3, { width: contentWidth });
  doc.moveDown(0.6);

  const types = data.productDistribution?.types || [];
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('Distribucion por categoria de agroquimico:', startX, doc.y);

  if (!types.length) {
    doc
      .fillColor(COLORS.subtle)
      .font('Helvetica')
      .fontSize(8.5)
      .text('No se registraron aplicaciones clasificadas en este periodo.');
    return;
  }

  types.forEach((item) => {
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(8.5)
      .text(
        `- ${sanitizePdfText(item.name)}: ${item.count} aplicacion(es) (${item.percentage}%)`,
        startX + 8,
        doc.y + 2,
      );
  });
};

const drawPlaguesAndFarmsSection = (doc, data) => {
  drawSectionTitle(
    doc,
    '2',
    'Vigilancia de Plagas y Predios con Mayor Actividad',
  );
  const { startX, contentWidth } = getPageBox(doc);

  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('Principales incidencias fitosanitarias:', startX, doc.y);

  const plagues = data.topPlagues || [];
  if (!plagues.length) {
    doc
      .fillColor(COLORS.subtle)
      .font('Helvetica')
      .fontSize(8.5)
      .text('Sin reportes fitosanitarios en el periodo evaluado.');
  } else {
    plagues.forEach((plague, idx) => {
      doc
        .fillColor(COLORS.muted)
        .font('Helvetica')
        .fontSize(8.5)
        .text(
          `${idx + 1}. ${sanitizePdfText(plague.name)} - ${plague.count} reporte(s) (${plague.percentage}% relativo)`,
          startX + 8,
          doc.y + 2,
          { width: contentWidth - 16 },
        );
    });
  }

  doc.moveDown(0.6);
  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('Predios monitoreados destacados:', startX, doc.y);

  const farms = data.activeFarms || [];
  if (!farms.length) {
    doc
      .fillColor(COLORS.subtle)
      .font('Helvetica')
      .fontSize(8.5)
      .text('No existen predios activos registrados en el alcance actual.');
    return;
  }

  farms.forEach((farm) => {
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(8.5)
      .text(
        `- ${sanitizePdfText(farm.name)} (${sanitizePdfText(farm.municipality)}, ${farm.sizeHectares} ha) -> ${sanitizePdfText(farm.alertBadgeText)}`,
        startX + 8,
        doc.y + 2,
        { width: contentWidth - 16 },
      );
  });
};

const drawApplicationsTable = (doc, applications = []) => {
  drawSectionTitle(doc, '3', 'Bitacora Reciente de Aplicaciones en Campo');
  const { startX, contentWidth } = getPageBox(doc);

  if (!applications.length) {
    doc
      .fillColor(COLORS.subtle)
      .font('Helvetica')
      .fontSize(8.5)
      .text(
        'No se registraron aplicaciones de insumos en el periodo consultado.',
        startX,
        doc.y,
      );
    return;
  }

  const cols = [72, 115, 115, 78, contentWidth - 380];
  const headers = ['FECHA', 'PREDIO', 'INSUMO', 'DOSIS', 'TÉCNICO RESPONSABLE'];
  const headerY = doc.y;

  doc.save();
  doc
    .rect(startX, headerY, contentWidth, 20)
    .fillAndStroke(COLORS.headerBg, COLORS.borderLight);
  let cursorX = startX + 6;
  headers.forEach((h, idx) => {
    doc
      .fillColor(COLORS.subtle)
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .text(h, cursorX, headerY + 6, { width: cols[idx] - 8 });
    cursorX += cols[idx];
  });
  doc.restore();
  doc.y = headerY + 22;

  applications.slice(0, 12).forEach((app) => {
    ensureVerticalSpace(doc, 22);
    const rowY = doc.y;
    const values = [
      sanitizePdfText(app.formattedDate),
      sanitizePdfText(app.farmName),
      sanitizePdfText(app.productName),
      sanitizePdfText(app.doseText),
      sanitizePdfText(app.technicianName),
    ];

    let colX = startX + 6;
    values.forEach((val, idx) => {
      doc
        .fillColor(COLORS.ink)
        .font('Helvetica')
        .fontSize(8)
        .text(val, colX, rowY + 3, {
          width: cols[idx] - 8,
          lineBreak: false,
          ellipsis: true,
        });
      colX += cols[idx];
    });

    doc
      .moveTo(startX, rowY + 16)
      .lineTo(startX + contentWidth, rowY + 16)
      .strokeColor(COLORS.borderLight)
      .lineWidth(0.5)
      .stroke();
    doc.y = rowY + 18;
  });
};

const drawFooters = (doc) => {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const prevBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const { startX, contentWidth } = getPageBox(doc);
    const footerY = doc.page.height - 28;
    doc
      .fillColor(COLORS.subtle)
      .font('Helvetica')
      .fontSize(7.5)
      .text(
        `INIFAP · Documento Técnico Oficial emitido por Agrosystem · Página ${i + 1} de ${range.count}`,
        startX,
        footerY,
        { width: contentWidth, align: 'center', lineBreak: false },
      );
    doc.page.margins.bottom = prevBottom;
  }
};

export const buildOperationalReportPdfBuffer = (data, user = null) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: PAGE_MARGIN,
        bottom: PAGE_MARGIN,
        left: PAGE_MARGIN,
        right: PAGE_MARGIN,
      },
      bufferPages: true,
      info: {
        Title: 'Resumen Ejecutivo Operativo Fitosanitario - INIFAP',
        Author: 'INIFAP Agrosystem',
      },
    });

    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    drawHeaderBanner(doc, data, user);
    drawKpiCards(doc, data?.kpis);
    drawDistributionsSection(doc, data || {});
    drawPlaguesAndFarmsSection(doc, data || {});
    drawApplicationsTable(doc, data?.latestApplications || []);
    drawFooters(doc);

    doc.end();
  });
