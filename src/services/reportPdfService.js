import PDFDocument from 'pdfkit';

const COLORS = Object.freeze({
  brand: '#1b4332',
  brandSoft: '#ecfdf5',
  accent: '#047857',
  ink: '#0f172a',
  muted: '#475569',
  subtle: '#64748b',
  border: '#cbd5e1',
  surface: '#f8fafc',
  dangerSoft: '#fff1f2',
  dangerInk: '#be123c',
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
  ensureVerticalSpace(doc, 52);
  doc.moveDown(0.5);
  const { startX, contentWidth } = getPageBox(doc);
  const topY = doc.y;

  doc.save();
  doc.roundedRect(startX, topY, contentWidth, 21, 4).fill(COLORS.brandSoft);
  doc
    .fillColor(COLORS.brand)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text(
      `${indexLabel}. ${sanitizePdfText(title).toUpperCase()}`,
      startX + 10,
      topY + 6,
      { width: contentWidth - 20 },
    );
  doc.restore();
  doc.y = topY + 28;
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
    'Unidad Fitosanitaria INIFAP',
  );
  const emittedAt = new Date().toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  doc.save();
  doc.roundedRect(startX, bannerY, contentWidth, 66, 6).fill(COLORS.brand);
  doc
    .fillColor('#a7f3d0')
    .font('Courier-Bold')
    .fontSize(8)
    .text(
      'INIFAP - SISTEMA NACIONAL DE VIGILANCIA Y REPORTES OPERATIVOS',
      startX + 14,
      bannerY + 11,
      { width: contentWidth - 150 },
    );
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(
      'Resumen Ejecutivo de Operacion Fitosanitaria',
      startX + 14,
      bannerY + 25,
      { width: contentWidth - 160 },
    );
  doc
    .fillColor('#d1fae5')
    .font('Courier')
    .fontSize(8)
    .text(
      `Emitido por: ${operatorName} | Fecha: ${sanitizePdfText(emittedAt)}`,
      startX + 14,
      bannerY + 46,
      { width: contentWidth - 160 },
    );

  doc
    .roundedRect(startX + contentWidth - 134, bannerY + 18, 120, 28, 4)
    .fill('#133326');
  doc
    .fillColor('#6ee7b7')
    .font('Courier-Bold')
    .fontSize(8)
    .text(
      `PERIODO: ${periodLabel}`,
      startX + contentWidth - 128,
      bannerY + 28,
      {
        width: 108,
        align: 'center',
      },
    );
  doc.restore();
  doc.y = bannerY + 78;
};

const drawKpiCards = (doc, kpis = {}) => {
  const { startX, contentWidth } = getPageBox(doc);
  const gap = 8;
  const cardWidth = (contentWidth - gap * 3) / 4;
  const topY = doc.y;

  const items = [
    ['PLAGAS REPORTADAS', String(kpis.reportedPlagues ?? 0), 'Incidencias'],
    [
      'APLICACIONES QUIMICAS',
      String(kpis.chemicalApplications ?? 0),
      sanitizePdfText(kpis.formattedHectares, '0 ha'),
    ],
    ['PREDIOS MONITOREADOS', String(kpis.monitoredFarms ?? 0), 'Activos'],
    ['ALERTAS CRITICAS', String(kpis.criticalAlerts ?? 0), 'Severidad alta'],
  ];

  items.forEach(([label, value, sub], index) => {
    const x = startX + index * (cardWidth + gap);
    const isAlert = index === 3 && Number(kpis.criticalAlerts) > 0;
    doc.save();
    doc
      .roundedRect(x, topY, cardWidth, 56, 5)
      .fillAndStroke(
        isAlert ? COLORS.dangerSoft : COLORS.surface,
        COLORS.border,
      );
    doc
      .fillColor(COLORS.subtle)
      .font('Courier-Bold')
      .fontSize(7)
      .text(label, x + 8, topY + 8, { width: cardWidth - 16 });
    doc
      .fillColor(isAlert ? COLORS.dangerInk : COLORS.ink)
      .font('Helvetica-Bold')
      .fontSize(15)
      .text(value, x + 8, topY + 21, { width: cardWidth - 16 });
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(7.5)
      .text(sub, x + 8, topY + 41, { width: cardWidth - 16 });
    doc.restore();
  });

  doc.y = topY + 66;
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
  const headers = ['FECHA', 'PREDIO', 'INSUMO', 'DOSIS', 'TECNICO'];
  const headerY = doc.y;

  doc.save();
  doc.rect(startX, headerY, contentWidth, 18).fill(COLORS.surface);
  let cursorX = startX + 6;
  headers.forEach((h, idx) => {
    doc
      .fillColor(COLORS.subtle)
      .font('Courier-Bold')
      .fontSize(7.5)
      .text(h, cursorX, headerY + 5, { width: cols[idx] - 8 });
    cursorX += cols[idx];
  });
  doc.restore();
  doc.y = headerY + 20;

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
        .font(idx === 0 || idx === 3 ? 'Courier' : 'Helvetica')
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
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .stroke();
    doc.y = rowY + 18;
  });
};

const drawFooters = (doc) => {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const { startX, contentWidth } = getPageBox(doc);
    const footerY = doc.page.height - 28;
    doc
      .fillColor(COLORS.subtle)
      .font('Courier')
      .fontSize(7.5)
      .text(
        `INIFAP Agrosystem - Documento tecnico de trazabilidad fitosanitaria | Pagina ${i + 1} de ${range.count}`,
        startX,
        footerY,
        { width: contentWidth, align: 'center', lineBreak: false },
      );
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
