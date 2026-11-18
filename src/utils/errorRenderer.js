import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicLayout = path.join(__dirname, '../views/layouts/public');
const privateLayout = path.join(__dirname, '../views/layouts/private');

export const isJsonOrApiRequest = (req) =>
  Boolean(
    req.xhr ||
    req.path?.startsWith('/api/') ||
    req.headers?.accept?.includes('application/json'),
  );

export const canRenderHtmlError = (req, res) =>
  typeof res.render === 'function' &&
  !isJsonOrApiRequest(req) &&
  Boolean(
    !process.env.JEST_WORKER_ID || req.headers?.accept?.includes('text/html'),
  );

const resolveErrorLayout = (req) => {
  const user = req.user || req.session?.user;
  const isPrivateArea =
    req.path?.startsWith('/private') || req.path?.startsWith('/dashboard');
  if (
    isPrivateArea &&
    user &&
    (user.role === 'admin' || user.role === 'inifap')
  ) {
    return privateLayout;
  }
  return publicLayout;
};

export const sendForbiddenResponse = (req, res, message) => {
  const safeMessage =
    message ||
    'Error 403: Acceso Denegado. No posees los privilegios requeridos para acceder a esta área.';

  if (isJsonOrApiRequest(req)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: safeMessage,
    });
  }

  if (canRenderHtmlError(req, res)) {
    return res.status(403).render('errors/403', {
      layout: resolveErrorLayout(req),
      pageTitle: 'Acceso Denegado (403)',
      errorMessage: safeMessage,
      requestedPath: req.originalUrl || req.path || '/',
    });
  }

  return res.status(403).send(safeMessage);
};

export const sendNotFoundResponse = (req, res, message) => {
  const safeMessage =
    message ||
    'El recurso o la ruta solicitada no existe en Agrosystem INIFAP.';

  if (isJsonOrApiRequest(req)) {
    return res.status(404).json({
      error: 'Not Found',
      message: safeMessage,
    });
  }

  if (typeof res.render === 'function') {
    return res.status(404).render('errors/404', {
      layout: resolveErrorLayout(req),
      pageTitle: 'Página no encontrada (404)',
      errorMessage: safeMessage,
      requestedPath: req.originalUrl || req.path || '/',
    });
  }

  return res.status(404).send(safeMessage);
};
