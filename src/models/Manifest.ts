import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { Platform, ReleaseChannel } from '../types';
import App from './App';

interface ManifestAttributes {
  id: number;
  appId: number;
  updateId: number;
  version: string;
  channel: ReleaseChannel;
  runtimeVersion: string;
  platforms: Platform[];
  content: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ManifestInput extends Optional<ManifestAttributes, 'id' | 'createdAt' | 'updatedAt'> {}
export interface ManifestOutput extends Required<ManifestAttributes> {}

class Manifest extends Model<ManifestAttributes, ManifestInput> implements ManifestAttributes {
  public id!: number;
  public appId!: number;
  public updateId!: number;
  public version!: string;
  public channel!: ReleaseChannel;
  public runtimeVersion!: string;
  public platforms!: Platform[];
  public content!: Record<string, any>;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
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
    references: {
      model: App,
      key: 'id',
    },
  },
  updateId: {
    type: DataTypes.INTEGER,
    allowNull: false,
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
  },
  platforms: {
    type: DataTypes.ARRAY(DataTypes.ENUM(...Object.values(Platform))),
    allowNull: false,
  },
  content: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
}, {
  sequelize,
  tableName: 'manifests',
  timestamps: true,
});

// Set up associations
App.hasMany(Manifest, { foreignKey: 'appId', as: 'manifests' });
Manifest.belongsTo(App, { foreignKey: 'appId', as: 'app' });

export default Manifest;