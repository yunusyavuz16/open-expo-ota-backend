import { Model, DataTypes, Sequelize } from 'sequelize';

interface BundleAttributes {
  id: number;
  appId: number;
  hash: string;
  storageType: string;
  storagePath: string;
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

interface BundleCreationAttributes {
  appId: number;
  hash: string;
  storageType: string;
  storagePath: string;
  size: number;
}

class Bundle extends Model<BundleAttributes, BundleCreationAttributes> implements BundleAttributes {
  public id!: number;
  public appId!: number;
  public hash!: string;
  public storageType!: string;
  public storagePath!: string;
  public size!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public static associate(models: any): void {
    Bundle.belongsTo(models.App, {
      foreignKey: 'appId',
      as: 'app'
    });

    Bundle.hasMany(models.Update, {
      foreignKey: 'bundleId',
      as: 'updates'
    });
  }

  // Static initialization method
  public static initialize(sequelize: Sequelize): void {
    Bundle.init({
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      appId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'app_id',
        references: {
          model: 'apps',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      hash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      storageType: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'storage_type'
      },
      storagePath: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'storage_path'
      },
      size: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at'
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'updated_at'
      }
    }, {
      sequelize,
      tableName: 'bundles',
      timestamps: true,
      underscored: true
    });
  }
}

export default Bundle;