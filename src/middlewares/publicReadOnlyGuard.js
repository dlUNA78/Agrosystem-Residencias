export const publicReadOnlyGuard = (req, res, next) => {
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
