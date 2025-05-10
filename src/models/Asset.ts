import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import Update from './Update';

interface AssetAttributes {
  id: number;
  updateId: number;
  name: string;
  hash: string;
  storageType: string;
  storagePath: string;
  size: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AssetInput extends Optional<AssetAttributes, 'id' | 'createdAt' | 'updatedAt'> {}
export interface AssetOutput extends Required<AssetAttributes> {}

class Asset extends Model<AssetAttributes, AssetInput> implements AssetAttributes {
  public id!: number;
  public updateId!: number;
  public name!: string;
  public hash!: string;
  public storageType!: string;
  public storagePath!: string;
  public size!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Asset.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  updateId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Update,
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
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
  tableName: 'assets',
  timestamps: true,
});

// Set up associations
Update.hasMany(Asset, { foreignKey: 'updateId', as: 'assets' });
Asset.belongsTo(Update, { foreignKey: 'updateId', as: 'update' });

export default Asset;