export const publicReadOnlyGuard = (req, res, next) => {
  // Ignorar rutas privadas, de autenticación o de perfil de usuario
  if (
    req.path.startsWith('/private') ||
    req.path.startsWith('/auth') ||
    req.path.startsWith('/profile') ||
    req.path.startsWith('/lands')
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
