import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';
import { UserRole } from '../types';
import App from './App';
import User from './User';

interface AppUserAttributes {
  id: number;
  appId: number;
  userId: number;
  role: UserRole;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AppUserInput extends Optional<AppUserAttributes, 'id' | 'createdAt' | 'updatedAt'> {}
export interface AppUserOutput extends Required<AppUserAttributes> {}

class AppUser extends Model<AppUserAttributes, AppUserInput> implements AppUserAttributes {
  public id!: number;
  public appId!: number;
  public userId!: number;
  public role!: UserRole;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AppUser.init({
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
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  role: {
    type: DataTypes.ENUM(...Object.values(UserRole)),
    allowNull: false,
    defaultValue: UserRole.DEVELOPER,
  },
}, {
  sequelize,
  tableName: 'app_users',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['app_id', 'user_id'],
    },
  ],
});

// Set up associations
App.belongsToMany(User, { through: AppUser, foreignKey: 'appId', as: 'users' });
User.belongsToMany(App, { through: AppUser, foreignKey: 'userId', as: 'apps' });

export default AppUser;