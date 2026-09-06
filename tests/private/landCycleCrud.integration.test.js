import { afterAll, describe, expect, it } from '@jest/globals';
import db from '../../src/models/index.js';
import { generateLandCropStages } from '../../src/services/landPhenologyService.js';

const isTestDatabase = /test/i.test(process.env.DB_NAME || '');
const describeDatabase = isTestDatabase ? describe : describe.skip;

describeDatabase('CRUD integrado de ciclos de terreno', () => {
  afterAll(async () => {
    await db.sequelize.close();
  });

  it('crea un ciclo y sus etapas usando el identificador generado por PostgreSQL', async () => {
    const transaction = await db.sequelize.transaction();

    try {
      const farm = await db.Farm.findOne({
        where: { status: true },
        transaction,
      });
      const crop = await db.Crop.findOne({
        where: { workflow_status: 'published' },
        transaction,
      });
      const plague = await db.Plague.findOne({
        where: { workflow_status: 'published', status: true },
        transaction,
      });
      const product = await db.Product.findOne({
        where: { status: true },
        transaction,
      });

      expect(farm).not.toBeNull();
      expect(crop).not.toBeNull();
      expect(plague).not.toBeNull();
      expect(product).not.toBeNull();

      const farmCrop = await db.FarmCrop.create(
        {
          farm_id: farm.id,
          crop_id: crop.id,
          planting_date: '2026-09-07',
          area_section: 'Integración CRUD',
          is_active: true,
          status: 'active',
        },
        { transaction },
      );

      expect(farmCrop.id).toEqual(expect.any(Number));

      const stages = generateLandCropStages(
        '2026-09-07',
        Number(crop.harvest_days) || 120,
      ).map((stage) => ({ ...stage, farm_crop_id: farmCrop.id }));

      await db.FarmCropStage.bulkCreate(stages, { transaction });

      await expect(
        db.FarmCropStage.count({
          where: { farm_crop_id: farmCrop.id },
          transaction,
        }),
      ).resolves.toBe(stages.length);

      const firstStage = await db.FarmCropStage.findOne({
        where: { farm_crop_id: farmCrop.id, stage_order: 1 },
        transaction,
      });
      await firstStage.update(
        { status: 'completed', actual_date: '2026-09-07' },
        { transaction },
      );
      await expect(firstStage.reload({ transaction })).resolves.toMatchObject({
        status: 'completed',
      });

      const healthReport = await db.FarmHealthReport.create(
        {
          farm_id: farm.id,
          farm_crop_id: farmCrop.id,
          plague_id: plague.id,
          plague_name: plague.name,
          severity: 'low',
          description: 'Hallazgo de integración',
          observed_at: '2026-09-07',
          status: 'open',
          created_by_user_id: farm.user_id,
        },
        { transaction },
      );
      expect(healthReport.id).toEqual(expect.any(Number));

      const application = await db.FarmApplication.create(
        {
          farm_id: farm.id,
          farm_crop_id: farmCrop.id,
          product_id: product.id,
          product_name: product.name,
          dose_value: 1.5,
          dose_unit: 'L/ha',
          applied_at: '2026-09-07',
          notes: 'Aplicación de integración',
          created_by_user_id: farm.user_id,
        },
        { transaction },
      );
      expect(application.id).toEqual(expect.any(Number));

      await farmCrop.update(
        { is_active: false, status: 'completed' },
        { transaction },
      );
      await expect(farmCrop.reload({ transaction })).resolves.toMatchObject({
        is_active: false,
        status: 'completed',
      });
    } finally {
      await transaction.rollback();
    }
  });
});
