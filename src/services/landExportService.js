import PDFDocument from 'pdfkit';

const CSV_BOM = '\uFEFF';

const escapeCsvCell = (value) => {
  const raw = value === null || value === undefined ? '' : String(value);
  const sanitized = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(sanitized)) {
    return `"${sanitized.replaceAll('"', '""')}"`;
  }
  return sanitized;
};

const toCsvRow = (cells) => cells.map(escapeCsvCell).join(',');

const extractLandCoordinates = (land) =>
  land.location_lat && land.location_lng
    ? {
        lat: Number(land.location_lat),
        lng: Number(land.location_lng),
      }
    : null;

const buildLandMetadata = (land) => ({
  id: land.id,
  name: land.name,
  status: land.status ? 'Activo' : 'Archivado',
  sizeHectares: land.size_hectares ? Number(land.size_hectares) : 0,
  farmingType: land.farming_type || null,
  municipality: land.municipality || null,
  region: land.region?.name || null,
  owner: land.user?.full_name || null,
  coordinates: extractLandCoordinates(land),
});

const mapCycleExportItem = (cycle) => ({
  id: cycle.id,
  crop: cycle.crop?.name || 'Cultivo',
  scientificName: cycle.crop?.scientific_name || null,
  lot: cycle.area_section || 'General',
  plantingDate: cycle.plantingDate,
  estimatedHarvestDate: cycle.estimatedHarvestDate || null,
  status: cycle.statusLabel,
  progressPercent: cycle.progressPercent ?? 0,
});

export const buildLandExpedientePayload = ({
  land,
  landId,
  lots = [],
  farmCrops = [],
  healthReports = [],
  applications = [],
}) => ({
  exportedAt: new Date().toISOString(),
  expedienteCode: landId,
  land: buildLandMetadata(land),
  summary: {
    lotsCount: lots.length,
    cyclesCount: farmCrops.length,
    healthReportsCount: healthReports.length,
    applicationsCount: applications.length,
  },
  lots: lots.map((lot) => ({
    id: lot.id,
    name: lot.name,
    sizeHectares: lot.size_hectares,
    activeCropsCount: lot.activeCropsCount,
    description: lot.description,
  })),
  cropCycles: farmCrops.map(mapCycleExportItem),
  healthReports: healthReports.map((rep) => ({
    id: rep.id,
    observedDate: rep.observedDate,
    lot: rep.lotName,
    crop: rep.cropName,
    plague: rep.plague_name,
    severity: rep.severityLabel,
    description: rep.description || '',
  })),
  applications: applications.map((app) => ({
    id: app.id,
    appliedDate: app.appliedDate,
    lot: app.lotName,
    crop: app.cropName,
    product: app.product_name,
    activeIngredient: app.active_ingredient || '',
    dose: `${app.dose_value} ${app.dose_unit}`,
    notes: app.notes || '',
  })),
});

