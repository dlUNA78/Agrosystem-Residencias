// src/migrations/20261104120001-add-code-hash-and-moderator-subrole.js
import crypto from 'node:crypto';

export default {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('InifapCodes');

    // 1. Agregar code_hash a InifapCodes si no existe
    if (!tableDesc.code_hash) {
      await queryInterface.addColumn('InifapCodes', 'code_hash', {
        type: Sequelize.STRING(64),
        allowNull: true,
      });
      await queryInterface.addIndex('InifapCodes', ['code_hash'], {
        name: 'idx_inifap_codes_hash',
      });
    }

    // 2. Agregar code_masked a InifapCodes si no existe
    if (!tableDesc.code_masked) {
      await queryInterface.addColumn('InifapCodes', 'code_masked', {
        type: Sequelize.STRING(60),
        allowNull: true,
      });
    }

    // 3. Retrocompatibilidad: hashear y enmascarar códigos existentes
    const existingCodes = await queryInterface.sequelize.query(
      'SELECT id, code FROM "InifapCodes" WHERE "code_hash" IS NULL AND code IS NOT NULL;',
      { type: Sequelize.QueryTypes.SELECT },
    );

    for (const c of existingCodes) {
      if (c.code) {
        const hash = crypto
          .createHash('sha256')
          .update(c.code.trim().toUpperCase())
          .digest('hex');
        const codeTrimmed = c.code.trim().toUpperCase();
        const masked =
          codeTrimmed.length > 8
            ? `${codeTrimmed.slice(0, 4)}-****-****-${codeTrimmed.slice(-4)}`
            : `${codeTrimmed.slice(0, 2)}****`;

        await queryInterface.sequelize.query(
          'UPDATE "InifapCodes" SET "code_hash" = :hash, "code_masked" = :masked WHERE id = :id;',
          { replacements: { hash, masked, id: c.id } },
        );
      }
    }

    // 4. Sembrar sub-rol oficial "Moderador Institucional" en RbacRoles
    const [existingModerator] = await queryInterface.sequelize.query(
      'SELECT id FROM "RbacRoles" WHERE slug = :slug LIMIT 1;',
      {
        replacements: { slug: 'moderador-inifap' },
        type: Sequelize.QueryTypes.SELECT,
      },
    );

    if (!existingModerator) {
      const now = new Date();
      const moderatorPermissions = JSON.stringify([
        'crops.viewPrivate',
        'crops.create',
        'crops.edit',
        'crops.manageRelations',
        'crops.submitReview',
        'crops.verify',
        'plagues.viewPrivate',
        'plagues.create',
        'plagues.edit',
        'plagues.manageRelations',
        'plagues.submitReview',
        'plagues.verify',
        'products.viewPrivate',
        'products.create',
        'products.edit',
        'products.manageRelations',
        'products.submitReview',
        'products.verify',
        'ingredients.view',
        'ingredients.manage',
        'suppliers.view',
        'suppliers.manage',
        'lands.viewPrivate',
        'reports.view',
        'users.view',
      ]);

      await queryInterface.sequelize.query(
        `INSERT INTO "RbacRoles" (slug, name, description, base_role, badge_color, permissions, is_system, "createdAt", "updatedAt")
         VALUES (:slug, :name, :description, :base_role, :badge_color, :permissions::jsonb, :is_system, :createdAt, :updatedAt);`,
        {
          replacements: {
            slug: 'moderador-inifap',
            name: 'Moderador Institucional',
            description:
              'Supervisión y control técnico de catálogos e insumos, moderación de usuarios básicos sin acceso a auditoría ni gobernanza raíz.',
            base_role: 'inifap',
            badge_color: 'amber',
            permissions: moderatorPermissions,
            is_system: true,
            createdAt: now,
            updatedAt: now,
          },
        },
      );
    }
  },

  async down(queryInterface) {
    const tableDesc = await queryInterface.describeTable('InifapCodes');
    if (tableDesc.code_hash) {
      await queryInterface.removeColumn('InifapCodes', 'code_hash');
    }
    if (tableDesc.code_masked) {
      await queryInterface.removeColumn('InifapCodes', 'code_masked');
    }
  },
};
