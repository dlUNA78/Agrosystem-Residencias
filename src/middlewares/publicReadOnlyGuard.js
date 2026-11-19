const NON_PUBLIC_READONLY_PREFIXES = [
  '/private',
  '/dashboard',
  '/auth',
  '/profile',
  '/notifications',
  '/api/notifications',
  '/suggestions',
];

export const publicReadOnlyGuard = (req, res, next) => {
  // Ignorar rutas privadas, de autenticación, de perfil de usuario, sugerencias o notificaciones
  const reqPath = req.path || '';
  if (
    NON_PUBLIC_READONLY_PREFIXES.some(
      (prefix) => reqPath === prefix || reqPath.startsWith(`${prefix}/`),
    )
  ) {
    return next();
  }

  const allowedMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (!allowedMethods.includes(req.method)) {
    return res.status(403).json({
      error: 'Forbidden',
      message:
        'Las rutas públicas son exclusivamente de lectura. Operación no permitida.',
    });
  }
  next();
};
