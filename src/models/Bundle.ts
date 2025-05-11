import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

interface BundleAttributes {
  id: number;
  appId: number;
  hash: string;
  storageType: string;
  storagePath: string;
  size: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BundleInput extends Optional<BundleAttributes, 'id' | 'createdAt' | 'updatedAt'> {}
export interface BundleOutput extends Required<BundleAttributes> {}

class Bundle extends Model<BundleAttributes, BundleInput> implements BundleAttributes {
  public id!: number;
  public appId!: number;
  public hash!: string;
  public storageType!: string;
  public storagePath!: string;
  public size!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Define associations
  static associate(models: any) {
    Bundle.belongsTo(models.App, { foreignKey: 'appId', as: 'app' });
    Bundle.hasMany(models.Update, { foreignKey: 'bundleId', as: 'updates' });
  }
}

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
  },
  hash: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  storageType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'local',
    field: 'storage_type',
  },
  storagePath: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'storage_path',
  },
  size: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  sequelize,
  tableName: 'bundles',
  timestamps: true,
  underscored: true,
});

export default Bundle;