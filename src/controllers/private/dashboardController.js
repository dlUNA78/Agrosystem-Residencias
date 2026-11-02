import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildQuickActions,
  getDashboardSummary,
} from '../../services/dashboardMetricsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta absoluta al layout privado
const privateLayout = path.join(__dirname, '../../views/layouts/private');

const EMPTY_ECOSYSTEM = {
  totalIngredients: 0,
  activeIngredients: 0,
  totalSuppliers: 0,
  activeSuppliers: 0,
  publishedPlagues: 0,
  publishedCrops: 0,
  publishedProducts: 0,
  publishedTotal: 0,
};

export const dashboard = async (req, res) => {
  const currentUser = req.user || req.session?.user || null;

  try {
    const summary = await getDashboardSummary(currentUser);

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
      validations: {
        total: 0,
        plaguesPending: 0,
        cropsPending: 0,
        productsPending: 0,
        todayNewCount: 0,
      },
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
      ecosystem: EMPTY_ECOSYSTEM,
      quickActions: buildQuickActions(currentUser),
      isAdmin: currentUser?.role === 'admin',
      isInifap: currentUser?.role === 'inifap',
      error: 'Ocurrió un error al cargar las métricas en tiempo real.',
    });
  }
};
