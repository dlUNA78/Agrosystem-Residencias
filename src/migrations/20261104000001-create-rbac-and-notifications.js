export default {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const normalizeTableName = (t) =>
      typeof t === 'string' ? t : t?.tableName;
    const existingTableNames = tables.map(normalizeTableName);

    // 1. Crear tabla RbacRoles si no existe
    if (!existingTableNames.includes('RbacRoles')) {
      await queryInterface.createTable('RbacRoles', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        slug: {
          type: Sequelize.STRING(80),
          allowNull: false,
          unique: true,
        },
        name: {
          type: Sequelize.STRING(120),
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        base_role: {
          type: Sequelize.STRING(40),
          allowNull: false,
          defaultValue: 'inifap',
        },
        badge_color: {
          type: Sequelize.STRING(30),
          allowNull: false,
          defaultValue: 'emerald',
        },
        permissions: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        is_system: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });

      await queryInterface.addIndex('RbacRoles', ['slug'], {
        name: 'idx_rbac_roles_slug',
        unique: true,
      });
      await queryInterface.addIndex('RbacRoles', ['base_role'], {
        name: 'idx_rbac_roles_base_role',
      });
    }

    // 2. Agregar columnas a Users
    const usersDescription = await queryInterface.describeTable('Users');
    if (!usersDescription.rbac_role_id) {
      await queryInterface.addColumn('Users', 'rbac_role_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'RbacRoles',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
    if (!usersDescription.custom_permissions) {
      await queryInterface.addColumn('Users', 'custom_permissions', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: { allow: [], deny: [] },
      });
    }

    // 3. Agregar columnas a InifapCodes
    const inifapCodesDescription =
      await queryInterface.describeTable('InifapCodes');
    if (!inifapCodesDescription.rbac_role_id) {
      await queryInterface.addColumn('InifapCodes', 'rbac_role_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'RbacRoles',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
    if (!inifapCodesDescription.created_by_user_id) {
      await queryInterface.addColumn('InifapCodes', 'created_by_user_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
    if (!inifapCodesDescription.revoked_at) {
      await queryInterface.addColumn('InifapCodes', 'revoked_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    // 4. Crear tabla Notifications
    if (!existingTableNames.includes('Notifications')) {
      await queryInterface.createTable('Notifications', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        actor_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        category: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'sistema',
        },
        severity: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: 'info',
        },
        title: {
          type: Sequelize.STRING(255),
          allowNull: false,
        },
        message: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        action_url: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        is_read: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        read_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
        },
      });

      await queryInterface.addIndex('Notifications', ['user_id'], {
        name: 'idx_notifications_user_id',
      });
      await queryInterface.addIndex('Notifications', ['user_id', 'is_read'], {
        name: 'idx_notifications_user_unread',
      });
      await queryInterface.addIndex('Notifications', ['createdAt'], {
        name: 'idx_notifications_created_at',
      });
    }

    // 5. Sembrar roles de sistema iniciales en RbacRoles
    const defaultRoles = [
      {
        slug: 'coordinador-editorial',
        name: 'Coordinador Editorial',
        description:
          'Supervisa, valida y publica contenidos fitosanitarios (Cultivos, Plagas y Productos).',
        base_role: 'inifap',
        badge_color: 'purple',
        permissions: JSON.stringify([
          'crops.publish',
          'crops.archive',
          'crops.restore',
          'plagues.publish',
          'plagues.archive',
          'plagues.restore',
          'products.publish',
          'products.archive',
          'products.restore',
        ]),
        is_system: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        slug: 'curador-insumos',
        name: 'Curador de Insumos y Proveedores',
        description:
          'Administra ingredientes activos, catálogo de agroquímicos y directorio de empresas proveedoras.',
        base_role: 'inifap',
        badge_color: 'sky',
        permissions: JSON.stringify([
          'ingredients.manage',
          'suppliers.manage',
          'products.publish',
        ]),
        is_system: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        slug: 'auditor-fitosanitario',
        name: 'Auditor Fitosanitario',
        description:
          'Inspecciona bitácoras de auditoría, reportes epidemiológicos y trazabilidad de parcelas sin privilegios administrativos totales.',
        base_role: 'inifap',
        badge_color: 'amber',
        permissions: JSON.stringify([
          'audit.view',
          'reports.export',
          'lands.viewDetailed',
        ]),
        is_system: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    for (const role of defaultRoles) {
      const existing = await queryInterface.rawSelect(
        'RbacRoles',
        { where: { slug: role.slug } },
        ['id'],
      );
      if (!existing) {
        await queryInterface.bulkInsert('RbacRoles', [role]);
      }
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const normalizeTableName = (t) =>
      typeof t === 'string' ? t : t?.tableName;
    const existingTableNames = tables.map(normalizeTableName);

    if (existingTableNames.includes('Notifications')) {
      await queryInterface.dropTable('Notifications');
    }

    const inifapCodesDescription =
      await queryInterface.describeTable('InifapCodes');
    if (inifapCodesDescription.rbac_role_id) {
      await queryInterface.removeColumn('InifapCodes', 'rbac_role_id');
    }
    if (inifapCodesDescription.created_by_user_id) {
      await queryInterface.removeColumn('InifapCodes', 'created_by_user_id');
    }
    if (inifapCodesDescription.revoked_at) {
      await queryInterface.removeColumn('InifapCodes', 'revoked_at');
    }

    const usersDescription = await queryInterface.describeTable('Users');
    if (usersDescription.rbac_role_id) {
      await queryInterface.removeColumn('Users', 'rbac_role_id');
    }
    if (usersDescription.custom_permissions) {
      await queryInterface.removeColumn('Users', 'custom_permissions');
    }

    if (existingTableNames.includes('RbacRoles')) {
      await queryInterface.dropTable('RbacRoles');
    }
  },
};
