import db from '../../models/index.js';
import { createNotification } from '../../services/notificationService.js';
import { sanitizeText, sanitizeMultilineText } from '../../utils/validators.js';

const { Plague, Crop, Product, User, AuditLog } = db;

const wantsJson = (req) =>
  Boolean(req.xhr || req.headers?.accept?.includes('application/json'));

const notifyReviewers = async ({ actor, title, message, actionUrl }) => {
  if (typeof User?.findAll !== 'function') return;
  try {
    const reviewers = await User.findAll({
      where: {
        role: ['admin', 'inifap'],
        status: 'activo',
      },
      attributes: ['id'],
    });
    await Promise.all(
      reviewers.map((rev) =>
        createNotification({
          userId: rev.id,
          actorId: actor?.id || null,
          category: 'editorial',
          severity: 'info',
          title,
          message,
          actionUrl,
        }),
      ),
    );
  } catch (_err) {
    // Non-blocking notification
  }
};

const createPlagueSuggestion = async (body, user) => {
  const name = sanitizeText(body.name, 140);
  const scientificName = sanitizeText(body.scientific_name, 160);
  if (name.length < 3 || scientificName.length < 3) {
    return {
      error: 'El nombre común y el nombre científico son obligatorios.',
    };
  }
  const record = await Plague.create({
    name,
    scientific_name: scientificName,
    category: sanitizeText(body.category, 60) || 'Insectos',
    risk_level: sanitizeText(body.risk_level, 40) || 'Moderado',
    region: sanitizeText(body.region, 120) || 'Por validar',
    description: sanitizeMultilineText(body.description, 1500),
    symptoms: sanitizeMultilineText(body.symptoms, 1200),
    control_methods: sanitizeMultilineText(body.control_methods, 1200),
    workflow_status: 'in_review',
    status: false,
    created_by_user_id: user.id,
    updated_by_user_id: user.id,
  });
  return {
    record,
    tableName: 'Plagues',
    moduleLabel: 'Plaga / Especie',
    redirectUrl: '/plagues?suggested=1',
    actionUrl: `/private/plagues/${record.id}`,
  };
};

const createCropSuggestion = async (body, user) => {
  const name = sanitizeText(body.name, 140);
  const scientificName = sanitizeText(body.scientific_name, 160);
  if (name.length < 2 || scientificName.length < 3) {
    return {
      error: 'El nombre común y el nombre científico son obligatorios.',
    };
  }
  const record = await Crop.create({
    name,
    common_name: name,
    scientific_name: scientificName,
    category: sanitizeText(body.category, 80) || 'Hortalizas',
    botanical_family: sanitizeText(body.botanical_family, 100) || null,
    planting_season:
      sanitizeText(body.planting_season, 80) || 'Primavera-Verano',
    state: sanitizeText(body.state, 120) || null,
    description: sanitizeMultilineText(body.description, 1500),
    status: 'pendiente',
    workflow_status: 'in_review',
    created_by_user_id: user.id,
    updated_by_user_id: user.id,
  });
  return {
    record,
    tableName: 'Crops',
    moduleLabel: 'Cultivo Agrícola',
    redirectUrl: '/crops?suggested=1',
    actionUrl: `/private/crops/${record.id}`,
  };
};

const createProductSuggestion = async (body, user) => {
  const name = sanitizeText(body.name, 140);
  const activeIngredient = sanitizeText(body.active_ingredient, 160);
  if (name.length < 2 || activeIngredient.length < 3) {
    return {
      error: 'El nombre comercial y el ingrediente activo son obligatorios.',
    };
  }
  const record = await Product.create({
    name,
    active_ingredient: activeIngredient,
    category: sanitizeText(body.category, 80) || 'Fungicida',
    registration_code:
      sanitizeText(body.registration_code, 80) || 'En trámite RSCO',
    manufacturer: sanitizeText(body.manufacturer, 120) || 'Por validar',
    hazard_category:
      sanitizeText(body.hazard_category, 80) ||
      'Categoría IV — Precaución (Banda Verde)',
    suggested_dosage: sanitizeText(body.suggested_dosage, 100) || null,
    target_crops: sanitizeText(body.target_crops, 200) || null,
    description: sanitizeMultilineText(body.description, 1500),
    validation_status: 'En revisión',
    status: false,
    workflow_status: 'in_review',
    created_by_user_id: user.id,
    updated_by_user_id: user.id,
  });
  return {
    record,
    tableName: 'Products',
    moduleLabel: 'Insumo / Agroquímico',
    redirectUrl: '/products?suggested=1',
    actionUrl: `/private/products/${record.id}`,
  };
};

const HANDLERS_BY_CATALOG = Object.freeze({
  plagues: createPlagueSuggestion,
  crops: createCropSuggestion,
  products: createProductSuggestion,
});

const recordSuggestionAudit = async (result, user) => {
  if (typeof AuditLog?.create !== 'function') return;
  await AuditLog.create({
    action: 'create',
    table_name: result.tableName,
    record_id: result.record.id,
    old_values: null,
    new_values: {
      name: result.record.name,
      workflow_status: 'in_review',
      source: 'Colaboración Ciudadana / Científica',
      author_role: user.role,
    },
    user_id: user.id,
  });
};

const sendSuggestionResponse = (req, res, statusCode, payload, redirectUrl) => {
  if (wantsJson(req)) {
    return res.status(statusCode).json(payload);
  }
  if (redirectUrl) {
    return res.redirect(redirectUrl);
  }
  return res.status(statusCode).send(payload.message);
};

export const submitCatalogSuggestion = async (req, res) => {
  const catalogKey = String(req.params.catalog || '').toLowerCase();
  const handler = HANDLERS_BY_CATALOG[catalogKey];
  if (!handler) {
    return res.status(400).json({ error: 'Catálogo no válido.' });
  }

  try {
    const result = await handler(req.body || {}, req.user);
    if (result.error) {
      return sendSuggestionResponse(req, res, 400, {
        success: false,
        message: result.error,
      });
    }

    await recordSuggestionAudit(result, req.user);
    await notifyReviewers({
      actor: req.user,
      title: `Nueva propuesta de ${result.moduleLabel}: ${result.record.name}`,
      message: `${req.user.full_name} (${req.user.role}) propuso incorporar "${result.record.name}" al catálogo oficial. Pendiente de verificación técnica.`,
      actionUrl: result.actionUrl,
    });

    return sendSuggestionResponse(
      req,
      res,
      201,
      {
        success: true,
        message: 'Propuesta enviada a la bandeja de validación del INIFAP.',
      },
      result.redirectUrl,
    );
  } catch (error) {
    console.error('Error al registrar sugerencia ciudadana:', error);
    return sendSuggestionResponse(req, res, 500, {
      success: false,
      message: 'Error al registrar la sugerencia.',
    });
  }
};
