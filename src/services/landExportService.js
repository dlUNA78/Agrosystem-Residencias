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
