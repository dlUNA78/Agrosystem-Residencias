const addAreaSection = async (queryInterface, Sequelize) => {
  const columns = await queryInterface.describeTable('FarmCrops');
  if (!columns.area_section) {
    await queryInterface.addColumn('FarmCrops', 'area_section', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  }
};

export default {
  async up(queryInterface, Sequelize) {
    await addAreaSection(queryInterface, Sequelize);

    await queryInterface.createTable('FarmCropStages', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      farm_crop_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'FarmCrops', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      stage_name: { type: Sequelize.STRING(150), allowNull: false },
      stage_order: { type: Sequelize.INTEGER, allowNull: false },
      estimated_date: { type: Sequelize.DATEONLY, allowNull: true },
      actual_date: { type: Sequelize.DATEONLY, allowNull: true },
      status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'pending',
      },
      notes: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addConstraint('FarmCropStages', {
      fields: ['farm_crop_id', 'stage_order'],
      type: 'unique',
      name: 'farm_crop_stage_order_unique',
    });

    await queryInterface.createTable('FarmHealthReports', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      farm_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Farms', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      farm_crop_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'FarmCrops', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      plague_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Plagues', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      plague_name: { type: Sequelize.STRING(200), allowNull: false },
      severity: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'low',
      },
      description: { type: Sequelize.TEXT, allowNull: true },
      observed_at: { type: Sequelize.DATEONLY, allowNull: false },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'open',
      },
      created_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('FarmApplications', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      farm_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Farms', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      farm_crop_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'FarmCrops', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Products', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      product_name: { type: Sequelize.STRING(200), allowNull: false },
      active_ingredient: { type: Sequelize.STRING(200), allowNull: true },
      dose_value: { type: Sequelize.DECIMAL(10, 3), allowNull: false },
      dose_unit: { type: Sequelize.STRING(20), allowNull: false },
      applied_at: { type: Sequelize.DATEONLY, allowNull: false },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_by_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('FarmApplications');
    await queryInterface.dropTable('FarmHealthReports');
    await queryInterface.dropTable('FarmCropStages');

    const columns = await queryInterface.describeTable('FarmCrops');
    if (columns.area_section) {
      await queryInterface.removeColumn('FarmCrops', 'area_section');
    }
  },
};
