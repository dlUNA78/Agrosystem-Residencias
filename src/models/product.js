import { Model } from 'sequelize';

export default (sequelize, DataTypes) => {
  class Product extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Un producto puede recomendarse para muchas plagas (tabla pivote PlagueProducts)
      Product.belongsToMany(models.Plague, {
        through: 'PlagueProducts',
        foreignKey: 'product_id',
        otherKey: 'plague_id',
        as: 'plagues',
      });

      // Un producto está autorizado para muchos cultivos (tabla pivote CropProducts)
      Product.belongsToMany(models.Crop, {
        through: 'CropProducts',
        foreignKey: 'product_id',
        otherKey: 'crop_id',
        as: 'crops',
      });
      // Un producto tiene muchas imágenes de referencia
      Product.hasMany(models.ProductImage, {
        foreignKey: 'product_id',
        as: 'images',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });
      Product.belongsTo(models.User, {
        foreignKey: 'created_by_user_id',
        as: 'createdBy',
      });
      Product.belongsTo(models.User, {
        foreignKey: 'updated_by_user_id',
        as: 'updatedBy',
      });
      Product.belongsTo(models.User, {
        foreignKey: 'verified_by_user_id',
        as: 'verifiedBy',
      });
      Product.belongsTo(models.User, {
        foreignKey: 'published_by_user_id',
        as: 'publishedBy',
      });
      Product.belongsTo(models.User, {
        foreignKey: 'archive_requested_by_user_id',
        as: 'archiveRequestedBy',
      });
      Product.belongsTo(models.User, {
        foreignKey: 'archived_by_user_id',
        as: 'archivedBy',
      });
    }
  }

  Product.init(
    {
      name: DataTypes.STRING,
      category: DataTypes.STRING,
      active_ingredient: DataTypes.STRING,
      registration_code: DataTypes.STRING,
      manufacturer: DataTypes.STRING,
      validation_status: DataTypes.STRING,
      expiration_date: DataTypes.DATE,
      target_crops: DataTypes.TEXT,
      description: DataTypes.TEXT,
      mode_of_action: DataTypes.STRING,
      hazard_category: DataTypes.STRING,
      suggested_dosage: DataTypes.STRING,
      safety_interval_days: DataTypes.INTEGER,
      formulation_type: DataTypes.STRING,
      safety_sheet_url: DataTypes.STRING,
      status: DataTypes.BOOLEAN,
      workflow_status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'draft',
      },
      created_by_user_id: DataTypes.INTEGER,
      updated_by_user_id: DataTypes.INTEGER,
      verified_by_user_id: DataTypes.INTEGER,
      published_by_user_id: DataTypes.INTEGER,
      verified_at: DataTypes.DATE,
      published_at: DataTypes.DATE,
      review_notes: DataTypes.TEXT,
      archive_reason_category: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      archive_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      archive_requested_by_user_id: DataTypes.INTEGER,
      archive_requested_at: DataTypes.DATE,
      archived_by_user_id: DataTypes.INTEGER,
      archived_at: DataTypes.DATE,
      archive_approval_notes: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: 'Product',
    },
  );

  return Product;
};
