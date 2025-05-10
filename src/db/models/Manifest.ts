import { Model, DataTypes, Sequelize } from 'sequelize';
import { ReleaseChannel, Platform } from '../../types';

interface ManifestAttributes {
  id: number;
  appId: number;
  updateId: number | null;
  version: string;
  channel: ReleaseChannel;
  runtimeVersion: string;
  platforms: Platform[];
  content: object;
  createdAt: Date;
  updatedAt: Date;
}

interface ManifestCreationAttributes {
  appId: number;
  updateId?: number;
  version: string;
  channel: ReleaseChannel;
  runtimeVersion: string;
  platforms: Platform[];
  content: object;
}

class Manifest extends Model<ManifestAttributes, ManifestCreationAttributes> implements ManifestAttributes {
  public id!: number;
  public appId!: number;
  public updateId!: number | null;
  public version!: string;
  public channel!: ReleaseChannel;
  public runtimeVersion!: string;
  public platforms!: Platform[];
  public content!: object;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public static associate(models: any): void {
    Manifest.belongsTo(models.App, {
      foreignKey: 'appId',
      as: 'app'
    });

    Manifest.belongsTo(models.Update, {
      foreignKey: 'updateId',
      as: 'update',
      constraints: false
    });

    Manifest.hasOne(models.Update, {
      foreignKey: 'manifestId',
      as: 'linkedUpdate',
      constraints: false
    });
  }

  // Static initialization method
  public static initialize(sequelize: Sequelize): void {
    Manifest.init({
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
      updateId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'update_id',
        references: {
          model: 'updates',
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
      },
      runtimeVersion: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'runtime_version'
      },
      platforms: {
        type: DataTypes.ARRAY(DataTypes.ENUM(...Object.values(Platform))),
        allowNull: false,
      },
      content: {
        type: DataTypes.JSONB,
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
      tableName: 'manifests',
      timestamps: true,
      underscored: true
    });
  }
}

export default Manifest;