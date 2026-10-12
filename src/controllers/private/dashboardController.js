import path from 'path';
import { fileURLToPath } from 'url';
import { getDashboardSummary } from '../../services/dashboardMetricsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta absoluta al layout privado
const privateLayout = path.join(__dirname, '../../views/layouts/private');

export const dashboard = async (req, res) => {
  try {
    const summary = await getDashboardSummary(req.user);

    return res.render('private/dashboard/index', {
      layout: privateLayout,
      pageTitle: 'Dashboard',
      activePage: 'dashboard',
      ...summary,
    });
  } catch (error) {
    console.error('Error al generar métricas del dashboard:', error);
    return res.status(500).render('private/dashboard/index', {
      layout: privateLayout,
      pageTitle: 'Dashboard',
      activePage: 'dashboard',
      validations: { total: 0, todayNewCount: 0 },
      alerts: { criticalCount: 0, latestAlert: null },
      land: { totalFarms: 0, activeCyclesCount: 0, formattedHectares: '0' },
      topPlagues: [],
      cropDistribution: {
        hasData: false,
        totalCycles: 0,
        totalHectaresText: '0',
        conicGradientStyle: 'background: #e2e8f0;',
        crops: [],
      },
      recentActivity: [],
      error: 'Ocurrió un error al cargar las métricas en tiempo real.',
    });
  }
};