export const buildLandExpedienteCsv = (context) => {
  const payload = buildLandExpedientePayload(context);
  const lines = [
    toCsvRow([
      'Sección',
      'Fecha / Código',
      'Lote / Ubicación',
      'Concepto Principal',
      'Detalle Técnico',
      'Magnitud / Estado',
      'Observaciones',
    ]),
    toCsvRow([
      'Predio',
      payload.expedienteCode,
      payload.land.municipality || 'Sin municipio',
      payload.land.name,
      payload.land.region || 'Sin región',
      `${payload.land.sizeHectares} ha (${payload.land.status})`,
      payload.land.farmingType || 'Manejo no especificado',
    ]),
  ];

  payload.lots.forEach((lot) => {
    lines.push(
      toCsvRow([
        'Lote',
        `LOT-${lot.id || 'AUTO'}`,
        lot.name,
        lot.name,
        `${lot.activeCropsCount} ciclo(s) activo(s)`,
        lot.sizeHectares ? `${lot.sizeHectares} ha` : 'N/D',
        lot.description || '',
      ]),
    );
  });

  payload.cropCycles.forEach((cycle) => {
    lines.push(
      toCsvRow([
        'Ciclo Fenológico',
        cycle.plantingDate || '',
        cycle.lot,
        cycle.crop,
        cycle.scientificName || '',
        `${cycle.status} (${cycle.progressPercent}%)`,
        cycle.estimatedHarvestDate
          ? `Cosecha est.: ${cycle.estimatedHarvestDate}`
          : '',
      ]),
    );
  });

  payload.healthReports.forEach((rep) => {
    lines.push(
      toCsvRow([
        'Hallazgo Sanitario',
        rep.observedDate || '',
        rep.lot,
        rep.plague,
        rep.crop || 'General',
        `Severidad ${rep.severity}`,
        rep.description,
      ]),
    );
  });

  payload.applications.forEach((app) => {
    lines.push(
      toCsvRow([
        'Aplicación Fitosanitaria',
        app.appliedDate || '',
        app.lot,
        app.product,
        app.activeIngredient,
        app.dose,
        app.notes,
      ]),
    );
  });

  return CSV_BOM + lines.join('\r\n');
};

export const buildLandExpedienteGeoJson = (context) => {
  const payload = buildLandExpedientePayload(context);
  const coords = payload.land.coordinates;
  const geometry = coords
    ? {
        type: 'Point',
        coordinates: [coords.lng, coords.lat],
      }
    : null;

  return {
    type: 'FeatureCollection',
    metadata: {
      exportedAt: payload.exportedAt,
      expedienteCode: payload.expedienteCode,
      generator: 'AgroSystem INIFAP',
    },
    features: [
      {
        type: 'Feature',
        id: payload.land.id,
        geometry,
        properties: {
          expedienteCode: payload.expedienteCode,
          name: payload.land.name,
          status: payload.land.status,
          sizeHectares: payload.land.sizeHectares,
          farmingType: payload.land.farmingType,
          municipality: payload.land.municipality,
          region: payload.land.region,
          owner: payload.land.owner,
          summary: payload.summary,
          lots: payload.lots,
          cropCycles: payload.cropCycles,
          healthReports: payload.healthReports,
          applications: payload.applications,
        },
      },
    ],
  };
};

const formatCoordinatesLabel = (coords) =>
  coords ? `${coords.lat}, ${coords.lng}` : 'Sin georreferenciación';

const drawLandPdfHeader = (doc, payload) => {
  doc.rect(0, 0, doc.page.width, 84).fill('#1b4332');
  doc
    .fillColor('#a7f3d0')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(
      `INIFAP · EXPEDIENTE TÉCNICO DE PREDIO (${payload.expedienteCode})`,
      44,
      24,
    );
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(18)
    .text(payload.land.name || 'Predio Agrícola', 44, 38, { width: 400 });
  doc
    .fillColor('#d1fae5')
    .font('Helvetica')
    .fontSize(9)
    .text(
      `${payload.land.municipality || 'Municipio N/E'} · ${payload.land.region || 'Región N/E'} · ${payload.land.sizeHectares} ha`,
      44,
      61,
    );
  doc.y = 102;
};

const drawLandPdfSummary = (doc, payload) => {
  const { land, summary } = payload;
  doc
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('1. Ficha General y Georreferenciación', 44, doc.y);
  doc.moveDown(0.4);

  const infoLines = [
    `Estado operativo: ${land.status} | Superficie: ${land.sizeHectares} ha | Manejo: ${land.farmingType || 'No especificado'}`,
    `Responsable técnico: ${land.owner || 'Sin asignar'} | Coordenadas GPS: ${formatCoordinatesLabel(land.coordinates)}`,
    `Resumen bitácora: ${summary.lotsCount} lote(s) · ${summary.cyclesCount} ciclo(s) · ${summary.healthReportsCount} hallazgo(s) · ${summary.applicationsCount} aplicación(es)`,
  ];

  doc.fillColor('#334155').font('Helvetica').fontSize(9.5);
  infoLines.forEach((line) => {
    doc.text(line, 44, doc.y, { width: 507 });
    doc.moveDown(0.25);
  });
  doc.moveDown(0.5);
};

