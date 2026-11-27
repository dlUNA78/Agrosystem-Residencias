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

const isPrivatePath = (value) =>
  typeof value === 'string' &&
  (value.startsWith('/private') || value.startsWith('/dashboard'));

const isPrivateRequestArea = (req) => {
  const baseUrl = req?.baseUrl || '';
  const reqPath = req?.path || '';
  return (
    isPrivatePath(`${baseUrl}${reqPath}`) || isPrivatePath(req?.originalUrl)
  );
};

const hasPrivatePanelRole = (user) =>
  user?.role === 'admin' || user?.role === 'inifap';

const resolveErrorLayout = (req) => {
  const user = req.user || req.session?.user;
  return isPrivateRequestArea(req) && hasPrivatePanelRole(user)
    ? privateLayout
    : publicLayout;
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

export const formatRetryAfterWaitLabel = (retryAfterSeconds) => {
  const safeSeconds = Math.max(1, Math.ceil(Number(retryAfterSeconds) || 60));
  const minutes = Math.max(1, Math.ceil(safeSeconds / 60));
  return minutes === 1
    ? 'aproximadamente 1 minuto'
    : `aproximadamente ${minutes} minutos`;
};

const isApiEndpointRequest = (req) =>
  Boolean(
    req?.xhr ||
    req?.path?.startsWith('/api/') ||
    req?.originalUrl?.startsWith('/api/'),
  );

const resolveAcceptsHeaderFallback = (acceptHeader) => {
  const accept = String(acceptHeader || '');
  if (accept.includes('application/json') && !accept.includes('text/html')) {
    return 'json';
  }
  return accept.includes('text/html') ? 'html' : 'text';
};

const resolvePreferredContentType = (req) => {
  if (isApiEndpointRequest(req)) {
    return 'json';
  }
  if (typeof req?.accepts === 'function') {
    const preferred = req.accepts(['html', 'json']);
    return preferred === 'json' || preferred === 'html' ? preferred : 'text';
  }
  return resolveAcceptsHeaderFallback(req?.headers?.accept);
};

const normalizeRetryAfterSeconds = (retryAfterSeconds) =>
  Math.max(1, Math.ceil(Number(retryAfterSeconds) || 1));

const applyRetryAfterHeader = (res, retryAfterSeconds) => {
  const value = String(normalizeRetryAfterSeconds(retryAfterSeconds));
  if (typeof res?.setHeader === 'function') {
    res.setHeader('Retry-After', value);
  } else if (typeof res?.set === 'function') {
    res.set('Retry-After', value);
  }
};

const canRenderAppView = (req, res) =>
  typeof res?.render === 'function' && Boolean(req?.app?.get?.('view engine'));

const renderTooManyRequestsHtml = (
  req,
  res,
  { safeMessage, safeRetryAfter, view, viewLocals },
) => {
  const layout = resolveErrorLayout(req);
  if (view) {
    return res.status(429).render(view, {
      layout,
      ...(viewLocals || {}),
    });
  }
  return res.status(429).render('errors/429', {
    layout,
    pageTitle: 'Demasiadas solicitudes (429)',
    errorMessage: safeMessage,
    retryAfterSeconds: safeRetryAfter,
    retryAfterLabel: formatRetryAfterWaitLabel(safeRetryAfter),
    requestedPath: req.originalUrl || req.path || '/',
  });
};

export const sendTooManyRequestsResponse = (req, res, options = {}) => {
  const safeMessage =
    options.message ||
    'Has superado el límite temporal de solicitudes. Espera unos minutos e inténtalo de nuevo.';
  const safeRetryAfter = normalizeRetryAfterSeconds(
    options.retryAfterSeconds ?? 60,
  );
  applyRetryAfterHeader(res, safeRetryAfter);

  const preferred = resolvePreferredContentType(req);
  if (preferred === 'json') {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: safeMessage,
    });
  }

  if (preferred === 'html' && canRenderAppView(req, res)) {
    return renderTooManyRequestsHtml(req, res, {
      safeMessage,
      safeRetryAfter,
      view: options.view || null,
      viewLocals: options.viewLocals || null,
    });
  }

  return res.status(429).send(safeMessage);
};
