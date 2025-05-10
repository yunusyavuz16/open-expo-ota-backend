import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import App from './App';

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
    references: {
      model: App,
      key: 'id',
    },
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
  },
  storagePath: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  size: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  sequelize,
  tableName: 'bundles',
  timestamps: true,
});

// Set up associations
App.hasMany(Bundle, { foreignKey: 'appId', as: 'bundles' });
Bundle.belongsTo(App, { foreignKey: 'appId', as: 'app' });

export default Bundle;