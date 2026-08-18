# language: es
Característica: Consulta de catálogos públicos
  Como visitante anónimo en la plataforma
  Quiero buscar plagas en el catálogo
  Para obtener información técnica sin exponer datos de administración

  Escenario: Búsqueda exitosa de plaga por nombre
    Dado que soy un visitante anónimo en la plataforma
    Cuando busco "Gusano Cogollero" en el catálogo de plagas
    Entonces el sistema debe devolverme una lista con al menos un resultado que coincida
    Y la respuesta no debe contener información interna de los administradores.
