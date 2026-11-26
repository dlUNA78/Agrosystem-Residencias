#!/usr/bin/env node
/**
 * Bootstrap idempotente de la base de datos de demostración (agrosystem_demo).
 *
 * Guardrails obligatorios:
 *   - Bloqueado si NODE_ENV === 'production'.
 *   - Bloqueado si DB_NAME no inicia con "agrosystem_demo".
 *
 * Uso:
 *   node scripts/demo/setupDemoDb.js
 *   node scripts/demo/setupDemoDb.js --env-file .env.demo
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcrypt';
import { generateLandCropStages } from '../../src/services/landPhenologyService.js';
import {
  assertDemoEnvironment,
  createDemoPool,
  ensureDemoDatabaseExists,
  loadDemoEnv,
  parseDemoCliArgs,
  PROJECT_ROOT,
  PUBLIC_DIR,
  SEQUELIZE_CLI_BIN,
} from './demoGuardrails.js';
import {
  buildDemoUsers,
  collectDeclaredImagePaths,
  DEMO_ACTIVE_INGREDIENTS,
  DEMO_CROP_PLAGUES,
  DEMO_CROP_PRODUCTS,
  DEMO_CROPS,
  DEMO_FARMS,
  DEMO_INIFAP_CODE,
  DEMO_PLAGUE_PRODUCTS,
  DEMO_PLAGUE_REGIONS,
  DEMO_PLAGUES,
  DEMO_PRODUCTS,
  DEMO_REGIONAL_BULLETINS,
  DEMO_REGIONS,
  DEMO_SUPPLIERS,
} from './demoData.js';

const SALT_ROUNDS = 10;

const verifyDemoImagesExist = () => {
  const missing = [];
  for (const relativeUrl of collectDeclaredImagePaths()) {
    const cleanRel = relativeUrl.replace(/^\/+/, '');
    const fullPath = path.join(PUBLIC_DIR, cleanRel);
    if (!fs.existsSync(fullPath)) {
      missing.push(relativeUrl);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Imágenes demo inexistentes en public/: ${missing.join(', ')}`,
    );
  }
};

const runMigrationsOnDemoDb = (dbConfig) => {
  const migrationEnv = {
    ...process.env,
    NODE_ENV: 'development',
    DB_HOST: dbConfig.host,
    DB_PORT: String(dbConfig.port),
    DB_NAME: dbConfig.database,
    DB_USER: dbConfig.user,
    DB_PASS: dbConfig.password,
  };
  execFileSync(process.execPath, [SEQUELIZE_CLI_BIN, 'db:migrate'], {
    cwd: PROJECT_ROOT,
    env: migrationEnv,
    stdio: 'inherit',
  });
};

const ensureRegionalBulletinsTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "RegionalBulletins" (
      id SERIAL PRIMARY KEY,
      folio VARCHAR(40) NOT NULL,
      title VARCHAR(200) NOT NULL,
      summary TEXT,
      content TEXT,
      bulletin_type VARCHAR(50) NOT NULL DEFAULT 'aviso_semanal',
      severity VARCHAR(30) NOT NULL DEFAULT 'MEDIA',
      state VARCHAR(100) NOT NULL,
      region_id INTEGER REFERENCES "Regions"(id) ON UPDATE CASCADE ON DELETE SET NULL,
      crop_name VARCHAR(120),
      plague_name VARCHAR(150),
      plague_scientific_name VARCHAR(150),
      workflow_status VARCHAR(32) NOT NULL DEFAULT 'published',
      created_by_user_id INTEGER REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE SET NULL,
      published_by_user_id INTEGER REFERENCES "Users"(id) ON UPDATE CASCADE ON DELETE SET NULL,
      published_at TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const loadRbacRoleMap = async (client) => {
  const res = await client.query(
    'SELECT id, slug, name FROM "RbacRoles" ORDER BY id ASC',
  );
  const bySlug = new Map();
  for (const row of res.rows) {
    bySlug.set(row.slug, row);
  }
  return bySlug;
};

const resolveUserSubRole = (spec, rbacBySlug) => {
  if (!spec.subRoleSlug) return null;
  const rbacRole = rbacBySlug.get(spec.subRoleSlug);
  if (!rbacRole) {
    throw new Error(
      `No se encontró el subrol RBAC "${spec.subRoleSlug}" en "RbacRoles".`,
    );
  }
  return rbacRole;
};

const upsertSingleDemoUser = async (client, spec, rbacBySlug) => {
  const rbacRole = resolveUserSubRole(spec, rbacBySlug);
  const rbacRoleId = rbacRole ? rbacRole.id : null;
  const existing = await client.query(
    'SELECT id FROM "Users" WHERE email = $1',
    [spec.email],
  );

  if (existing.rowCount > 0) {
    const userId = existing.rows[0].id;
    await client.query(
      `UPDATE "Users"
          SET role = $1, rbac_role_id = $2, status = $3, "updatedAt" = NOW()
        WHERE id = $4`,
      [spec.role, rbacRoleId, spec.status, userId],
    );
    return { ...spec, id: userId, rbacRoleName: rbacRole?.name || null };
  }

  const passwordHash = await bcrypt.hash(spec.credential, SALT_ROUNDS);
  const inserted = await client.query(
    `INSERT INTO "Users" (
       code, full_name, email, password_hash, role, phone, address,
       job_title, shift, photo_url, status, rbac_role_id, custom_permissions,
       "createdAt", "updatedAt"
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL,$10,$11,$12::jsonb,NOW(),NOW())
     RETURNING id`,
    [
      spec.code,
      spec.full_name,
      spec.email,
      passwordHash,
      spec.role,
      spec.phone,
      spec.address,
      spec.job_title,
      spec.shift,
      spec.status,
      rbacRoleId,
      JSON.stringify({ allow: [], deny: [] }),
    ],
  );
  return {
    ...spec,
    id: inserted.rows[0].id,
    rbacRoleName: rbacRole?.name || null,
  };
};

const seedDemoUsers = async (client, usersSpec, rbacBySlug) => {
  const usersByKey = new Map();
  for (const spec of usersSpec) {
    const userRecord = await upsertSingleDemoUser(client, spec, rbacBySlug);
    usersByKey.set(spec.key, userRecord);
  }
  return usersByKey;
};

const seedDemoInifapCode = async (client, adminId) => {
  const cleanCode = DEMO_INIFAP_CODE.trim().toUpperCase();
  const codeHash = crypto.createHash('sha256').update(cleanCode).digest('hex');
  const codeMasked = `${cleanCode.slice(0, 8)}-****-****-${cleanCode.slice(-4)}`;

  const existing = await client.query(
    'SELECT id FROM "InifapCodes" WHERE code_hash = $1 OR code = $2',
    [codeHash, cleanCode],
  );
  if (existing.rowCount > 0) {
    return existing.rows[0].id;
  }

  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const res = await client.query(
    `INSERT INTO "InifapCodes" (
       code, code_hash, code_masked, is_used, used_by_user_id, used_at,
       expires_at, note, rbac_role_id, created_by_user_id, revoked_at,
       "createdAt", "updatedAt"
     )
     VALUES ($1,$2,$3,false,NULL,NULL,$4,$5,NULL,$6,NULL,NOW(),NOW())
     RETURNING id`,
    [
      cleanCode,
      codeHash,
      codeMasked,
      expiresAt,
      'Código institucional de demostración (ascenso a Personal INIFAP)',
      adminId,
    ],
  );
  return res.rows[0].id;
};

const seedRegions = async (client) => {
  const byName = new Map();
  for (const reg of DEMO_REGIONS) {
    const existing = await client.query(
      'SELECT id FROM "Regions" WHERE name = $1',
      [reg.name],
    );
    if (existing.rowCount > 0) {
      byName.set(reg.name, existing.rows[0].id);
      continue;
    }
    const inserted = await client.query(
      `INSERT INTO "Regions" (name, lat, lng, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id`,
      [reg.name, reg.lat, reg.lng],
    );
    byName.set(reg.name, inserted.rows[0].id);
  }
  return byName;
};

const seedActiveIngredients = async (client, adminId) => {
  for (const item of DEMO_ACTIVE_INGREDIENTS) {
    const existing = await client.query(
      'SELECT id FROM "ActiveIngredients" WHERE name = $1',
      [item.name],
    );
    if (existing.rowCount > 0) continue;

    await client.query(
      `INSERT INTO "ActiveIngredients" (
         name, chemical_group, action_type, toxicological_category,
         workflow_status, created_by_user_id, updated_by_user_id,
         "createdAt", "updatedAt"
       )
       VALUES ($1,$2,$3,$4,'active',$5,$5,NOW(),NOW())`,
      [
        item.name,
        item.chemical_group,
        item.action_type,
        item.toxicological_category,
        adminId,
      ],
    );
  }
};

const seedSuppliers = async (client) => {
  for (const sup of DEMO_SUPPLIERS) {
    const existing = await client.query(
      'SELECT id FROM "suppliers" WHERE rfc = $1',
      [sup.rfc],
    );
    if (existing.rowCount > 0) continue;

    await client.query(
      `INSERT INTO "suppliers" (
         name, commercial_name, rfc, supply_type, contact_name, contact_position,
         email, phone, address, city, state, postal_code, country,
         supplied_products, brands, delivery_time, minimum_order, payment_method,
         status, "createdAt", "updatedAt"
       )
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'México',
         $13,$14,$15,$16,$17,$18,NOW(),NOW()
       )`,
      [
        sup.name,
        sup.commercial_name,
        sup.rfc,
        sup.supply_type,
        sup.contact_name,
        sup.contact_position,
        sup.email,
        sup.phone,
        sup.address,
        sup.city,
        sup.state,
        sup.postal_code,
        sup.supplied_products,
        sup.brands,
        sup.delivery_time,
        sup.minimum_order,
        sup.payment_method,
        sup.status,
      ],
    );
  }
};

const ensureCropImage = async (client, cropId, crop) => {
  const existing = await client.query(
    'SELECT id FROM "CropImages" WHERE crop_id = $1 AND image_url = $2',
    [cropId, crop.imageUrl],
  );
  if (existing.rowCount > 0) return;

  await client.query(
    `INSERT INTO "CropImages" (
       crop_id, image_url, original_name, source, is_primary, display_order,
       "createdAt", "updatedAt"
     )
     VALUES ($1,$2,$3,'Acervo Fotográfico INIFAP',true,1,NOW(),NOW())`,
    [cropId, crop.imageUrl, path.basename(crop.imageUrl)],
  );
};

const lookupUserId = (usersByKey, key) =>
  key ? usersByKey.get(key)?.id || null : null;

const insertCropRecord = async (client, crop, usersByKey) => {
  const isPublished = crop.workflow_status === 'published';
  const inserted = await client.query(
    `INSERT INTO "Crops" (
       name, common_name, scientific_name, category, family, botanical_family,
       genus, variety, growth_cycle, planting_season, soil_requirements,
       water_requirements, optimal_climate, region, state, climate, soil_type,
       ph_range, season, cycle, harvest_days, average_yield, description,
       status, workflow_status, created_by_user_id, updated_by_user_id,
       verified_by_user_id, published_by_user_id, verified_at, published_at,
       "createdAt", "updatedAt"
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
       $18,$19,$20,$21,$22,$23,$24,$25,$26,$26,$27,$28,
       CASE WHEN $29 THEN NOW() ELSE NULL END,
       CASE WHEN $29 THEN NOW() ELSE NULL END,
       NOW(),NOW()
     )
     RETURNING id`,
    [
      crop.name,
      crop.common_name,
      crop.scientific_name,
      crop.category,
      crop.family,
      crop.botanical_family,
      crop.genus,
      crop.variety,
      crop.growth_cycle,
      crop.planting_season,
      crop.soil_requirements,
      crop.water_requirements,
      crop.optimal_climate,
      crop.region,
      crop.state,
      crop.climate,
      crop.soil_type,
      crop.ph_range,
      crop.season,
      crop.cycle,
      crop.harvest_days,
      crop.average_yield,
      crop.description,
      crop.status,
      crop.workflow_status,
      lookupUserId(usersByKey, crop.authorKey),
      lookupUserId(usersByKey, crop.verifierKey),
      lookupUserId(usersByKey, crop.publisherKey),
      isPublished,
    ],
  );
  return inserted.rows[0].id;
};

const seedCrops = async (client, usersByKey) => {
  const byName = new Map();
  for (const crop of DEMO_CROPS) {
    const existing = await client.query(
      'SELECT id FROM "Crops" WHERE name = $1',
      [crop.name],
    );
    const cropId =
      existing.rowCount > 0
        ? existing.rows[0].id
        : await insertCropRecord(client, crop, usersByKey);
    await ensureCropImage(client, cropId, crop);
    byName.set(crop.name, cropId);
  }
  return byName;
};

const ensurePlagueImage = async (client, plagueId, plague) => {
  const existing = await client.query(
    'SELECT id FROM "PlagueImages" WHERE plague_id = $1 AND url = $2',
    [plagueId, plague.imageUrl],
  );
  if (existing.rowCount > 0) return;

  await client.query(
    `INSERT INTO "PlagueImages" (
       plague_id, url, caption, source, sort_order, "createdAt", "updatedAt"
     )
     VALUES ($1,$2,$3,'Banco Fitosanitario INIFAP',0,NOW(),NOW())`,
    [plagueId, plague.imageUrl, `${plague.name} — Referencia de campo`],
  );
};

const insertPlagueRecord = async (client, plague, usersByKey) => {
  const isPublished = plague.workflow_status === 'published';
  const inserted = await client.query(
    `INSERT INTO "Plagues" (
       name, scientific_name, category, description, risk_level, region,
       symptoms, control_methods, biological_control, biological_cycle,
       verified_by, verified_at, workflow_status, created_by_user_id,
       updated_by_user_id, verified_by_user_id, published_by_user_id,
       published_at, is_monitoring_active, status, "createdAt", "updatedAt"
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,
       CASE WHEN $16 THEN NOW() ELSE NULL END,
       $12,$13,$13,$14,$15,
       CASE WHEN $16 THEN NOW() ELSE NULL END,
       $17,$18,NOW(),NOW()
     )
     RETURNING id`,
    [
      plague.name,
      plague.scientific_name,
      plague.category,
      plague.description,
      plague.risk_level,
      plague.region,
      plague.symptoms,
      plague.control_methods,
      plague.biological_control,
      JSON.stringify(plague.biological_cycle),
      plague.verified_by,
      plague.workflow_status,
      lookupUserId(usersByKey, plague.authorKey),
      lookupUserId(usersByKey, plague.verifierKey),
      lookupUserId(usersByKey, plague.publisherKey),
      isPublished,
      plague.is_monitoring_active,
      plague.status,
    ],
  );
  return inserted.rows[0].id;
};

const seedPlagues = async (client, usersByKey) => {
  const byName = new Map();
  for (const plague of DEMO_PLAGUES) {
    const existing = await client.query(
      'SELECT id FROM "Plagues" WHERE name = $1',
      [plague.name],
    );
    const plagueId =
      existing.rowCount > 0
        ? existing.rows[0].id
        : await insertPlagueRecord(client, plague, usersByKey);
    await ensurePlagueImage(client, plagueId, plague);
    byName.set(plague.name, plagueId);
  }
  return byName;
};

const ensureProductImage = async (client, productId, product) => {
  const existing = await client.query(
    'SELECT id FROM "ProductImages" WHERE product_id = $1 AND image_url = $2',
    [productId, product.imageUrl],
  );
  if (existing.rowCount > 0) return;

  await client.query(
    `INSERT INTO "ProductImages" (
       product_id, image_url, original_name, source, is_primary, display_order,
       "createdAt", "updatedAt"
     )
     VALUES ($1,$2,$3,'Catálogo Técnico INIFAP',true,1,NOW(),NOW())`,
    [productId, product.imageUrl, path.basename(product.imageUrl)],
  );
};

const seedProducts = async (client, usersByKey) => {
  const byName = new Map();
  const authorId = usersByKey.get('inifapBase')?.id || null;
  const publisherId = usersByKey.get('inifapSubrole')?.id || null;

  for (const product of DEMO_PRODUCTS) {
    const existing = await client.query(
      'SELECT id FROM "Products" WHERE name = $1',
      [product.name],
    );
    let productId;
    if (existing.rowCount > 0) {
      productId = existing.rows[0].id;
    } else {
      const inserted = await client.query(
        `INSERT INTO "Products" (
           name, category, active_ingredient, registration_code, manufacturer,
           validation_status, target_crops, description, mode_of_action,
           hazard_category, suggested_dosage, safety_interval_days,
           formulation_type, status, workflow_status, created_by_user_id,
           updated_by_user_id, verified_by_user_id, published_by_user_id,
           verified_at, published_at, "createdAt", "updatedAt"
         )
         VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
           $16,$16,$17,$17,NOW(),NOW(),NOW(),NOW()
         )
         RETURNING id`,
        [
          product.name,
          product.category,
          product.active_ingredient,
          product.registration_code,
          product.manufacturer,
          product.validation_status,
          product.target_crops,
          product.description,
          product.mode_of_action,
          product.hazard_category,
          product.suggested_dosage,
          product.safety_interval_days,
          product.formulation_type,
          product.status,
          product.workflow_status,
          authorId,
          publisherId,
        ],
      );
      productId = inserted.rows[0].id;
    }

    await ensureProductImage(client, productId, product);
    byName.set(product.name, productId);
  }
  return byName;
};

const insertLinkIfMissing = async (client, tableName, colA, colB, idA, idB) => {
  if (!idA || !idB) return;
  const existing = await client.query(
    `SELECT 1 FROM "${tableName}" WHERE ${colA} = $1 AND ${colB} = $2`,
    [idA, idB],
  );
  if (existing.rowCount > 0) return;

  await client.query(
    `INSERT INTO "${tableName}" (${colA}, ${colB}, "createdAt", "updatedAt")
     VALUES ($1, $2, NOW(), NOW())`,
    [idA, idB],
  );
};

const seedCatalogRelations = async (
  client,
  { cropsByName, plaguesByName, productsByName, regionsByName },
) => {
  for (const [cropName, plagueName] of DEMO_CROP_PLAGUES) {
    await insertLinkIfMissing(
      client,
      'CropPlagues',
      'crop_id',
      'plague_id',
      cropsByName.get(cropName),
      plaguesByName.get(plagueName),
    );
  }
  for (const [plagueName, productName] of DEMO_PLAGUE_PRODUCTS) {
    await insertLinkIfMissing(
      client,
      'PlagueProducts',
      'plague_id',
      'product_id',
      plaguesByName.get(plagueName),
      productsByName.get(productName),
    );
  }
  for (const [cropName, productName] of DEMO_CROP_PRODUCTS) {
    await insertLinkIfMissing(
      client,
      'CropProducts',
      'crop_id',
      'product_id',
      cropsByName.get(cropName),
      productsByName.get(productName),
    );
  }
  for (const [plagueName, regionName, riskLevel] of DEMO_PLAGUE_REGIONS) {
    const plagueId = plaguesByName.get(plagueName);
    const regionId = regionsByName.get(regionName);
    if (!plagueId || !regionId) continue;
    const existing = await client.query(
      'SELECT 1 FROM "PlagueRegions" WHERE plague_id = $1 AND region_id = $2',
      [plagueId, regionId],
    );
    if (existing.rowCount > 0) continue;

    await client.query(
      `INSERT INTO "PlagueRegions" (
         plague_id, region_id, risk_level, "createdAt", "updatedAt"
       )
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [plagueId, regionId, riskLevel],
    );
  }
};

const seedRegionalBulletins = async (client, regionsByName, publisherId) => {
  for (const bulletin of DEMO_REGIONAL_BULLETINS) {
    const existing = await client.query(
      'SELECT id FROM "RegionalBulletins" WHERE folio = $1',
      [bulletin.folio],
    );
    if (existing.rowCount > 0) continue;

    const regionId = regionsByName.get(bulletin.regionName) || null;
    await client.query(
      `INSERT INTO "RegionalBulletins" (
         folio, title, summary, content, bulletin_type, severity, state,
         region_id, crop_name, plague_name, plague_scientific_name,
         workflow_status, created_by_user_id, published_by_user_id,
         published_at, "createdAt", "updatedAt"
       )
       VALUES (
         $1,$2,$3,$3,'aviso_semanal',$4,$5,$6,$7,$8,$9,
         'published',$10,$10,
         NOW() - ($11 * interval '1 day'),
         NOW() - ($11 * interval '1 day'),
         NOW() - ($11 * interval '1 day')
       )`,
      [
        bulletin.folio,
        bulletin.title,
        bulletin.summary,
        bulletin.severity,
        bulletin.state,
        regionId,
        bulletin.crop_name,
        bulletin.plague_name,
        bulletin.plague_scientific_name,
        publisherId,
        bulletin.daysAgo,
      ],
    );
  }
};

const formatDateDaysAgo = (daysAgo) => {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
};

const seedFarmLots = async (client, farmId, lots) => {
  for (const lot of lots) {
    const existing = await client.query(
      'SELECT id FROM "FarmLots" WHERE farm_id = $1 AND name = $2',
      [farmId, lot.name],
    );
    if (existing.rowCount > 0) continue;

    await client.query(
      `INSERT INTO "FarmLots" (
         farm_id, name, size_hectares, description, status, "createdAt", "updatedAt"
       )
       VALUES ($1,$2,$3,$4,true,NOW(),NOW())`,
      [
        farmId,
        lot.name,
        lot.size_hectares,
        `Subdivisión operativa de demostración (${lot.size_hectares} ha).`,
      ],
    );
  }
};

const seedCycleStages = async (client, farmCropId, cycle) => {
  const plantingDate = formatDateDaysAgo(cycle.daysAgoPlanted);
  const todayStr = formatDateDaysAgo(0);
  const stages = generateLandCropStages(
    plantingDate,
    cycle.harvestDays,
    todayStr,
  );

  for (const stage of stages) {
    const effectiveStatus = cycle.is_active ? stage.status : 'completed';
    const effectiveActual = cycle.is_active
      ? stage.actual_date
      : stage.estimated_date;
    await client.query(
      `INSERT INTO "FarmCropStages" (
         farm_crop_id, stage_name, stage_order, estimated_date, actual_date,
         status, notes, "createdAt", "updatedAt"
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
       ON CONFLICT (farm_crop_id, stage_order) DO NOTHING`,
      [
        farmCropId,
        stage.stage_name,
        stage.stage_order,
        stage.estimated_date,
        effectiveActual,
        effectiveStatus,
        stage.notes,
      ],
    );
  }
};

const seedFarmCycles = async (client, farmId, cycles, cropsByName) => {
  let primaryCycleId = null;

  for (const cycle of cycles) {
    const cropId = cropsByName.get(cycle.cropName);
    if (!cropId) continue;

    const existing = await client.query(
      `SELECT id FROM "FarmCrops"
        WHERE farm_id = $1 AND crop_id = $2 AND area_section = $3`,
      [farmId, cropId, cycle.area_section],
    );

    let farmCropId;
    if (existing.rowCount > 0) {
      farmCropId = existing.rows[0].id;
    } else {
      const plantingDate = formatDateDaysAgo(cycle.daysAgoPlanted);
      const inserted = await client.query(
        `INSERT INTO "FarmCrops" (
           farm_id, crop_id, area_section, planting_date, is_active, status,
           "createdAt", "updatedAt"
         )
         VALUES ($1,$2,$3,$4::date,$5,$6,NOW(),NOW())
         RETURNING id`,
        [
          farmId,
          cropId,
          cycle.area_section,
          plantingDate,
          cycle.is_active,
          cycle.status,
        ],
      );
      farmCropId = inserted.rows[0].id;
    }

    await seedCycleStages(client, farmCropId, cycle);
    if (!primaryCycleId) primaryCycleId = farmCropId;
  }

  return primaryCycleId;
};

const seedFarmHealthAndApplication = async (
  client,
  { farmSpec, farmId, cycleId, ownerId, plaguesByName, productsByName },
) => {
  if (farmSpec.healthReport) {
    const report = farmSpec.healthReport;
    const observedAt = formatDateDaysAgo(report.daysAgo);
    const existing = await client.query(
      `SELECT id FROM "FarmHealthReports"
        WHERE farm_id = $1 AND plague_name = $2 AND description = $3`,
      [farmId, report.plagueName, report.description],
    );
    if (existing.rowCount === 0) {
      await client.query(
        `INSERT INTO "FarmHealthReports" (
           farm_id, farm_crop_id, plague_id, plague_name, severity,
           description, observed_at, status, created_by_user_id,
           "createdAt", "updatedAt"
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7::date,$8,$9,NOW(),NOW())`,
        [
          farmId,
          cycleId,
          plaguesByName.get(report.plagueName) || null,
          report.plagueName,
          report.severity,
          report.description,
          observedAt,
          report.status,
          ownerId,
        ],
      );
    }
  }

  if (farmSpec.application) {
    const app = farmSpec.application;
    const product = DEMO_PRODUCTS.find((p) => p.name === app.productName);
    const existing = await client.query(
      `SELECT id FROM "FarmApplications"
        WHERE farm_id = $1 AND product_name = $2 AND notes = $3`,
      [farmId, app.productName, app.notes],
    );
    if (existing.rowCount === 0) {
      await client.query(
        `INSERT INTO "FarmApplications" (
           farm_id, farm_crop_id, product_id, product_name, active_ingredient,
           dose_value, dose_unit, applied_at, notes, created_by_user_id,
           "createdAt", "updatedAt"
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,NOW(),NOW())`,
        [
          farmId,
          cycleId,
          productsByName.get(app.productName) || null,
          app.productName,
          product?.active_ingredient || 'Ingrediente autorizado',
          app.dose_value,
          app.dose_unit,
          formatDateDaysAgo(app.daysAgo),
          app.notes,
          ownerId,
        ],
      );
    }
  }
};

const seedFarmsAndOperations = async (
  client,
  { usersByKey, regionsByName, cropsByName, plaguesByName, productsByName },
) => {
  const farmsByName = new Map();

  for (const farmSpec of DEMO_FARMS) {
    const ownerId = usersByKey.get(farmSpec.ownerKey)?.id;
    const regionId = regionsByName.get(farmSpec.regionName) || null;
    const existing = await client.query(
      'SELECT id FROM "Farms" WHERE name = $1',
      [farmSpec.name],
    );

    let farmId;
    if (existing.rowCount > 0) {
      farmId = existing.rows[0].id;
    } else {
      const inserted = await client.query(
        `INSERT INTO "Farms" (
           name, location_lat, location_lng, size_hectares, farming_type,
           municipality, status, user_id, region_id, "createdAt", "updatedAt"
         )
         VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,NOW(),NOW())
         RETURNING id`,
        [
          farmSpec.name,
          farmSpec.location_lat,
          farmSpec.location_lng,
          farmSpec.size_hectares,
          farmSpec.farming_type,
          farmSpec.municipality,
          ownerId,
          regionId,
        ],
      );
      farmId = inserted.rows[0].id;
    }

    farmsByName.set(farmSpec.name, farmId);
    await seedFarmLots(client, farmId, farmSpec.lots);
    const primaryCycleId = await seedFarmCycles(
      client,
      farmId,
      farmSpec.cycles,
      cropsByName,
    );
    await seedFarmHealthAndApplication(client, {
      farmSpec,
      farmId,
      cycleId: primaryCycleId,
      ownerId,
      plaguesByName,
      productsByName,
    });
  }

  return farmsByName;
};

const insertNotificationIfMissing = async (client, item) => {
  const existing = await client.query(
    'SELECT id FROM "Notifications" WHERE user_id = $1 AND title = $2',
    [item.userId, item.title],
  );
  if (existing.rowCount > 0) return;

  await client.query(
    `INSERT INTO "Notifications" (
       user_id, actor_id, category, severity, title, message, action_url,
       is_read, read_at, "createdAt", "updatedAt"
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,
       CASE WHEN $8 THEN NOW() - interval '2 hours' ELSE NULL END,
       NOW(),NOW()
     )`,
    [
      item.userId,
      item.actorId,
      item.category,
      item.severity,
      item.title,
      item.message,
      item.actionUrl,
      item.isRead,
    ],
  );
};

const seedNotifications = async (
  client,
  { usersByKey, plaguesByName, cropsByName },
) => {
  const adminId = usersByKey.get('admin').id;
  const tecnicoId = usersByKey.get('inifapBase').id;
  const coordId = usersByKey.get('inifapSubrole').id;
  const farmerId = usersByKey.get('agricultor').id;
  const reviewPlagueId = plaguesByName.get('Barrenador del Tallo de Maíz');
  const suggestedPlagueId = plaguesByName.get('Mosca Blanca del Algodonero');
  const suggestedCropId = cropsByName.get(
    'Aguacate Hass (Propuesta Ciudadana)',
  );

  const items = [
    {
      userId: coordId,
      actorId: tecnicoId,
      category: 'editorial',
      severity: 'warning',
      title: 'Ficha técnica en revisión: Barrenador del Tallo de Maíz',
      message:
        'Técnico Fitosanitario Base Demo envió la ficha de Diatraea grandiosella para dictamen y publicación.',
      actionUrl: `/private/plagues/${reviewPlagueId}`,
      isRead: false,
    },
    {
      userId: adminId,
      actorId: farmerId,
      category: 'editorial',
      severity: 'info',
      title: 'Nueva propuesta de Plaga / Especie: Mosca Blanca del Algodonero',
      message:
        'Productor Regional Demostración (agricultor) propuso incorporar "Mosca Blanca del Algodonero" al catálogo oficial.',
      actionUrl: `/private/plagues/${suggestedPlagueId}`,
      isRead: false,
    },
    {
      userId: coordId,
      actorId: farmerId,
      category: 'editorial',
      severity: 'info',
      title: 'Nueva propuesta de Plaga / Especie: Mosca Blanca del Algodonero',
      message:
        'Propuesta ciudadana pendiente de verificación técnica en la bandeja editorial.',
      actionUrl: `/private/plagues/${suggestedPlagueId}`,
      isRead: false,
    },
    {
      userId: tecnicoId,
      actorId: farmerId,
      category: 'editorial',
      severity: 'info',
      title: 'Nueva propuesta de Cultivo Agrícola: Aguacate Hass',
      message:
        'Productor Regional Demostración sugirió incorporar paquete tecnológico de Aguacate Hass.',
      actionUrl: `/private/crops/${suggestedCropId}`,
      isRead: false,
    },
    {
      userId: adminId,
      actorId: tecnicoId,
      category: 'monitoreo',
      severity: 'warning',
      title: 'Alerta sanitaria alta en Parcela Valle Verde Norte',
      message:
        'Se registró reporte abierto de Gusano Cogollero en Sinaloa con severidad alta.',
      actionUrl: '/private/lands',
      isRead: false,
    },
    {
      userId: farmerId,
      actorId: coordId,
      category: 'sistema',
      severity: 'success',
      title: 'Bienvenido al entorno de demostración AgroSystem INIFAP',
      message:
        'Consulta catálogos oficiales, propone nuevas fichas o valida tu adscripción con un código INIFAP.',
      actionUrl: '/auth/inifap-upgrade',
      isRead: true,
    },
  ];

  for (const item of items) {
    await insertNotificationIfMissing(client, item);
  }
};

const insertAuditIfMissing = async (client, entry) => {
  const existing = await client.query(
    `SELECT id FROM "AuditLogs" WHERE new_values->>'demo_key' = $1`,
    [entry.demoKey],
  );
  if (existing.rowCount > 0) return;

  await client.query(
    `INSERT INTO "AuditLogs" (
       action, table_name, record_id, old_values, new_values, user_id,
       "createdAt", "updatedAt"
     )
     VALUES (
       $1,$2,$3,$4::jsonb,$5::jsonb,$6,
       NOW() - ($7 * interval '1 hour'),
       NOW() - ($7 * interval '1 hour')
     )`,
    [
      entry.action,
      entry.tableName,
      entry.recordId,
      entry.oldValues ? JSON.stringify(entry.oldValues) : null,
      JSON.stringify({ ...entry.newValues, demo_key: entry.demoKey }),
      entry.userId,
      entry.hoursAgo,
    ],
  );
};

const seedAuditLogs = async (
  client,
  { usersByKey, plaguesByName, cropsByName, productsByName, farmsByName },
) => {
  const adminId = usersByKey.get('admin').id;
  const tecnicoId = usersByKey.get('inifapBase').id;
  const coordId = usersByKey.get('inifapSubrole').id;
  const farmerId = usersByKey.get('agricultor').id;

  const entries = [
    {
      demoKey: 'demo-audit-suggestion-plague',
      action: 'create',
      tableName: 'Plagues',
      recordId: plaguesByName.get('Mosca Blanca del Algodonero'),
      oldValues: null,
      newValues: {
        name: 'Mosca Blanca del Algodonero',
        workflow_status: 'in_review',
        source: 'Colaboración Ciudadana / Científica',
        author_role: 'agricultor',
      },
      userId: farmerId,
      hoursAgo: 2,
    },
    {
      demoKey: 'demo-audit-suggestion-crop',
      action: 'create',
      tableName: 'Crops',
      recordId: cropsByName.get('Aguacate Hass (Propuesta Ciudadana)'),
      oldValues: null,
      newValues: {
        name: 'Aguacate Hass (Propuesta Ciudadana)',
        workflow_status: 'in_review',
        source: 'Colaboración Ciudadana / Científica',
        author_role: 'agricultor',
      },
      userId: farmerId,
      hoursAgo: 3,
    },
    {
      demoKey: 'demo-audit-review-plague',
      action: 'status_change',
      tableName: 'Plagues',
      recordId: plaguesByName.get('Barrenador del Tallo de Maíz'),
      oldValues: { workflow_status: 'draft' },
      newValues: {
        name: 'Barrenador del Tallo de Maíz',
        workflow_status: 'in_review',
      },
      userId: tecnicoId,
      hoursAgo: 5,
    },
    {
      demoKey: 'demo-audit-publish-plague',
      action: 'approve',
      tableName: 'Plagues',
      recordId: plaguesByName.get('Gusano Cogollero'),
      oldValues: { workflow_status: 'verified' },
      newValues: {
        name: 'Gusano Cogollero',
        workflow_status: 'published',
      },
      userId: coordId,
      hoursAgo: 12,
    },
    {
      demoKey: 'demo-audit-publish-product',
      action: 'approve',
      tableName: 'Products',
      recordId: productsByName.get('Coragen'),
      oldValues: { workflow_status: 'verified' },
      newValues: { name: 'Coragen', workflow_status: 'published' },
      userId: coordId,
      hoursAgo: 18,
    },
    {
      demoKey: 'demo-audit-farm-cycle',
      action: 'create',
      tableName: 'Farms',
      recordId: farmsByName.get('Parcela Valle Verde Norte'),
      oldValues: null,
      newValues: {
        name: 'Parcela Valle Verde Norte',
        municipality: 'Culiacán',
      },
      userId: farmerId,
      hoursAgo: 24,
    },
    {
      demoKey: 'demo-audit-inifap-code',
      action: 'create',
      tableName: 'Users',
      recordId: adminId,
      oldValues: null,
      newValues: {
        name: 'Código INIFAP de Demostración',
        action: 'generate_inifap_code',
      },
      userId: adminId,
      hoursAgo: 30,
    },
  ];

  for (const entry of entries) {
    await insertAuditIfMissing(client, entry);
  }
};

const fetchDemoRowCounts = async (client) => {
  const tables = [
    'RbacRoles',
    'Users',
    'InifapCodes',
    'Regions',
    'ActiveIngredients',
    'suppliers',
    'Crops',
    'CropImages',
    'Plagues',
    'PlagueImages',
    'Products',
    'ProductImages',
    'CropPlagues',
    'PlagueProducts',
    'CropProducts',
    'PlagueRegions',
    'RegionalBulletins',
    'Farms',
    'FarmLots',
    'FarmCrops',
    'FarmCropStages',
    'FarmHealthReports',
    'FarmApplications',
    'Notifications',
    'AuditLogs',
  ];

  const counts = {};
  for (const table of tables) {
    const res = await client.query(
      `SELECT COUNT(*)::int AS total FROM "${table}"`,
    );
    counts[table] = Number(res.rows[0]?.total || 0);
  }
  return counts;
};

const printBootstrapSummary = ({
  dbConfig,
  createdDatabase,
  usersByKey,
  counts,
}) => {
  console.log('\n============================================================');
  console.log('  AGROSYSTEM INIFAP — ENTORNO DEMO LISTO');
  console.log('============================================================');
  console.log(
    `Base de datos : ${dbConfig.database} (${dbConfig.host}:${dbConfig.port}) ${createdDatabase ? '[CREADA]' : '[EXISTENTE]'}`,
  );
  console.log('\nUsuarios de demostración (@demo.agrosystem.invalid):');
  for (const user of usersByKey.values()) {
    const subRoleLabel = user.rbacRoleName
      ? `subrol=${user.rbacRoleName}`
      : 'sin subrol';
    console.log(
      `  - [${user.role.padEnd(10)} | ${subRoleLabel}] ${user.email}  /  ${user.credential}`,
    );
  }
  console.log(`\nCódigo INIFAP disponible para canje: ${DEMO_INIFAP_CODE}`);
  console.log('\nConteo estable de registros en BD demo:');
  for (const [table, total] of Object.entries(counts)) {
    console.log(`  - ${table.padEnd(20)}: ${total}`);
  }
  console.log('============================================================\n');
};

export const setupDemoDb = async ({
  envFile = null,
  env = process.env,
} = {}) => {
  loadDemoEnv(envFile);
  const dbConfig = assertDemoEnvironment(env);
  const usersSpec = buildDemoUsers(env);
  verifyDemoImagesExist();

  const createdDatabase = await ensureDemoDatabaseExists(dbConfig, env);
  console.log(
    `🛠️  Ejecutando migraciones Sequelize en "${dbConfig.database}"...`,
  );
  runMigrationsOnDemoDb(dbConfig);

  const pool = createDemoPool(dbConfig);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureRegionalBulletinsTable(client);
    const rbacBySlug = await loadRbacRoleMap(client);
    const usersByKey = await seedDemoUsers(client, usersSpec, rbacBySlug);
    await seedDemoInifapCode(client, usersByKey.get('admin').id);
    const regionsByName = await seedRegions(client);
    await seedActiveIngredients(client, usersByKey.get('admin').id);
    await seedSuppliers(client);
    const cropsByName = await seedCrops(client, usersByKey);
    const plaguesByName = await seedPlagues(client, usersByKey);
    const productsByName = await seedProducts(client, usersByKey);
    await seedCatalogRelations(client, {
      cropsByName,
      plaguesByName,
      productsByName,
      regionsByName,
    });
    await seedRegionalBulletins(
      client,
      regionsByName,
      usersByKey.get('inifapSubrole').id,
    );
    const farmsByName = await seedFarmsAndOperations(client, {
      usersByKey,
      regionsByName,
      cropsByName,
      plaguesByName,
      productsByName,
    });
    await seedNotifications(client, { usersByKey, plaguesByName, cropsByName });
    await seedAuditLogs(client, {
      usersByKey,
      plaguesByName,
      cropsByName,
      productsByName,
      farmsByName,
    });
    await client.query('COMMIT');

    const counts = await fetchDemoRowCounts(client);
    printBootstrapSummary({ dbConfig, createdDatabase, usersByKey, counts });
    return { database: dbConfig.database, createdDatabase, counts };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const args = parseDemoCliArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Uso: node scripts/demo/setupDemoDb.js [--env-file .env.demo]');
    process.exit(0);
  }
  setupDemoDb({ envFile: args.envFile })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Error en setupDemoDb:', error.message);
      process.exit(1);
    });
}
