import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { ReleaseChannel } from '../types';
import App from './App';
import User from './User';
import Bundle from './Bundle';
import Manifest from './Manifest';

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
    references: {
      model: App,
      key: 'id',
    },
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
  isRollback: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  bundleId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Bundle,
      key: 'id',
    },
  },
  manifestId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Manifest,
      key: 'id',
    },
  },
  publishedBy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
}, {
  sequelize,
  tableName: 'updates',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['app_id', 'version', 'channel'],
    },
  ],
});

// Set up associations
App.hasMany(Update, { foreignKey: 'appId', as: 'updates' });
Update.belongsTo(App, { foreignKey: 'appId', as: 'app' });

User.hasMany(Update, { foreignKey: 'publishedBy', as: 'publishedUpdates' });
Update.belongsTo(User, { foreignKey: 'publishedBy', as: 'publisher' });

Bundle.hasMany(Update, { foreignKey: 'bundleId', as: 'updates' });
Update.belongsTo(Bundle, { foreignKey: 'bundleId', as: 'bundle' });

// Fix circular reference between Update and Manifest
Manifest.hasOne(Update, { foreignKey: 'manifestId', as: 'update', constraints: false });
Update.belongsTo(Manifest, { foreignKey: 'manifestId', as: 'manifest', constraints: false });

export default Update;