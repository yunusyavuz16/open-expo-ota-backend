import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { Platform, ReleaseChannel } from '../types';

interface ManifestAttributes {
  id: number;
  appId: number;
  version: string;
  channel: ReleaseChannel;
  runtimeVersion: string;
  platforms: Platform[];
  content: Record<string, any>;
  hash: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ManifestInput extends Optional<ManifestAttributes, 'id' | 'createdAt' | 'updatedAt'> {}
export interface ManifestOutput extends Required<ManifestAttributes> {}

class Manifest extends Model<ManifestAttributes, ManifestInput> implements ManifestAttributes {
  public id!: number;
  public appId!: number;
  public version!: string;
  public channel!: ReleaseChannel;
  public runtimeVersion!: string;
  public platforms!: Platform[];
  public content!: Record<string, any>;
  public hash!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Define associations
  static associate(models: any) {
    Manifest.belongsTo(models.App, { foreignKey: 'appId', as: 'app' });
    Manifest.hasOne(models.Update, { foreignKey: 'manifestId', as: 'update' });
  }
}

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
  platforms: {
    type: DataTypes.ARRAY(DataTypes.ENUM(...Object.values(Platform))),
    allowNull: false,
  },
  content: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  hash: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  sequelize,
  tableName: 'manifests',
  timestamps: true,
  underscored: true,
});

export default Manifest;