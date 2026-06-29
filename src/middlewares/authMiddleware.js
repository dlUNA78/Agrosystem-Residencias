//verificar que este logeado
export const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.redirect("/auth/login");
};

//Bloqueo total del panel a usuarios normales
export const requirePanelAccess = (req, res, next) => {
  if (!req.user) return res.redirect("/auth/login");

  // Solo los roles 'inifap' o 'admin' supremo pueden entrar al panel
  if (req.user.role === "inifap" || req.user.role === "admin") {
    return next();
  }

  // En el futuro podemos redirigirlo a un perfil público: res.redirect('/mi-perfil')
  res
    .status(403)
    .send(
      "Error 403: Acceso Denegado. Esta área es exclusiva para personal de INIFAP.",
    );
};

