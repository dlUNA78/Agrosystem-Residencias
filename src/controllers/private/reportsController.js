import path from 'path';
import { fileURLToPath } from 'url';
import db from '../../models/index.js';
import {
  getOperationalReportsData,
  generateOperationalReportCsv,
} from '../../services/reportsService.js';

const { AuditLog } = db;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta absoluta al layout privado
const privateLayout = path.join(__dirname, '../../views/layouts/private');

const buildCsvFilename = (reportType, period) =>
  `reporte-operativo-${reportType}-${period}.csv`;

const logExportAudit = async (user, reportType, period) => {
  if (!user?.id || !AuditLog?.create) return;
  try {
    await AuditLog.create({
      user_id: user.id,
      action: 'export',
      table_name: 'Reports',
      record_id: 0,
      new_values: { reportType, period },
    });
  } catch (_e) {
    // Falla de auditoría no interrumpe la descarga
  }
};

const getFallbackReportsPayload = () => ({
  layout: privateLayout,
  pageTitle: 'Reportes y Estadísticas',
  activePage: 'reports',
  errorMessage: 'Ocurrió un error al cargar las estadísticas del sistema.',
  kpis: {
    reportedPlagues: 0,
    chemicalApplications: 0,
    criticalAlerts: 0,
    monitoredFarms: 0,
    formattedHectares: '0 ha',
  },
  monthlyApplications: [],
  productDistribution: {
    total: 0,
    conicGradientStyle: 'background: #e2e8f0;',
    types: [],
  },
  topPlagues: [],
  activeFarms: [],
  latestApplications: [],
  hasApplications: false,
  hasPlagues: false,
  query: {
    period: 'mensual',
    format: '',
    reportType: 'general',
    farmId: null,
  },
});

export const reportsPrivate = async (req, res) => {
  const user = req.session?.user;

  try {
    const data = await getOperationalReportsData(user, req.query);

    if (data.query.format === 'csv') {
      const csv = await generateOperationalReportCsv({
        reportType: data.query.reportType,
        data,
        user,
      });

      await logExportAudit(user, data.query.reportType, data.query.period);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${buildCsvFilename(
          data.query.reportType,
          data.query.period,
        )}"`,
      );

      return res.send(csv);
    }

    return res.render('private/admin/reports', {
      layout: privateLayout,
      pageTitle: 'Reportes y Estadísticas',
      activePage: 'reports',
      ...data,
    });
  } catch (error) {
    console.error('Error al generar reportes operativos:', error);
    return res.status(500).render('private/admin/reports', {
      ...getFallbackReportsPayload(),
    });
  }
};
