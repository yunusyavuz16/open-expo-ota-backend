import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { ReleaseChannel } from '../types';

interface UpdateAttributes {
  id: number;
  appId: number;
  version: string;
  channel: ReleaseChannel;
  runtimeVersion: string;
  isRollback: boolean;
  bundleId: number;
  manifestId: number;
  publishedBy: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UpdateInput extends Optional<UpdateAttributes, 'id' | 'isRollback' | 'createdAt' | 'updatedAt'> {}
export interface UpdateOutput extends Required<UpdateAttributes> {}

class Update extends Model<UpdateAttributes, UpdateInput> implements UpdateAttributes {
  public id!: number;
  public appId!: number;
  public version!: string;
  public channel!: ReleaseChannel;
  public runtimeVersion!: string;
  public isRollback!: boolean;
  public bundleId!: number;
  public manifestId!: number;
  public publishedBy!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Define associations
  static associate(models: any) {
    Update.belongsTo(models.App, { foreignKey: 'appId', as: 'app' });
    Update.belongsTo(models.User, { foreignKey: 'publishedBy', as: 'publisher' });
    Update.belongsTo(models.Bundle, { foreignKey: 'bundleId', as: 'bundle' });
    Update.belongsTo(models.Manifest, { foreignKey: 'manifestId', as: 'manifest', constraints: false });
    Update.hasMany(models.Asset, { foreignKey: 'updateId', as: 'assets' });
  }
}

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
  },
  version: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  channel: {
    type: DataTypes.ENUM(...Object.values(ReleaseChannel)),
    allowNull: false,
    defaultValue: ReleaseChannel.DEVELOPMENT,
  },
  runtimeVersion: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'runtime_version',
  },
  isRollback: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_rollback',
  },
  bundleId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'bundle_id',
  },
  manifestId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'manifest_id',
  },
  publishedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'published_by',
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at',
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at',
  },
}, {
  sequelize,
  tableName: 'updates',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['app_id', 'version', 'channel'],
    },
  ],
});

export default Update;