const drawLandPdfSectionList = (doc, title, items, emptyText) => {
  if (doc.y > 680) doc.addPage();
  doc
    .fillColor('#1b4332')
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(title, 44, doc.y);
  doc.moveDown(0.35);

  if (!items.length) {
    doc
      .fillColor('#64748b')
      .font('Helvetica-Oblique')
      .fontSize(9)
      .text(emptyText, 44, doc.y);
    doc.moveDown(0.6);
    return;
  }

  doc.fillColor('#1e293b').font('Helvetica').fontSize(9);
  items.forEach((item) => {
    if (doc.y > 710) doc.addPage();
    doc.text(`• ${item}`, 48, doc.y, { width: 500 });
    doc.moveDown(0.25);
  });
  doc.moveDown(0.5);
};

const drawLandPdfFooters = (doc, expedienteCode) => {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const oldBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .fillColor('#64748b')
      .font('Helvetica')
      .fontSize(8)
      .text(
        `AgroSystem INIFAP · Expediente ${expedienteCode} · Página ${i + 1} de ${range.count}`,
        44,
        doc.page.height - 28,
        { width: doc.page.width - 88, align: 'center', lineBreak: false },
      );
    doc.page.margins.bottom = oldBottom;
  }
};

export const sendLandExpedientePdf = (res, context) => {
  const payload = buildLandExpedientePayload(context);
  res.setHeader?.('Content-Type', 'application/pdf');
  res.setHeader?.(
    'Content-Disposition',
    `attachment; filename="expediente-predio-${payload.land.id}.pdf"`,
  );

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 44, bottom: 44, left: 44, right: 44 },
    bufferPages: true,
    info: {
      Title: `Expediente Técnico ${payload.expedienteCode} - ${payload.land.name}`,
      Author: 'AgroSystem INIFAP',
    },
  });

  doc.pipe(res);
  drawLandPdfHeader(doc, payload);
  drawLandPdfSummary(doc, payload);

  drawLandPdfSectionList(
    doc,
    '2. División por Lotes y Bloques',
    payload.lots.map(
      (lot) =>
        `${lot.name} (${lot.sizeHectares ? `${lot.sizeHectares} ha` : 'Superficie N/D'}) — ${lot.activeCropsCount} ciclo(s) activo(s). ${lot.description || ''}`,
    ),
    'Sin lotes particulares registrados.',
  );

  drawLandPdfSectionList(
    doc,
    '3. Ciclos Fenológicos Registrados',
    payload.cropCycles.map(
      (c) =>
        `[${c.lot}] ${c.crop} (${c.scientificName || 'S/N'}) — Siembra: ${c.plantingDate || 'N/D'} | Estado: ${c.status} (${c.progressPercent}%)`,
    ),
    'Sin ciclos fenológicos registrados.',
  );

  drawLandPdfSectionList(
    doc,
    '4. Bitácora de Hallazgos Fitosanitarios',
    payload.healthReports.map(
      (r) =>
        `[${r.observedDate || 'S/F'} · ${r.lot}] ${r.plague} en ${r.crop || 'General'} — Severidad ${r.severity}. ${r.description}`,
    ),
    'Sin hallazgos fitosanitarios reportados.',
  );

  drawLandPdfSectionList(
    doc,
    '5. Aplicaciones de Insumos Fitosanitarios',
    payload.applications.map(
      (a) =>
        `[${a.appliedDate || 'S/F'} · ${a.lot}] ${a.product} (${a.activeIngredient || 'I.A. N/D'}) — Dosis: ${a.dose}. ${a.notes}`,
    ),
    'Sin aplicaciones fitosanitarias registradas.',
  );

  drawLandPdfFooters(doc, payload.expedienteCode);
  doc.end();
  return res;
};
