import { Model, DataTypes, Sequelize } from 'sequelize';
import { ReleaseChannel } from '../../types';

interface UpdateAttributes {
  id: number;
  appId: number;
  version: string;
  channel: ReleaseChannel;
  runtimeVersion: string;
  isRollback: boolean;
  bundleId: number;
  manifestId: number | null;
  publishedBy: number;
  createdAt: Date;
  updatedAt: Date;
}

interface UpdateCreationAttributes {
  appId: number;
  version: string;
  channel: ReleaseChannel;
  runtimeVersion: string;
  isRollback?: boolean;
  bundleId: number;
  manifestId?: number;
  publishedBy: number;
}

class Update extends Model<UpdateAttributes, UpdateCreationAttributes> implements UpdateAttributes {
  public id!: number;
  public appId!: number;
  public version!: string;
  public channel!: ReleaseChannel;
  public runtimeVersion!: string;
  public isRollback!: boolean;
  public bundleId!: number;
  public manifestId!: number | null;
  public publishedBy!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public static associate(models: any): void {
    Update.belongsTo(models.App, {
      foreignKey: 'appId',
      as: 'app'
    });

    Update.belongsTo(models.User, {
      foreignKey: 'publishedBy',
      as: 'publisher'
    });

    Update.belongsTo(models.Bundle, {
      foreignKey: 'bundleId',
      as: 'bundle'
    });

    Update.belongsTo(models.Manifest, {
      foreignKey: 'manifestId',
      as: 'manifest',
      constraints: false
    });

    Update.hasMany(models.Asset, {
      foreignKey: 'updateId',
      as: 'assets'
    });
  }

  // Static initialization method
  public static initialize(sequelize: Sequelize): void {
    Update.init({
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
      version: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      channel: {
        type: DataTypes.ENUM(...Object.values(ReleaseChannel)),
        allowNull: false,
        defaultValue: ReleaseChannel.DEVELOPMENT,
      },
      runtimeVersion: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'runtime_version'
      },
      isRollback: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_rollback'
      },
      bundleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'bundle_id',
        references: {
          model: 'bundles',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      manifestId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'manifest_id',
        references: {
          model: 'manifests',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      publishedBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'published_by',
        references: {
          model: 'users',
          key: 'id'
        }
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
      tableName: 'updates',
      timestamps: true,
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ['app_id', 'version', 'channel']
        }
      ]
    });
  }
}

export default Update;